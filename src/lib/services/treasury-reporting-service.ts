// =============================================================
// Treasury Reporting Service — Multi-Report Engine & Financial Analysis
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { CashPositionService } from './cash-position-service'
import { CashFlowForecastService } from './cash-flow-forecast-service'

export class TreasuryReportingService {
  /**
   * Cash Position Report
   */
  static async getCashPositionReport(businessId: string, asOfDate?: Date) {
    return CashPositionService.getCashPosition({
      businessId,
      asOfDate,
    })
  }

  /**
   * Bank Balance Report
   */
  static async getBankBalanceReport(businessId: string) {
    const accounts = await prisma.bankAccount.findMany({
      where: { businessId },
      include: {
        account: true,
        _count: { select: { transactions: true, statements: true } },
      },
      orderBy: { bankName: 'asc' },
    })

    const summary = accounts.map((acc) => ({
      id: acc.id,
      bankName: acc.bankName,
      accountName: acc.accountName,
      accountNumber: acc.accountNumber,
      iban: acc.iban,
      currency: acc.currencyCode,
      openingBalance: acc.openingBalance.toNumber(),
      currentBalance: acc.balance.toNumber(),
      glAccount: acc.account ? `${acc.account.code} - ${acc.account.name}` : 'Unmapped',
      isActive: acc.isActive,
      transactionCount: acc._count.transactions,
      statementCount: acc._count.statements,
    }))

    return { businessId, generatedAt: new Date(), accounts: summary }
  }

  /**
   * Cash Movement Report (Cash Inflows, Outflows, and Net Change across period)
   */
  static async getCashMovementReport(businessId: string, startDate: Date, endDate: Date) {
    const cashTxns = await prisma.cashTransaction.findMany({
      where: {
        businessId,
        transactionDate: { gte: startDate, lte: endDate },
      },
      include: { cashAccount: true },
      orderBy: { transactionDate: 'asc' },
    })

    const bankTxns = await prisma.bankTransaction.findMany({
      where: {
        businessId,
        transactionDate: { gte: startDate, lte: endDate },
      },
      include: { bankAccount: true },
      orderBy: { transactionDate: 'asc' },
    })

    let totalInflow = 0
    let totalOutflow = 0

    for (const tx of cashTxns) {
      const amt = tx.amount.toNumber()
      if (tx.type === 'deposit') totalInflow += amt
      else totalOutflow += amt
    }

    for (const tx of bankTxns) {
      const amt = tx.amount.toNumber()
      if (tx.type === 'deposit') totalInflow += amt
      else totalOutflow += amt
    }

    return {
      businessId,
      startDate,
      endDate,
      totalInflow,
      totalOutflow,
      netCashMovement: totalInflow - totalOutflow,
      cashTransactionsCount: cashTxns.length,
      bankTransactionsCount: bankTxns.length,
      cashMovements: cashTxns.map((t) => ({
        id: t.id,
        accountName: t.cashAccount.name,
        type: t.type,
        amount: t.amount.toNumber(),
        date: t.transactionDate,
        description: t.description,
        balanceAfter: t.balanceAfter.toNumber(),
      })),
      bankMovements: bankTxns.map((t) => ({
        id: t.id,
        accountName: `${t.bankAccount.bankName} - ${t.bankAccount.accountName}`,
        type: t.type,
        amount: t.amount.toNumber(),
        date: t.transactionDate,
        description: t.description,
        balanceAfter: t.balanceAfter.toNumber(),
      })),
    }
  }

