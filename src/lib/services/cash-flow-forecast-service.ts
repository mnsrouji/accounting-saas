// =============================================================
// Cash Flow Forecast Service — Liquidity Projections & Cash Planning
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  liquidityForecastFilterSchema,
  LiquidityForecastFilterInput,
} from '@/lib/validations/treasury-schemas'
import { CashPositionService } from './cash-position-service'

export interface ForecastItem {
  id: string
  sourceType: 'receivable_invoice' | 'payment_promise' | 'payable_bill' | 'purchase_order' | 'expense'
  direction: 'inflow' | 'outflow'
  date: Date
  amount: number
  currencyCode: string
  partyName: string
  reference?: string
  confidence: 'high' | 'medium' | 'low'
  status: string
}

export interface CashFlowForecastResult {
  businessId: string
  horizonDays: number
  startDate: Date
  endDate: Date
  startingLiquidity: number
  totalProjectedInflow: number
  totalProjectedOutflow: number
  netCashFlow: number
  projectedEndingLiquidity: number
  inflowItems: ForecastItem[]
  outflowItems: ForecastItem[]
  dailyProjections: {
    date: string
    startingBalance: number
    inflows: number
    outflows: number
    netMovement: number
    endingBalance: number
  }[]
}

export class CashFlowForecastService {
  /**
   * Generate forward-looking liquidity forecast from actual database commitments and receivables.
   */
  static async getForecast(input: LiquidityForecastFilterInput): Promise<CashFlowForecastResult> {
    const validated = liquidityForecastFilterSchema.parse(input)
    const startDate = validated.startDate || new Date()
    const endDate =
      validated.endDate || new Date(startDate.getTime() + validated.horizonDays * 24 * 60 * 60 * 1000)

    // 1. Fetch current starting liquidity
    const position = await CashPositionService.getCashPosition({
      businessId: validated.businessId,
      currency: validated.currency,
    })

    let startingLiquidity = 0
    for (const cur of Object.values(position.positionsByCurrency)) {
      startingLiquidity += cur.totalLiquidFunds
    }

    const inflowItems: ForecastItem[] = []
    const outflowItems: ForecastItem[] = []

    // 2. Expected Inflows: Unpaid Sales Invoices (AR)
    const unpaidSales = await prisma.sale.findMany({
      where: {
        businessId: validated.businessId,
        status: { in: ['sent', 'partial'] },
        dueDate: { lte: endDate },
      },
      include: { customer: true },
    })

    for (const sale of unpaidSales) {
      const balanceDue = new Decimal(sale.balanceDue).toNumber()
      if (balanceDue > 0) {
        inflowItems.push({
          id: sale.id,
          sourceType: 'receivable_invoice',
          direction: 'inflow',
          date: sale.dueDate || sale.invoiceDate,
          amount: balanceDue,
          currencyCode: sale.currencyCode,
          partyName: sale.customer?.name || 'Customer',
          reference: sale.invoiceNumber,
          confidence: 'high',
          status: sale.status,
        })
      }
    }

    // 3. Expected Inflows: Open Payment Promises
    const paymentPromises = await prisma.paymentPromise.findMany({
      where: {
        businessId: validated.businessId,
        status: 'open',
        promiseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { customer: true },
    })

    for (const p of paymentPromises) {
      const remaining = new Decimal(p.promisedAmount).minus(new Decimal(p.actualPaidAmount)).toNumber()
      if (remaining > 0) {
        inflowItems.push({
          id: p.id,
          sourceType: 'payment_promise',
          direction: 'inflow',
          date: p.promiseDate,
          amount: remaining,
          currencyCode: 'USD',
          partyName: p.customer?.name || 'Customer',
          reference: `Promise: ${p.id.substring(0, 8)}`,
          confidence: 'medium',
          status: p.status,
        })
      }
    }

    // 4. Expected Outflows: Unpaid Purchases (AP Bills)
    const unpaidPurchases = await prisma.purchase.findMany({
      where: {
        businessId: validated.businessId,
        status: { in: ['received', 'partial'] },
        dueDate: { lte: endDate },
      },
      include: { supplier: true },
    })

    for (const purch of unpaidPurchases) {
      const balanceDue = new Decimal(purch.balanceDue).toNumber()
      if (balanceDue > 0) {
        outflowItems.push({
          id: purch.id,
          sourceType: 'payable_bill',
          direction: 'outflow',
          date: purch.dueDate || purch.purchaseDate,
          amount: balanceDue,
          currencyCode: purch.currencyCode,
          partyName: purch.supplier?.name || 'Supplier',
          reference: purch.purchaseNumber,
          confidence: 'high',
          status: purch.status,
        })
      }
    }

    // 5. Expected Outflows: Confirmed Purchase Orders
    const openPOs = await prisma.purchaseOrder.findMany({
      where: {
        businessId: validated.businessId,
        status: { in: ['confirmed', 'processing'] },
        orderDate: { lte: endDate },
      },
      include: { supplier: true },
    })

    for (const po of openPOs) {
      outflowItems.push({
        id: po.id,
        sourceType: 'purchase_order',
        direction: 'outflow',
        date: po.orderDate,
        amount: new Decimal(po.grandTotal).toNumber(),
        currencyCode: po.currency,
        partyName: po.supplier?.name || 'Supplier',
        reference: po.orderNumber,
        confidence: 'medium',
        status: po.status,
      })
    }

    // 6. Compute Daily Aggregations
    let totalInflow = 0
    for (const item of inflowItems) totalInflow += item.amount
    let totalOutflow = 0
    for (const item of outflowItems) totalOutflow += item.amount

    const netCashFlow = totalInflow - totalOutflow
    const projectedEndingLiquidity = startingLiquidity + netCashFlow

    // Build timeline buckets
    const dailyMap = new Map<string, { inflows: number; outflows: number }>()

    for (const item of inflowItems) {
      const dayKey = item.date.toISOString().slice(0, 10)
      const current = dailyMap.get(dayKey) || { inflows: 0, outflows: 0 }
      current.inflows += item.amount
      dailyMap.set(dayKey, current)
    }

    for (const item of outflowItems) {
      const dayKey = item.date.toISOString().slice(0, 10)
      const current = dailyMap.get(dayKey) || { inflows: 0, outflows: 0 }
      current.outflows += item.amount
      dailyMap.set(dayKey, current)
    }

    const sortedDays = Array.from(dailyMap.keys()).sort()
    let runningBalance = startingLiquidity
    const dailyProjections = sortedDays.map((dayKey) => {
      const data = dailyMap.get(dayKey)!
      const net = data.inflows - data.outflows
      const dayStart = runningBalance
      runningBalance += net
      return {
        date: dayKey,
        startingBalance: dayStart,
        inflows: data.inflows,
        outflows: data.outflows,
        netMovement: net,
        endingBalance: runningBalance,
      }
    })

    return {
      businessId: validated.businessId,
      horizonDays: validated.horizonDays,
      startDate,
      endDate,
      startingLiquidity,
      totalProjectedInflow: totalInflow,
      totalProjectedOutflow: totalOutflow,
      netCashFlow,
      projectedEndingLiquidity,
      inflowItems,
      outflowItems,
      dailyProjections,
    }
  }
}
