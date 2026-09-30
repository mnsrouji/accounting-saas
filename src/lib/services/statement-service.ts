// =============================================================
// Statement & Aging Service — Customer & Supplier Account Statements
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'

export interface StatementLine {
  id: string
  date: string
  type: 'sale' | 'purchase' | 'payment' | 'credit'
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
}

export interface StatementAging {
  current: number
  days1To30: number
  days31To60: number
  days61To90: number
  days90Plus: number
  totalOutstanding: number
}

export interface StatementResult {
  contactId: string
  contactName: string
  contactCode: string
  currency: string
  startDate: string
  endDate: string
  openingBalance: number
  closingBalance: number
  totalDebits: number
  totalCredits: number
  lines: StatementLine[]
  aging: StatementAging
}

export class StatementService {
  /**
   * Calculate Customer Account Statement & Aging
   */
  static async getCustomerStatement(
    businessId: string,
    customerId: string,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<StatementResult> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    })

    if (!customer) throw new Error('Customer not found')

    const startDate = startDateStr ? new Date(startDateStr) : new Date(new Date().getFullYear(), 0, 1)
    const endDate = endDateStr ? new Date(endDateStr) : new Date()

    // 1. Calculate Opening Balance before startDate
    const priorSales = await prisma.sale.aggregate({
      where: {
        businessId,
        customerId,
        invoiceDate: { lt: startDate },
        status: { notIn: ['draft', 'voided', 'cancelled'] },
      },
      _sum: { totalAmount: true },
    })

    const priorPayments = await prisma.payment.aggregate({
      where: {
        businessId,
        customerId,
        paymentDate: { lt: startDate },
        status: { notIn: ['void'] },
      },
      _sum: { amount: true },
    })

    const openingBalance = new Decimal(priorSales._sum?.totalAmount?.toString() || 0)
      .minus(priorPayments._sum?.amount?.toString() || 0)
      .toNumber()

    // 2. Fetch Period Sales & Payments
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        customerId,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { notIn: ['draft', 'voided', 'cancelled'] },
      },
    })

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        customerId,
        paymentDate: { gte: startDate, lte: endDate },
        status: { notIn: ['void'] },
      },
    })

    // 3. Combine into chronological timeline
    const rawEvents: { date: Date; line: Omit<StatementLine, 'balance'> }[] = []

    sales.forEach((s) => {
      rawEvents.push({
        date: s.invoiceDate,
        line: {
          id: s.id,
          date: s.invoiceDate.toISOString().split('T')[0],
          type: 'sale',
          reference: s.invoiceNumber,
          description: `Sales Invoice #${s.invoiceNumber}`,
          debit: Number(s.totalAmount),
          credit: 0,
        },
      })
    })

    payments.forEach((p) => {
      rawEvents.push({
        date: p.paymentDate,
        line: {
          id: p.id,
          date: p.paymentDate.toISOString().split('T')[0],
          type: 'payment',
          reference: p.paymentNumber,
          description: `Payment Receipt (${p.method})`,
          debit: 0,
          credit: Number(p.amount),
        },
      })
    })

    rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime())

    // 4. Compute running balance
    let runningBalance = openingBalance
    let totalDebits = 0
    let totalCredits = 0

    const lines: StatementLine[] = rawEvents.map((evt) => {
      runningBalance = runningBalance + evt.line.debit - evt.line.credit
      totalDebits += evt.line.debit
      totalCredits += evt.line.credit
      return {
        ...evt.line,
        balance: runningBalance,
      }
    })

    // 5. Calculate Aging Breakdown for Outstanding Invoices
    const openSales = await prisma.sale.findMany({
      where: {
        businessId,
        customerId,
        status: { in: ['sent', 'partial', 'overdue'] },
      },
    })

    const now = new Date().getTime()
    const aging: StatementAging = {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
      totalOutstanding: 0,
    }

    openSales.forEach((s) => {
      const bal = Number(s.balanceDue)
      aging.totalOutstanding += bal

      const ageDays = Math.floor((now - new Date(s.invoiceDate).getTime()) / (1000 * 60 * 60 * 24))
      if (ageDays <= 0) aging.current += bal
      else if (ageDays <= 30) aging.days1To30 += bal
      else if (ageDays <= 60) aging.days31To60 += bal
      else if (ageDays <= 90) aging.days61To90 += bal
      else aging.days90Plus += bal
    })

    return {
      contactId: customer.id,
      contactName: customer.name,
      contactCode: customer.code || 'N/A',
      currency: customer.currency || 'USD',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      openingBalance,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
      lines,
      aging,
    }
  }

  /**
   * Calculate Supplier Account Statement & Aging
   */
  static async getSupplierStatement(
    businessId: string,
    supplierId: string,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<StatementResult> {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    })

    if (!supplier) throw new Error('Supplier not found')

    const startDate = startDateStr ? new Date(startDateStr) : new Date(new Date().getFullYear(), 0, 1)
    const endDate = endDateStr ? new Date(endDateStr) : new Date()

    // 1. Prior Purchases & Payments
    const priorPurchases = await prisma.purchase.aggregate({
      where: {
        businessId,
        supplierId,
        purchaseDate: { lt: startDate },
        status: { notIn: ['draft', 'voided', 'cancelled'] },
      },
      _sum: { totalAmount: true },
    })

    const priorPayments = await prisma.payment.aggregate({
      where: {
        businessId,
        supplierId,
        paymentDate: { lt: startDate },
        status: { notIn: ['void'] },
      },
      _sum: { amount: true },
    })

    const openingBalance = new Decimal(priorPurchases._sum?.totalAmount?.toString() || 0)
      .minus(priorPayments._sum?.amount?.toString() || 0)
      .toNumber()

    // 2. Fetch Purchases & Payments
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        supplierId,
        purchaseDate: { gte: startDate, lte: endDate },
        status: { notIn: ['draft', 'voided', 'cancelled'] },
      },
    })

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        supplierId,
        paymentDate: { gte: startDate, lte: endDate },
        status: { notIn: ['void'] },
      },
    })

    const rawEvents: { date: Date; line: Omit<StatementLine, 'balance'> }[] = []

    purchases.forEach((p) => {
      rawEvents.push({
        date: p.purchaseDate,
        line: {
          id: p.id,
          date: p.purchaseDate.toISOString().split('T')[0],
          type: 'purchase',
          reference: p.purchaseNumber,
          description: `Purchase Bill #${p.purchaseNumber}`,
          debit: Number(p.totalAmount),
          credit: 0,
        },
      })
    })

    payments.forEach((p) => {
      rawEvents.push({
        date: p.paymentDate,
        line: {
          id: p.id,
          date: p.paymentDate.toISOString().split('T')[0],
          type: 'payment',
          reference: p.paymentNumber,
          description: `Supplier Payment (${p.method})`,
          debit: 0,
          credit: Number(p.amount),
        },
      })
    })

    rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime())

    let runningBalance = openingBalance
    let totalDebits = 0
    let totalCredits = 0

    const lines: StatementLine[] = rawEvents.map((evt) => {
      runningBalance = runningBalance + evt.line.debit - evt.line.credit
      totalDebits += evt.line.debit
      totalCredits += evt.line.credit
      return {
        ...evt.line,
        balance: runningBalance,
      }
    })

    // Aging for open supplier bills
    const openPurchases = await prisma.purchase.findMany({
      where: {
        businessId,
        supplierId,
        status: { in: ['received', 'partial', 'overdue'] },
      },
    })

    const now = new Date().getTime()
    const aging: StatementAging = {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
      totalOutstanding: 0,
    }

    openPurchases.forEach((p) => {
      const bal = Number(p.balanceDue)
      aging.totalOutstanding += bal

      const ageDays = Math.floor((now - new Date(p.purchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      if (ageDays <= 0) aging.current += bal
      else if (ageDays <= 30) aging.days1To30 += bal
      else if (ageDays <= 60) aging.days31To60 += bal
      else if (ageDays <= 90) aging.days61To90 += bal
      else aging.days90Plus += bal
    })

    return {
      contactId: supplier.id,
      contactName: supplier.name,
      contactCode: supplier.code || 'N/A',
      currency: supplier.currency || 'USD',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      openingBalance,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
      lines,
      aging,
    }
  }
}