  /**
   * Bank Reconciliation Summary Report
   */
  static async getBankReconciliationReport(businessId: string, reconciliationId: string) {
    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, businessId },
      include: {
        bankAccount: true,
        statement: true,
        matches: { include: { statementLine: true, bankTransaction: true } },
        adjustments: { include: { account: true } },
      },
    })
    if (!reconciliation) {
      throw new Error(`Reconciliation ${reconciliationId} not found.`)
    }

    return {
      reconciliationNumber: reconciliation.reconciliationNumber,
      bankAccount: `${reconciliation.bankAccount.bankName} - ${reconciliation.bankAccount.accountName}`,
      period: { start: reconciliation.periodStart, end: reconciliation.periodEnd },
      statementEndingBalance: reconciliation.statementEndingBalance.toNumber(),
      bookEndingBalance: reconciliation.bookEndingBalance.toNumber(),
      clearedBalance: reconciliation.clearedBalance.toNumber(),
      difference: reconciliation.difference.toNumber(),
      status: reconciliation.status,
      closedAt: reconciliation.closedAt,
      matches: reconciliation.matches.map((m) => ({
        id: m.id,
        type: m.matchType,
        amount: m.matchedAmount.toNumber(),
        statementDescription: m.statementLine.description,
        transactionDescription: m.bankTransaction?.description,
      })),
      adjustments: reconciliation.adjustments.map((a) => ({
        id: a.id,
        type: a.adjustmentType,
        amount: a.amount.toNumber(),
        reason: a.reason,
        glAccount: `${a.account.code} - ${a.account.name}`,
      })),
    }
  }

  /**
   * Unmatched Transactions Report
   */
  static async getUnmatchedTransactionsReport(businessId: string, bankAccountId?: string) {
    const statementWhere: any = { businessId, isMatched: false }
    const bankTxWhere: any = { businessId, isReconciled: false }

    if (bankAccountId) {
      bankTxWhere.bankAccountId = bankAccountId
    }

    const [unmatchedLines, unmatchedTxns] = await Promise.all([
      prisma.bankStatementLine.findMany({
        where: statementWhere,
        include: { statement: { include: { bankAccount: true } } },
        orderBy: { transactionDate: 'desc' },
      }),
      prisma.bankTransaction.findMany({
        where: bankTxWhere,
        include: { bankAccount: true },
        orderBy: { transactionDate: 'desc' },
      }),
    ])

    return {
      businessId,
      unmatchedStatementLinesCount: unmatchedLines.length,
      unmatchedBankTransactionsCount: unmatchedTxns.length,
      unmatchedStatementLines: unmatchedLines.map((l) => ({
        id: l.id,
        bankAccount: `${l.statement.bankAccount.bankName} - ${l.statement.bankAccount.accountName}`,
        statementNumber: l.statement.statementNumber,
        date: l.transactionDate,
        description: l.description,
        amount: l.amount.toNumber(),
        reference: l.reference,
      })),
      unmatchedBankTransactions: unmatchedTxns.map((t) => ({
        id: t.id,
        bankAccount: `${t.bankAccount.bankName} - ${t.bankAccount.accountName}`,
        date: t.transactionDate,
        description: t.description,
        amount: t.amount.toNumber(),
        reference: t.reference,
      })),
    }
  }

  /**
   * Petty Cash Audit Report
   */
  static async getPettyCashReport(businessId: string, cashAccountId?: string) {
    const where: any = { businessId, isPettyCash: true }
    if (cashAccountId) where.id = cashAccountId

    const pettyAccounts = await prisma.cashAccount.findMany({
      where,
      include: {
        custodian: true,
        account: true,
        pettyCashCounts: { orderBy: { countDate: 'desc' }, take: 5, include: { denominations: true } },
      },
    })

    return {
      businessId,
      accounts: pettyAccounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        code: acc.code,
        custodian: acc.custodian ? acc.custodian.fullName : 'None',
        targetFloat: acc.targetFloat ? acc.targetFloat.toNumber() : 0,
        currentBalance: acc.balance.toNumber(),
        glAccount: acc.account ? `${acc.account.code} - ${acc.account.name}` : 'Unmapped',
        recentCounts: acc.pettyCashCounts.map((c) => ({
          countNumber: c.countNumber,
          date: c.countDate,
          countedAmount: c.countedAmount.toNumber(),
          systemAmount: c.systemAmount.toNumber(),
          varianceAmount: c.varianceAmount.toNumber(),
          status: c.status,
        })),
      })),
    }
  }

  /**
   * Bank Fees & Charges Report
   */
  static async getBankFeesReport(businessId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      businessId,
      sourceType: { in: ['bank_fee', 'bank_charge', 'interest_expense'] },
    }
    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = startDate
      if (endDate) where.transactionDate.lte = endDate
    }

    const feeTxns = await prisma.bankTransaction.findMany({
      where,
      include: { bankAccount: true },
      orderBy: { transactionDate: 'desc' },
    })

    let totalFees = 0
    for (const tx of feeTxns) {
      totalFees += tx.amount.toNumber()
    }

    return {
      businessId,
      totalFees,
      feesCount: feeTxns.length,
      feeTransactions: feeTxns.map((t) => ({
        id: t.id,
        bankAccount: `${t.bankAccount.bankName} - ${t.bankAccount.accountName}`,
        date: t.transactionDate,
        type: t.sourceType,
        amount: t.amount.toNumber(),
        description: t.description,
        reference: t.reference,
      })),
    }
  }
}
