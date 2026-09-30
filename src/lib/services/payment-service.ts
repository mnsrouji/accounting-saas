// =============================================================
// Payment Processing & Allocation Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { processPaymentSchema, ProcessPaymentInput } from '@/lib/validations/accounting-schemas'
import { OverAllocationError, TenantAccessDeniedError, AccountingError } from '@/lib/errors/accounting-error'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class PaymentService {
  /**
   * Process a Customer or Supplier payment with multi-invoice allocation.
   */
  static async processPayment(input: ProcessPaymentInput) {
    const validated = processPaymentSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const {
        businessId,
        paymentNumber,
        paymentDate,
        type,
        method,
        customerId,
        supplierId,
        cashAccountId,
        bankAccountId,
        currencyCode,
        exchangeRate,
        amount,
        reference,
        notes,
        allocations,
        userId,
      } = validated

      const rate = new Decimal(exchangeRate)
      const payAmount = new Decimal(amount)

      // 1. Calculate & Validate Allocations Sum
      let totalAllocated = new Decimal(0)
      for (const alloc of allocations) {
        if (!alloc.saleId && !alloc.purchaseId) {
          throw new AccountingError('Payment allocation must target either a sales invoice or purchase invoice.')
        }
        if (alloc.saleId && alloc.purchaseId) {
          throw new AccountingError('Payment allocation cannot target both a sales invoice and purchase invoice simultaneously.')
        }
        totalAllocated = totalAllocated.plus(new Decimal(alloc.allocatedAmount))
      }

      if (totalAllocated.gt(payAmount)) {
        throw new OverAllocationError(payAmount.toNumber(), totalAllocated.toNumber())
      }

      const unallocatedAmount = payAmount.minus(totalAllocated)

      // Determine payment status
      let paymentStatus: any = 'posted'
      if (allocations.length > 0) {
        paymentStatus = unallocatedAmount.equals(0) ? 'fully_allocated' : 'partially_allocated'
      }

      const direction = (type === 'incoming' || type === 'advance') ? 'inbound' : 'outbound'

      // 2. Create Payment record
      const payment = await tx.payment.create({
        data: {
          businessId,
          paymentNumber,
          paymentDate,
          type,
          direction,
          status: paymentStatus,
          method,
          customerId,
          supplierId,
          cashAccountId,
          bankAccountId,
          currencyCode,
          exchangeRate: rate,
          amount: payAmount,
          baseAmount: payAmount.mul(rate),
          allocatedAmount: totalAllocated,
          unallocatedAmount,
          reference,
          notes,
          createdBy: userId,
        },
      })

      // 3. Process PaymentAllocations & Update Invoice Balances
      for (const alloc of allocations) {
        const allocAmt = new Decimal(alloc.allocatedAmount)
        const allocBaseAmt = allocAmt.mul(rate)

        await tx.paymentAllocation.create({
          data: {
            businessId,
            paymentId: payment.id,
            saleId: alloc.saleId,
            purchaseId: alloc.purchaseId,
            allocatedAmount: allocAmt,
            allocatedBaseAmount: allocBaseAmt,
            allocationDate: paymentDate,
            createdBy: userId,
          },
        })

        // Update Sales Invoice balance
        if (alloc.saleId) {
          const sale = await tx.sale.findFirst({
            where: { id: alloc.saleId, businessId },
          })
          if (!sale) throw new TenantAccessDeniedError('Sales Invoice')

          const newPaid = new Decimal(sale.paidAmount).plus(allocAmt)
          const newBalance = new Decimal(sale.totalAmount).minus(newPaid)
          const newStatus = newBalance.lte(0) ? 'paid' : 'partial'

          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paidAmount: newPaid,
              balanceDue: newBalance.lt(0) ? new Decimal(0) : newBalance,
              status: newStatus,
            },
          })
        }

        // Update Purchase Invoice balance
        if (alloc.purchaseId) {
          const purchase = await tx.purchase.findFirst({
            where: { id: alloc.purchaseId, businessId },
          })
          if (!purchase) throw new TenantAccessDeniedError('Purchase Invoice')

          const newPaid = new Decimal(purchase.paidAmount).plus(allocAmt)
          const newBalance = new Decimal(purchase.totalAmount).minus(newPaid)
          const newStatus = newBalance.lte(0) ? 'paid' : 'partial'

          await tx.purchase.update({
            where: { id: purchase.id },
            data: {
              paidAmount: newPaid,
              balanceDue: newBalance.lt(0) ? new Decimal(0) : newBalance,
              status: newStatus,
            },
          })
        }
      }

      // 4. Update Cash/Bank Account Current Balances
      if (cashAccountId) {
        const cashAcc = await tx.cashAccount.findFirst({ where: { id: cashAccountId, businessId } })
        if (cashAcc) {
          const newBal = direction === 'inbound'
            ? new Decimal(cashAcc.balance).plus(payAmount)
            : new Decimal(cashAcc.balance).minus(payAmount)

          await tx.cashAccount.update({
            where: { id: cashAccountId },
            data: { balance: newBal },
          })
        }
      }

      if (bankAccountId) {
        const bankAcc = await tx.bankAccount.findFirst({ where: { id: bankAccountId, businessId } })
        if (bankAcc) {
          const newBal = direction === 'inbound'
            ? new Decimal(bankAcc.balance).plus(payAmount)
            : new Decimal(bankAcc.balance).minus(payAmount)

          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: { balance: newBal },
          })
        }
      }

      // Update Customer / Supplier Cached Balance
      if (direction === 'inbound' && customerId) {
        const customer = await tx.customer.findFirst({ where: { id: customerId, businessId } })
        if (customer) {
          const newBal = new Decimal(customer.balance).minus(payAmount)
          await tx.customer.update({
            where: { id: customerId },
            data: { balance: newBal },
          })
        }
      } else if (direction === 'outbound' && supplierId) {
        const supplier = await tx.supplier.findFirst({ where: { id: supplierId, businessId } })
        if (supplier) {
          const newBal = new Decimal(supplier.balance).minus(payAmount)
          await tx.supplier.update({
            where: { id: supplierId },
            data: { balance: newBal },
          })
        }
      }

      // 5. Generate & Post Accounting Journal Entry
      const bankGlAccount = bankAccountId
        ? (await tx.bankAccount.findUnique({ where: { id: bankAccountId } }))?.accountId
        : undefined
      const cashGlAccount = cashAccountId
        ? (await tx.cashAccount.findUnique({ where: { id: cashAccountId } }))?.accountId
        : undefined

      let liquidGlAccountId = bankGlAccount || cashGlAccount

      if (!liquidGlAccountId) {
        const liquidAcc = await tx.chartOfAccount.findFirst({
          where: {
            businessId,
            isActive: true,
            isHeader: false,
            type: 'asset',
            OR: [
              { code: { in: ['1100', '1200', '1210', '1010', '1020', '1000'] } },
              { name: { contains: 'Cash', mode: 'insensitive' } },
              { name: { contains: 'Bank', mode: 'insensitive' } },
              { name: { contains: 'صندوق' } },
              { name: { contains: 'خزينة' } },
              { name: { contains: 'بنك' } },
            ],
          },
          orderBy: { code: 'asc' },
        })
        liquidGlAccountId = liquidAcc?.id
      }

      if (!liquidGlAccountId) {
        throw new AccountingError(
          'لم يتم العثور على حساب نقدية أو بنك في دليل الحسابات لتسجيل سند القبض/الصرف. يرجى ربط حساب الخزينة/البنك بدليل الحسابات.',
          'MISSING_GL_ACCOUNT',
          400,
          { detail: 'Liquid GL account (Cash/Bank) not found in Chart of Accounts' }
        )
      }

      let arAccount = await tx.chartOfAccount.findFirst({
        where: {
          businessId,
          isActive: true,
          isHeader: false,
          type: 'asset',
          OR: [
            { code: { in: ['1300', '1200', '1120'] } },
            { name: { contains: 'Receivable', mode: 'insensitive' } },
            { name: { contains: 'عملاء' } },
            { name: { contains: 'ذمم مدينة' } },
          ],
        },
        orderBy: { code: 'asc' },
      })
      if (!arAccount && direction === 'inbound') {
        throw new AccountingError(
          'لم يتم العثور على حساب العملاء / الذمم المدينة (1300) في دليل الحسابات.',
          'MISSING_GL_ACCOUNT',
          400,
          { detail: 'Accounts Receivable GL account not found' }
        )
      }

      let apAccount = await tx.chartOfAccount.findFirst({
        where: {
          businessId,
          isActive: true,
          isHeader: false,
          type: 'liability',
          OR: [
            { code: { in: ['2100', '2000', '2110'] } },
            { name: { contains: 'Payable', mode: 'insensitive' } },
            { name: { contains: 'موردين' } },
            { name: { contains: 'ذمم دائنة' } },
          ],
        },
        orderBy: { code: 'asc' },
      })
      if (!apAccount && direction === 'outbound') {
        throw new AccountingError(
          'لم يتم العثور على حساب الموردين / الذمم الدائنة (2100) في دليل الحسابات.',
          'MISSING_GL_ACCOUNT',
          400,
          { detail: 'Accounts Payable GL account not found' }
        )
      }

      const journalLines: any[] = []

      if (direction === 'inbound') {
        // Customer Receipt: Debit Bank/Cash, Credit Accounts Receivable
        journalLines.push({
          accountId: liquidGlAccountId,
          description: `Receipt from payment ${paymentNumber}`,
          debitAmount: payAmount.toNumber(),
          creditAmount: 0,
        })
        journalLines.push({
          accountId: arAccount?.id || liquidGlAccountId,
          description: `Credit AR for payment ${paymentNumber}`,
          debitAmount: 0,
          creditAmount: payAmount.toNumber(),
          customerId,
        })
      } else {
        // Supplier Outgoing Payment: Debit Accounts Payable, Credit Bank/Cash
        journalLines.push({
          accountId: apAccount?.id || liquidGlAccountId,
          description: `Debit AP for payment ${paymentNumber}`,
          debitAmount: payAmount.toNumber(),
          creditAmount: 0,
          supplierId,
        })
        journalLines.push({
          accountId: liquidGlAccountId,
          description: `Disbursement from payment ${paymentNumber}`,
          debitAmount: 0,
          creditAmount: payAmount.toNumber(),
        })
      }

      // Use DocumentNumberingService for atomic, sequential, unique journal entry numbers.
      const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)

      const journalEntry = await AccountingService.postJournalEntry({
        businessId,
        entryNumber: jeNumber,
        entryDate: paymentDate,
        description: `Automated Journal Entry for Payment ${paymentNumber}`,
        currencyCode,
        exchangeRate: rate.toNumber(),
        reference: paymentNumber,
        sourceType: 'payment',
        sourceId: payment.id,
        lines: journalLines,
        userId,
      }, tx)

      return { payment, journalEntry }
    })
  }
}
