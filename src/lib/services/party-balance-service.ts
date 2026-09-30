// =============================================================
// Party Balance Synchronization & Ledger Reconciliation Service
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'

export class PartyBalanceService {
  /**
   * Recalculate a customer's cached balance from source of truth (open invoices & credit notes).
   */
  static async recalculateCustomerBalance(businessId: string, customerId: string): Promise<Decimal> {
    const [sales, creditNotes] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          customerId,
          status: { in: ['sent', 'partial', 'overdue'] },
        },
        select: { balanceDue: true },
      }),
      prisma.creditDebitNote.findMany({
        where: {
          businessId,
          customerId,
          type: 'credit',
          status: 'issued',
        },
        select: { remainingAmount: true },
      }),
    ])

    const totalInvoicesDue = sales.reduce(
      (sum, s) => sum.plus(new Decimal(s.balanceDue || 0)),
      new Decimal(0)
    )

    const totalOpenCredits = creditNotes.reduce(
      (sum, cn) => sum.plus(new Decimal(cn.remainingAmount || 0)),
      new Decimal(0)
    )

    const accurateBalance = totalInvoicesDue.minus(totalOpenCredits)

    await prisma.customer.update({
      where: { id: customerId },
      data: { balance: accurateBalance },
    })

    return accurateBalance
  }

  /**
   * Recalculate a supplier's cached balance from source of truth (open purchase invoices & debit notes).
   */
  static async recalculateSupplierBalance(businessId: string, supplierId: string): Promise<Decimal> {
    const [purchases, debitNotes] = await Promise.all([
      prisma.purchase.findMany({
        where: {
          businessId,
          supplierId,
          status: { in: ['received', 'partial', 'overdue'] },
        },
        select: { balanceDue: true },
      }),
      prisma.creditDebitNote.findMany({
        where: {
          businessId,
          supplierId,
          type: 'debit',
          status: 'issued',
        },
        select: { remainingAmount: true },
      }),
    ])

    const totalBillsDue = purchases.reduce(
      (sum, p) => sum.plus(new Decimal(p.balanceDue || 0)),
      new Decimal(0)
    )

    const totalOpenDebits = debitNotes.reduce(
      (sum, dn) => sum.plus(new Decimal(dn.remainingAmount || 0)),
      new Decimal(0)
    )

    const accurateBalance = totalBillsDue.minus(totalOpenDebits)

    await prisma.supplier.update({
      where: { id: supplierId },
      data: { balance: accurateBalance },
    })

    return accurateBalance
  }

  /**
   * Synchronize all customer and supplier balances in a business to eliminate drift.
   */
  static async syncAllBalances(businessId: string) {
    const [customers, suppliers] = await Promise.all([
      prisma.customer.findMany({ where: { businessId }, select: { id: true } }),
      prisma.supplier.findMany({ where: { businessId }, select: { id: true } }),
    ])

    let syncedCustomers = 0
    let syncedSuppliers = 0

    for (const c of customers) {
      await this.recalculateCustomerBalance(businessId, c.id)
      syncedCustomers++
    }

    for (const s of suppliers) {
      await this.recalculateSupplierBalance(businessId, s.id)
      syncedSuppliers++
    }

    return {
      syncedCustomers,
      syncedSuppliers,
    }
  }
}
