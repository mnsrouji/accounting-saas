// =============================================================
// Treasury Dashboard Service — Real-Time KPIs & Liquidity Monitoring
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { CashPositionService } from './cash-position-service'
import { CashFlowForecastService } from './cash-flow-forecast-service'

export interface TreasuryDashboardMetrics {
  businessId: string
  totalCashOnHand: number
  totalBankBalances: number
  totalPettyCash: number
  totalAvailableLiquidity: number
  unreconciledBankTransactionsCount: number
  unreconciledBankAmount: number
  upcomingInflows30Days: number
  upcomingOutflows30Days: number
  netProjectedCashMovement30Days: number
  activeReconciliationsCount: number
  totalReconciliationDifferences: number
  accountsRequiringAttention: {
    accountId: string
    accountName: string
    type: 'cash' | 'bank' | 'petty_cash'
    issue: string
    severity: 'high' | 'medium' | 'low'
    currentBalance: number
  }[]
  recentTransfers: any[]
  recentReconciliations: any[]
}

export class TreasuryDashboardService {
  /**
   * Aggregate executive treasury KPIs from live database tables.
   */
  static async getDashboardMetrics(businessId: string): Promise<TreasuryDashboardMetrics> {
    // 1. Fetch cash position
    const position = await CashPositionService.getCashPosition({ businessId })

    let totalCash = 0
    let totalBank = 0
    let totalPetty = 0
    let totalLiquidity = 0

    for (const cur of Object.values(position.positionsByCurrency)) {
      totalCash += cur.cashOnHand
      totalBank += cur.bankBalances
      totalPetty += cur.pettyCash
      totalLiquidity += cur.totalLiquidFunds
    }

    // 2. Fetch forward-looking 30-day forecast
    const forecast = await CashFlowForecastService.getForecast({
      businessId,
      horizonDays: 30,
    })

    // 3. Unreconciled bank transactions
    const unreconciledTxns = await prisma.bankTransaction.findMany({
      where: { businessId, isReconciled: false },
    })

    let unreconciledAmount = 0
    for (const tx of unreconciledTxns) {
      unreconciledAmount += new Decimal(tx.amount).abs().toNumber()
    }

    // 4. Open/Active Reconciliations
    const openReconciliations = await prisma.bankReconciliation.findMany({
      where: {
        businessId,
        status: { in: ['draft', 'in_progress', 'reconciled'] },
      },
    })

    let totalDiff = 0
    for (const r of openReconciliations) {
      totalDiff += new Decimal(r.difference).abs().toNumber()
    }

    // 5. Accounts requiring attention (negative balances, unmapped GL, high unreconciled diff)
    const accountsRequiringAttention: TreasuryDashboardMetrics['accountsRequiringAttention'] = []

    const cashAccounts = await prisma.cashAccount.findMany({
      where: { businessId, isActive: true },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
      },
    })
    for (const ca of cashAccounts) {
      const liveBal = ca.account?.journalLines && ca.account.journalLines.length > 0
        ? ca.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.debitAmount)).minus(new Decimal(l.creditAmount)), new Decimal(0)).toNumber()
        : new Decimal(ca.balance).toNumber()

      if (liveBal < 0) {
        accountsRequiringAttention.push({
          accountId: ca.id,
          accountName: ca.name,
          type: ca.isPettyCash ? 'petty_cash' : 'cash',
          issue: 'Overdrawn / Negative balance detected',
          severity: 'high',
          currentBalance: liveBal,
        })
      } else if (!ca.accountId) {
        accountsRequiringAttention.push({
          accountId: ca.id,
          accountName: ca.name,
          type: ca.isPettyCash ? 'petty_cash' : 'cash',
          issue: 'Missing GL Chart of Account mapping',
          severity: 'medium',
          currentBalance: liveBal,
        })
      }
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
        reconciliations: { where: { status: 'draft' }, take: 1 },
      },
    })
    for (const ba of bankAccounts) {
      const liveBal = ba.account?.journalLines && ba.account.journalLines.length > 0
        ? ba.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.debitAmount)).minus(new Decimal(l.creditAmount)), new Decimal(0)).toNumber()
        : new Decimal(ba.balance).toNumber()

      if (liveBal < 0) {
        accountsRequiringAttention.push({
          accountId: ba.id,
          accountName: `${ba.bankName} - ${ba.accountName}`,
          type: 'bank',
          issue: 'Overdrawn / Negative balance detected',
          severity: 'high',
          currentBalance: liveBal,
        })
      }
      if (ba.reconciliations.length > 0) {
        const rDiff = new Decimal(ba.reconciliations[0].difference).abs().toNumber()
        if (rDiff > 0) {
          accountsRequiringAttention.push({
            accountId: ba.id,
            accountName: `${ba.bankName} - ${ba.accountName}`,
            type: 'bank',
            issue: `Unresolved reconciliation variance ($${rDiff.toFixed(2)})`,
            severity: 'medium',
            currentBalance: liveBal,
          })
        }
      }
    }

    // 6. Recent transfers and reconciliations
    const [recentTransfers, recentReconciliations] = await Promise.all([
      prisma.treasuryTransfer.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.bankReconciliation.findMany({
        where: { businessId },
        include: { bankAccount: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    return {
      businessId,
      totalCashOnHand: totalCash,
      totalBankBalances: totalBank,
      totalPettyCash: totalPetty,
      totalAvailableLiquidity: totalLiquidity,
      unreconciledBankTransactionsCount: unreconciledTxns.length,
      unreconciledBankAmount: unreconciledAmount,
      upcomingInflows30Days: forecast.totalProjectedInflow,
      upcomingOutflows30Days: forecast.totalProjectedOutflow,
      netProjectedCashMovement30Days: forecast.netCashFlow,
      activeReconciliationsCount: openReconciliations.length,
      totalReconciliationDifferences: totalDiff,
      accountsRequiringAttention,
      recentTransfers,
      recentReconciliations,
    }
  }
}
