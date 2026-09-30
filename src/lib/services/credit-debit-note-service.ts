// =============================================================
// Credit & Debit Note Service — Financial Adjustments Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createCreditDebitNoteSchema,
  CreateCreditDebitNoteInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { AccountingService } from './accounting-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'

export class CreditDebitNoteService {
  /**
   * Create and immediately post a Credit Note (for Customer) or Debit Note (for Supplier).
   */
  static async createNote(input: CreateCreditDebitNoteInput) {
    const validated = createCreditDebitNoteSchema.parse(input)
    const {
      businessId,
      type,
      customerId,
      supplierId,
      relatedSaleId,
      relatedPurchaseId,
      noteDate,
      reason,
      currency,
      exchangeRate,
      lines,
      userId,
    } = validated

    if (type === 'credit_note' && !customerId) {
      throw new ValidationError('Customer is required for Customer Credit Note')
    }
    if (type === 'debit_note' && !supplierId) {
      throw new ValidationError('Supplier is required for Supplier Debit Note')
    }

    const docType = type === 'credit_note' ? 'credit_note' : 'debit_note'
    const noteNumber =
      validated.noteNumber || (await DocumentNumberingService.generateNumber(businessId, docType))

    let subtotal = new Decimal(0)
    let taxTotal = new Decimal(0)

    const noteItems = lines.map((l) => {
      const qty = new Decimal(l.quantity || 1)
      const price = new Decimal(l.unitPrice)
      const taxRatePct = new Decimal(l.taxRate || 0)

      const lineBase = qty.mul(price)
      const lineTax = lineBase.mul(taxRatePct.div(100))
      const lineTotal = lineBase.plus(lineTax)

      subtotal = subtotal.plus(lineBase)
      taxTotal = taxTotal.plus(lineTax)

      return {
        productId: l.productId || null,
        accountId: l.accountId || null,
        description: l.description,
        quantity: qty,
        unitPrice: price,
        taxRate: taxRatePct,
        taxAmount: lineTax,
        totalAmount: lineTotal,
      }
    })

    const totalAmount = subtotal.plus(taxTotal)

    return prisma.$transaction(async (tx) => {
      // 1. Create Credit/Debit Note
      const note = await tx.creditDebitNote.create({
        data: {
          businessId,
          type,
          noteNumber,
          noteDate,
          customerId: customerId || null,
          supplierId: supplierId || null,
          relatedSaleId: relatedSaleId || null,
          relatedPurchaseId: relatedPurchaseId || null,
          reason: reason || null,
          currency,
          exchangeRate: new Decimal(exchangeRate || 1),
          subtotal,
          taxTotal,
          totalAmount,
          remainingAmount: totalAmount,
          status: 'posted',
          createdBy: userId,
          items: {
            create: noteItems,
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          supplier: true,
        },
      })

      // 2. Double-Entry Accounting Posting
      let journalEntryId: string | null = null

      if (type === 'credit_note') {
        // Customer Credit Note: Debit Sales (4000) & Tax (2200), Credit Accounts Receivable (1200)
        const arAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1200' } })
        const salesAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '4000' } })
        const taxAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2200' } })

        if (arAccount && salesAccount) {
          const lines: any[] = [
            {
              accountId: salesAccount.id,
              description: `Credit Note Adjustment - ${noteNumber}`,
              debitAmount: Number(subtotal),
              creditAmount: 0,
              customerId,
            },
          ]

          if (taxTotal.gt(0) && taxAccount) {
            lines.push({
              accountId: taxAccount.id,
              description: `Tax Adjustment - ${noteNumber}`,
              debitAmount: Number(taxTotal),
              creditAmount: 0,
              customerId,
            })
          }

          lines.push({
            accountId: arAccount.id,
            description: `AR Reduction - ${noteNumber}`,
            debitAmount: 0,
            creditAmount: Number(totalAmount),
            customerId,
          })

          const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
          const je = await AccountingService.postJournalEntry(
            {
              businessId,
              entryNumber: jeNumber,
              entryDate: noteDate,
              description: `Customer Credit Note: ${noteNumber} (${reason || 'Price/Return Adjustment'})`,
              currencyCode: currency,
              exchangeRate: Number(exchangeRate || 1),
              sourceType: 'sale',
              sourceId: note.id,
              lines,
              userId,
            },
            tx
          )
          journalEntryId = je.id
        }

        // Update customer balance
        if (customerId) {
          await tx.customer.update({
            where: { id: customerId },
            data: { balance: { decrement: totalAmount } },
          })
        }
      } else {
        // Supplier Debit Note: Debit Accounts Payable (2000), Credit Purchase Expense/Inventory (5000 / 1400)
        const apAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2000' } })
        const purchaseAccount =
          (await tx.chartOfAccount.findFirst({ where: { businessId, code: '5000' } })) ||
          (await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } }))

        if (apAccount && purchaseAccount) {
          const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
          const je = await AccountingService.postJournalEntry(
            {
              businessId,
              entryNumber: jeNumber,
              entryDate: noteDate,
              description: `Supplier Debit Note: ${noteNumber} (${reason || 'Price/Return Adjustment'})`,
              currencyCode: currency,
              exchangeRate: Number(exchangeRate || 1),
              sourceType: 'purchase',
              sourceId: note.id,
              lines: [
                {
                  accountId: apAccount.id,
                  description: `AP Reduction - ${noteNumber}`,
                  debitAmount: Number(totalAmount),
                  creditAmount: 0,
                  supplierId,
                },
                {
                  accountId: purchaseAccount.id,
                  description: `Purchase Adjustment - ${noteNumber}`,
                  debitAmount: 0,
                  creditAmount: Number(totalAmount),
                  supplierId,
                },
              ],
              userId,
            },
            tx
          )
          journalEntryId = je.id
        }

        // Update supplier balance
        if (supplierId) {
          await tx.supplier.update({
            where: { id: supplierId },
            data: { balance: { decrement: totalAmount } },
          })
        }
      }

      let finalNote = note
      if (journalEntryId) {
        finalNote = await tx.creditDebitNote.update({
          where: { id: note.id },
          data: { journalEntryId },
          include: {
            items: { include: { product: true } },
            customer: true,
            supplier: true,
          },
        })
      }

      await AuditService.log(
        {
          businessId,
          userId,
          entityType: 'credit_debit_note',
          entityId: note.id,
          action: 'create_and_post',
          changes: { noteNumber, type, totalAmount: totalAmount.toNumber() },
        },
        tx
      )

      return finalNote
    }, { maxWait: 15000, timeout: 30000 })
  }

  /**
   * Allocate Credit Note against an open Sales Invoice (reducing remaining invoice balance).
   */
  static async allocateCreditNoteToInvoice(
    businessId: string,
    creditNoteId: string,
    saleId: string,
    amountToAllocate: number,
    userId: string
  ) {
    const note = await prisma.creditDebitNote.findFirst({
      where: { id: creditNoteId, businessId, type: 'credit_note', status: 'posted' },
    })
    if (!note) throw new TenantAccessDeniedError('Credit Note')

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId },
    })
    if (!sale) throw new TenantAccessDeniedError('Sales Invoice')

    const allocDecimal = new Decimal(amountToAllocate)
    if (allocDecimal.lte(0)) throw new ValidationError('Allocation amount must be positive')

    const remainingOnNote = new Decimal(note.remainingAmount)
    if (allocDecimal.gt(remainingOnNote)) {
      throw new ValidationError(
        `Cannot allocate $${allocDecimal.toNumber()}. Remaining credit on note is $${remainingOnNote.toNumber()}`
      )
    }

    const currentBalanceDue = new Decimal(sale.balanceDue)
    if (allocDecimal.gt(currentBalanceDue)) {
      throw new ValidationError(
        `Allocation exceeds invoice balance due of $${currentBalanceDue.toNumber()}`
      )
    }

    return prisma.$transaction(
      async (tx) => {
        // 1. Update Note allocation
        const updatedNote = await tx.creditDebitNote.update({
          where: { id: creditNoteId },
          data: {
            allocatedAmount: { increment: allocDecimal },
            remainingAmount: { decrement: allocDecimal },
          },
        })

        // 2. Update Sale balance
        const newPaid = new Decimal(sale.paidAmount).plus(allocDecimal)
        const newBalance = new Decimal(sale.totalAmount).minus(newPaid)
        const newStatus = newBalance.lte(0.001) ? 'paid' : 'partial'

        await tx.sale.update({
          where: { id: saleId },
          data: {
            paidAmount: newPaid,
            balanceDue: newBalance,
            status: newStatus,
          },
        })

        await AuditService.log(
          {
            businessId,
            userId,
            entityType: 'credit_debit_note',
            entityId: creditNoteId,
            action: 'allocate_to_sale',
            changes: { saleId, allocatedAmount: allocDecimal.toNumber() },
          },
          tx
        )

        return updatedNote
      },
      { maxWait: 15000, timeout: 30000 }
    )
  }

  /**
   * Get Credit / Debit Note by ID.
   */
  static async getById(businessId: string, noteId: string) {
    const note = await prisma.creditDebitNote.findFirst({
      where: { id: noteId, businessId },
      include: {
        customer: true,
        supplier: true,
        items: { include: { product: true } },
      },
    })
    if (!note) throw new TenantAccessDeniedError('Credit/Debit Note')
    return note
  }

  /**
   * List Credit & Debit Notes.
   */
  static async list(businessId: string, filter?: { type?: 'credit_note' | 'debit_note'; customerId?: string; supplierId?: string }) {
    return prisma.creditDebitNote.findMany({
      where: {
        businessId,
        ...(filter?.type ? { type: filter.type } : {}),
        ...(filter?.customerId ? { customerId: filter.customerId } : {}),
        ...(filter?.supplierId ? { supplierId: filter.supplierId } : {}),
      },
      include: { customer: true, supplier: true, items: true },
      orderBy: { noteDate: 'desc' },
    })
  }
}
