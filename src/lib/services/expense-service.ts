// =============================================================
// Expense Posting Engine & Service Layer
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { postExpenseSchema, PostExpenseInput } from '@/lib/validations/accounting-schemas'
import { TenantAccessDeniedError, AccountingError } from '@/lib/errors/accounting-error'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class ExpenseService {
  /**
   * Post an Expense atomically:
   * 1. Validate expense account, supplier, cash/bank account, tenant
   * 2. Freeze exchange rate & calculate tax
   * 3. Create Expense record
   * 4. Auto-generate & post balanced Accounting Journal Entry
   */
  static async postExpense(input: PostExpenseInput) {
    const validated = postExpenseSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const {
        businessId,
        expenseNumber,
        expenseDate,
        description,
        vendor,
        categoryId,
        accountId,
        supplierId,
        cashAccountId,
        bankAccountId,
        currencyCode,
        exchangeRate,
        amount,
        taxAmount,
        notes,
        userId,
      } = validated

      const rate = new Decimal(exchangeRate)
      const expAmount = new Decimal(amount)
      const taxAmt = new Decimal(taxAmount || 0)
      const totalAmt = expAmount.plus(taxAmt)
      const baseAmt = totalAmt.mul(rate)

      // 1. Verify Expense Account
      const expenseAcc = await tx.chartOfAccount.findFirst({
        where: { id: accountId, businessId },
      })
      if (!expenseAcc) throw new TenantAccessDeniedError('Expense Account in Chart of Accounts')

      // 2. Create Expense record
      const expense = await tx.expense.create({
        data: {
          businessId,
          expenseNumber,
          expenseDate,
          description,
          vendor,
          categoryId,
          accountId,
          supplierId,
          cashAccountId,
          bankAccountId,
          currencyCode,
          exchangeRate: rate,
          amount: expAmount,
          taxAmount: taxAmt,
          totalAmount: totalAmt,
          baseAmount: baseAmt,
          paymentStatus: (cashAccountId || bankAccountId) ? 'paid' : 'unpaid',
          status: 'posted',
          createdBy: userId,
        },
      })

      // 3. Update Cash/Bank balance if paid
      if (cashAccountId) {
        const cashAcc = await tx.cashAccount.findFirst({ where: { id: cashAccountId, businessId } })
        if (cashAcc) {
          await tx.cashAccount.update({
            where: { id: cashAccountId },
            data: { balance: new Decimal(cashAcc.balance).minus(totalAmt) },
          })
        }
      }

      if (bankAccountId) {
        const bankAcc = await tx.bankAccount.findFirst({ where: { id: bankAccountId, businessId } })
        if (bankAcc) {
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: { balance: new Decimal(bankAcc.balance).minus(totalAmt) },
          })
        }
      }

      // 4. Generate & Post Accounting Journal Entry
      const bankGlAccount = bankAccountId
        ? (await tx.bankAccount.findUnique({ where: { id: bankAccountId } }))?.accountId
        : undefined
      const cashGlAccount = cashAccountId
        ? (await tx.cashAccount.findUnique({ where: { id: cashAccountId } }))?.accountId
        : undefined

      const apAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2100' } }) // AP
      const vatAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2210' } }) // Input VAT

      const creditGlAccountId = bankGlAccount || cashGlAccount || apAccount?.id

      if (!creditGlAccountId) {
        throw new AccountingError('Credit Account (Bank, Cash, or Accounts Payable) must exist.')
      }

      const journalLines: any[] = [
        {
          accountId, // Expense Account (Debit)
          description: `${description} (${expenseNumber})`,
          debitAmount: expAmount.toNumber(),
          creditAmount: 0,
          supplierId,
        },
      ]

      if (taxAmt.gt(0) && vatAccount) {
        journalLines.push({
          accountId: vatAccount.id, // Input VAT (Debit)
          description: `Input VAT on Expense ${expenseNumber}`,
          debitAmount: taxAmt.toNumber(),
          creditAmount: 0,
        })
      }

      journalLines.push({
        accountId: creditGlAccountId, // Bank/Cash/AP (Credit)
        description: `Disbursement for Expense ${expenseNumber}`,
        debitAmount: 0,
        creditAmount: totalAmt.toNumber(),
        supplierId,
      })

      const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
      const journalEntry = await AccountingService.postJournalEntry({
        businessId,
        entryNumber: jeNumber,
        entryDate: expenseDate,
        description: `Automated Journal Entry for Expense ${expenseNumber}`,
        currencyCode,
        exchangeRate: rate.toNumber(),
        reference: expenseNumber,
        sourceType: 'expense',
        sourceId: expense.id,
        lines: journalLines,
        userId,
      }, tx)

      return { expense, journalEntry }
    })
  }
}
