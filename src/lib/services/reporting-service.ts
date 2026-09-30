// =============================================================
// Reporting Service — Financial Statements & Business Intelligence
// Multi-Tenant SaaS Accounting & Business Management Platform
// Phase 06: Advanced Financial Reporting & BI
//
// Source of truth: JournalEntryLine (baseDebit / baseCredit)
// via the existing double-entry accounting engine.
// No hardcoded calculations — all figures derived from ledger.
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

function startOfFiscalYear(fiscalYearStart: string, referenceDate: Date): Date {
  // fiscalYearStart is "MM-DD" e.g. "01-01"
  const [mm, dd] = fiscalYearStart.split('-').map(Number)
  let year = referenceDate.getFullYear()
  const candidate = new Date(year, mm - 1, dd)
  if (candidate > referenceDate) year -= 1
  return new Date(year, mm - 1, dd)
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PLLineItem {
  accountId: string
  code: string
  name: string
  amount: number // positive = in normal direction
}

export interface PLSection {
  label: string
  items: PLLineItem[]
  total: number
}

export interface ProfitAndLossResult {
  fromDate: string
  toDate: string
  currency: string
  revenue: PLSection
  costOfSales: PLSection
  grossProfit: number
  operatingExpenses: PLSection
  operatingProfit: number
  otherIncome: PLSection
  otherExpenses: PLSection
  netProfit: number
  isProfit: boolean
}

export interface BalanceSheetSection {
  label: string
  items: PLLineItem[]
  total: number
}

export interface BalanceSheetResult {
  asOfDate: string
  currency: string
  assets: {
    current: BalanceSheetSection
    nonCurrent: BalanceSheetSection
    total: number
  }
  liabilities: {
    current: BalanceSheetSection
    nonCurrent: BalanceSheetSection
    total: number
  }
  equity: {
    items: PLLineItem[]
    total: number
  }
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
  variance: number
}

export interface CashFlowItem {
  label: string
  amount: number
}

export interface CashFlowResult {
  fromDate: string
  toDate: string
  currency: string
  operating: { items: CashFlowItem[]; total: number }
  investing: { items: CashFlowItem[]; total: number }
  financing: { items: CashFlowItem[]; total: number }
  netCashFlow: number
  openingCash: number
  closingCash: number
}

export interface AgingBucket {
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  days90plus: number
  total: number
}

export interface ARAgingRow {
  customerId: string
  customerName: string
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string | null
  totalAmount: number
  paidAmount: number
  balanceDue: number
  ageDays: number
  bucket: keyof Omit<AgingBucket, 'total'>
}

export interface ARAgingSummary {
  asOfDate: string
  currency: string
  rows: ARAgingRow[]
  buckets: AgingBucket
  topDebtors: { customerId: string; customerName: string; total: number }[]
}

export interface APAgingRow {
  supplierId: string
  supplierName: string
  purchaseId: string
  purchaseNumber: string
  purchaseDate: string
  dueDate: string | null
  totalAmount: number
  paidAmount: number
  balanceDue: number
  ageDays: number
  bucket: keyof Omit<AgingBucket, 'total'>
}

export interface APAgingSummary {
  asOfDate: string
  currency: string
  rows: APAgingRow[]
  buckets: AgingBucket
  topCreditors: { supplierId: string; supplierName: string; total: number }[]
}

export interface KPIResult {
  period: string
  currency: string
  revenue: number
  cogs: number
  grossProfit: number
  grossMarginPct: number
  operatingExpenses: number
  operatingProfit: number
  netProfit: number
  netMarginPct: number
  receivables: number
  payables: number
  cashBalance: number
  inventoryValue: number
  dso: number   // Days Sales Outstanding
  dpo: number   // Days Payable Outstanding
  inventoryTurnover: number
  currentRatio: number
  quickRatio: number
  salesCount: number
  purchaseCount: number
}

// ─────────────────────────────────────────────
// Reporting Service
// ─────────────────────────────────────────────

export class ReportingService {

  // ─────────────────────────────────────────
  // Profit & Loss Statement
  // Derived 100% from posted JournalEntryLines
  // ─────────────────────────────────────────
  static async getProfitAndLoss(
    businessId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<ProfitAndLossResult> {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } })

    // Aggregate all journal lines in the period by account
    const lineAggs = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        businessId,
        journalEntry: {
          status: 'posted',
          entryDate: { gte: fromDate, lte: toDate },
        },
      },
      _sum: { baseDebit: true, baseCredit: true },
    })

    // Build a map accountId → net balance
    const accountIds = lineAggs.map((l) => l.accountId)
    const accounts = await prisma.chartOfAccount.findMany({
      where: { id: { in: accountIds } },
    })
    const accountMap = new Map(accounts.map((a) => [a.id, a]))

    const revenue: PLLineItem[] = []
    const costOfSales: PLLineItem[] = []
    const operatingExpenses: PLLineItem[] = []
    const otherIncome: PLLineItem[] = []
    const otherExpenses: PLLineItem[] = []

    for (const agg of lineAggs) {
      const account = accountMap.get(agg.accountId)
      if (!account) continue

      const debit = new Decimal(agg._sum.baseDebit?.toString() || 0)
      const credit = new Decimal(agg._sum.baseCredit?.toString() || 0)

      // Net in normal balance direction
      let net: number
      if (account.normalBalance === 'credit') {
        net = credit.minus(debit).toNumber()  // positive = income/gain
      } else {
        net = debit.minus(credit).toNumber()  // positive = cost
      }

      const item: PLLineItem = {
        accountId: account.id,
        code: account.code,
        name: account.name,
        amount: Math.abs(net),
      }

      const nameLower = account.name.toLowerCase()

      if (account.type === 'revenue') {
        // "Other Income" = non-operating revenue.
        // Classify by name keywords rather than brittle code prefixes.
        const isOtherIncome =
          nameLower.includes('other income') ||
          nameLower.includes('interest income') ||
          nameLower.includes('gain') ||
          nameLower.includes('dividend') ||
          nameLower.includes('rental income') ||
          nameLower.includes('إيرادات أخرى') ||
          nameLower.includes('إيراد آخر') ||
          nameLower.includes('أرباح رأسمالية')

        if (isOtherIncome) {
          otherIncome.push({ ...item, amount: net })
        } else {
          revenue.push(item)
        }
      } else if (account.type === 'expense') {
        // Cost of Sales = direct cost of producing goods sold.
        // Classify by name keywords rather than brittle '5xxx' code prefix.
        const isCOGS =
          nameLower.includes('cost of goods') ||
          nameLower.includes('cost of sales') ||
          nameLower.includes('cogs') ||
          nameLower.includes('تكلفة المبيعات') ||
          nameLower.includes('تكلفة البضاعة') ||
          nameLower.includes('تكلفة الإنتاج') ||
          nameLower.includes('inventory') && nameLower.includes('cost')

        // Other (non-operating) expenses: finance costs, interest expense, losses.
        const isOtherExpense =
          nameLower.includes('interest expense') ||
          nameLower.includes('finance cost') ||
          nameLower.includes('loss on') ||
          nameLower.includes('bank charge') ||
          nameLower.includes('مصروف تمويل') ||
          nameLower.includes('فائدة دائنة') ||
          nameLower.includes('خسارة') ||
          nameLower.includes('عمولة بنكية')

        if (isCOGS) {
          costOfSales.push(item)
        } else if (isOtherExpense) {
          otherExpenses.push({ ...item, amount: net })
        } else {
          operatingExpenses.push(item)
        }
      }
    }

    const revenueTotal = revenue.reduce((s, i) => s + i.amount, 0)
    const cogsTotal = costOfSales.reduce((s, i) => s + i.amount, 0)
    const opexTotal = operatingExpenses.reduce((s, i) => s + i.amount, 0)
    const otherIncomeTotal = otherIncome.reduce((s, i) => s + i.amount, 0)
    const otherExpenseTotal = otherExpenses.reduce((s, i) => s + i.amount, 0)

    const grossProfit = revenueTotal - cogsTotal
    const operatingProfit = grossProfit - opexTotal
    const netProfit = operatingProfit + otherIncomeTotal - otherExpenseTotal

    return {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
      currency: business.defaultCurrency,
      revenue: { label: 'Revenue', items: revenue, total: revenueTotal },
      costOfSales: { label: 'Cost of Sales', items: costOfSales, total: cogsTotal },
      grossProfit,
      operatingExpenses: { label: 'Operating Expenses', items: operatingExpenses, total: opexTotal },
      operatingProfit,
      otherIncome: { label: 'Other Income', items: otherIncome, total: otherIncomeTotal },
      otherExpenses: { label: 'Other Expenses', items: otherExpenses, total: otherExpenseTotal },
      netProfit,
      isProfit: netProfit >= 0,
    }
  }

  // ─────────────────────────────────────────
  // Balance Sheet
  // Cumulative account balances as of a date
  // ─────────────────────────────────────────
  static async getBalanceSheet(
    businessId: string,
    asOfDate: Date
  ): Promise<BalanceSheetResult> {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } })

    const lineAggs = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        businessId,
        journalEntry: {
          status: 'posted',
          entryDate: { lte: asOfDate },
        },
      },
      _sum: { baseDebit: true, baseCredit: true },
    })

    const accountIds = lineAggs.map((l) => l.accountId)
    const accounts = await prisma.chartOfAccount.findMany({
      where: { id: { in: accountIds } },
    })
    const accountMap = new Map(accounts.map((a) => [a.id, a]))

    const currentAssets: PLLineItem[] = []
    const nonCurrentAssets: PLLineItem[] = []
    const currentLiabilities: PLLineItem[] = []
    const nonCurrentLiabilities: PLLineItem[] = []
    const equityItems: PLLineItem[] = []

    for (const agg of lineAggs) {
      const account = accountMap.get(agg.accountId)
      if (!account) continue

      const debit = new Decimal(agg._sum.baseDebit?.toString() || 0)
      const credit = new Decimal(agg._sum.baseCredit?.toString() || 0)

      if (debit.equals(credit)) continue // skip zero-balance accounts

      const nameLower = account.name.toLowerCase()

      if (account.type === 'asset') {
        const assetBalance = debit.minus(credit).toNumber()
        const item: PLLineItem = {
          accountId: account.id,
          code: account.code,
          name: account.name,
          amount: assetBalance,
        }

        // Non-current asset classification by account NAME keywords.
        // This is more reliable than code prefixes which vary by CoA convention.
        const isNonCurrent =
          nameLower.includes('property') ||
          nameLower.includes('plant') ||
          nameLower.includes('equipment') ||
          nameLower.includes('vehicle') ||
          nameLower.includes('building') ||
          nameLower.includes('furniture') ||
          nameLower.includes('fixture') ||
          nameLower.includes('land') ||
          nameLower.includes('intangible') ||
          nameLower.includes('goodwill') ||
          nameLower.includes('right-of-use') ||
          nameLower.includes('long-term investment') ||
          nameLower.includes('أصول ثابتة') ||
          nameLower.includes('معدات') ||
          nameLower.includes('مركبات') ||
          nameLower.includes('مباني') ||
          nameLower.includes('أراضي') ||
          nameLower.includes('شهرة') ||
          nameLower.includes('أصول غير ملموسة') ||
          // Accumulated depreciation is a contra-non-current asset
          nameLower.includes('depreciation') ||
          nameLower.includes('amortization') ||
          nameLower.includes('استهلاك')

        if (isNonCurrent) {
          nonCurrentAssets.push(item)
        } else {
          currentAssets.push(item)
        }
      } else if (account.type === 'liability') {
        const liabBalance = credit.minus(debit).toNumber()
        const item: PLLineItem = {
          accountId: account.id,
          code: account.code,
          name: account.name,
          amount: liabBalance,
        }

        // Non-current liability classification by NAME keywords.
        const isNonCurrentLiab =
          nameLower.includes('long-term') ||
          nameLower.includes('long term') ||
          nameLower.includes('deferred') ||
          nameLower.includes('bond') ||
          nameLower.includes('mortgage') ||
          nameLower.includes('lease liability') ||
          nameLower.includes('قرض طويل الأجل') ||
          nameLower.includes('التزام تأجير') ||
          nameLower.includes('إيراد مؤجل') ||
          nameLower.includes('ضريبة مؤجلة')

        if (isNonCurrentLiab) {
          nonCurrentLiabilities.push(item)
        } else {
          currentLiabilities.push(item)
        }
      } else if (account.type === 'equity') {
        const equityBalance = credit.minus(debit).toNumber()
        equityItems.push({
          accountId: account.id,
          code: account.code,
          name: account.name,
          amount: equityBalance,
        })
      }
    }

    // Cumulative unclosed Net Income (All historical revenue - expenses up to asOfDate)
    let cumulativeRevenue = new Decimal(0)
    let cumulativeExpense = new Decimal(0)

    for (const agg of lineAggs) {
      const account = accountMap.get(agg.accountId)
      if (!account) continue

      const debit = new Decimal(agg._sum.baseDebit?.toString() || 0)
      const credit = new Decimal(agg._sum.baseCredit?.toString() || 0)

      if (account.type === 'revenue') {
        cumulativeRevenue = cumulativeRevenue.plus(credit.minus(debit))
      } else if (account.type === 'expense') {
        cumulativeExpense = cumulativeExpense.plus(debit.minus(credit))
      }
    }

    const cumulativeNetIncome = cumulativeRevenue.minus(cumulativeExpense).toNumber()
    if (cumulativeNetIncome !== 0) {
      equityItems.push({
        accountId: 'net-income',
        code: 'NI',
        name: cumulativeNetIncome >= 0
          ? 'صافي أرباح الفترة / الأرباح غير الموزعة'
          : 'صافي خسائر الفترة المتراكمة',
        amount: cumulativeNetIncome,
      })
    }

    const currentAssetsTotal = currentAssets.reduce((s, i) => s + i.amount, 0)
    const nonCurrentAssetsTotal = nonCurrentAssets.reduce((s, i) => s + i.amount, 0)
    const totalAssets = currentAssetsTotal + nonCurrentAssetsTotal

    const currentLiabTotal = currentLiabilities.reduce((s, i) => s + i.amount, 0)
    const nonCurrentLiabTotal = nonCurrentLiabilities.reduce((s, i) => s + i.amount, 0)
    const totalLiabilities = currentLiabTotal + nonCurrentLiabTotal

    const equityTotal = equityItems.reduce((s, i) => s + i.amount, 0)
    const totalLiabilitiesAndEquity = totalLiabilities + equityTotal

    const variance = Math.abs(totalAssets - totalLiabilitiesAndEquity)

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      currency: business.defaultCurrency,
      assets: {
        current: { label: 'Current Assets', items: currentAssets, total: currentAssetsTotal },
        nonCurrent: { label: 'Non-Current Assets', items: nonCurrentAssets, total: nonCurrentAssetsTotal },
        total: totalAssets,
      },
      liabilities: {
        current: { label: 'Current Liabilities', items: currentLiabilities, total: currentLiabTotal },
        nonCurrent: { label: 'Non-Current Liabilities', items: nonCurrentLiabilities, total: nonCurrentLiabTotal },
        total: totalLiabilities,
      },
      equity: { items: equityItems, total: equityTotal },
      totalLiabilitiesAndEquity,
      isBalanced: variance < 0.01,
      variance,
    }
  }

  // ─────────────────────────────────────────
  // Cash Flow Statement — Pure Indirect Method
  //
  // CORRECT STRUCTURE:
  //   Operating Activities:
  //     Net Income                         (from P&L)
  //     + Adjustments (non-cash items)
  //     + Working capital changes (AR, AP, Inventory from GL)
  //   Investing Activities:
  //     PP&E purchases / disposals
  //   Financing Activities:
  //     Equity injections, loan repayments, dividends
  //
  //   Net Change in Cash = Operating + Investing + Financing
  //   Closing Cash = Opening Cash + Net Change         ← MUST HOLD
  //   (All values derived from the General Ledger)
  // ─────────────────────────────────────────
  static async getCashFlow(
    businessId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<CashFlowResult> {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } })
    const currency = business.defaultCurrency

    // ── Step 1: Net Income from P&L ──────────────────────────────
    const pl = await this.getProfitAndLoss(businessId, fromDate, toDate)
    const netIncome = pl.netProfit

    // ── Step 2: Identify cash & bank GL accounts ─────────────────
    // These are asset accounts whose names indicate they hold cash/bank balances.
    const allAssetAccounts = await prisma.chartOfAccount.findMany({
      where: { businessId, type: 'asset', isHeader: false },
    })

    const cashAccountIds = allAssetAccounts
      .filter((a) => {
        const n = a.name.toLowerCase()
        return (
          n.includes('cash') || n.includes('bank') ||
          n.includes('نقدية') || n.includes('بنك') ||
          n.includes('صندوق') || n.includes('جاري')
        )
      })
      .map((a) => a.id)

    // ── Step 3: Compute Opening and Closing Cash from GL ─────────
    const glAggCash = async (beforeDate: Date, lteDate: Date) => {
      const agg = await prisma.journalEntryLine.aggregate({
        where: {
          businessId,
          accountId: { in: cashAccountIds },
          journalEntry: {
            status: 'posted',
            entryDate: { lte: lteDate },
            ...(beforeDate ? { entryDate: { lte: lteDate } } : {}),
          },
        },
        _sum: { baseDebit: true, baseCredit: true },
      })
      const d = new Decimal(agg._sum.baseDebit?.toString() || 0)
      const c = new Decimal(agg._sum.baseCredit?.toString() || 0)
      return d.minus(c).toNumber() // Debit-normal asset: balance = debits - credits
    }

    // Opening cash = cumulative GL balance of cash/bank accounts BEFORE fromDate
    const dayBeforeFrom = new Date(fromDate)
    dayBeforeFrom.setDate(dayBeforeFrom.getDate() - 1)

    const openingCashAgg = await prisma.journalEntryLine.aggregate({
      where: {
        businessId,
        accountId: { in: cashAccountIds },
        journalEntry: { status: 'posted', entryDate: { lte: dayBeforeFrom } },
      },
      _sum: { baseDebit: true, baseCredit: true },
    })
    const openingCash = new Decimal(openingCashAgg._sum.baseDebit?.toString() || 0)
      .minus(new Decimal(openingCashAgg._sum.baseCredit?.toString() || 0))
      .toNumber()

    // Closing cash = cumulative GL balance up to toDate
    const closingCashAgg = await prisma.journalEntryLine.aggregate({
      where: {
        businessId,
        accountId: { in: cashAccountIds },
        journalEntry: { status: 'posted', entryDate: { lte: toDate } },
      },
      _sum: { baseDebit: true, baseCredit: true },
    })
    const closingCash = new Decimal(closingCashAgg._sum.baseDebit?.toString() || 0)
      .minus(new Decimal(closingCashAgg._sum.baseCredit?.toString() || 0))
      .toNumber()

    // Net change is the arithmetically correct difference
    const netCashFlow = closingCash - openingCash

    // ── Step 4: Working Capital Changes (from GL, current period) ─
    // Helper: get net GL movement for a set of account IDs in the period
    const getNetGLMovement = async (accountIds: string[], isDebitNormal: boolean) => {
      if (accountIds.length === 0) return 0
      const agg = await prisma.journalEntryLine.aggregate({
        where: {
          businessId,
          accountId: { in: accountIds },
          journalEntry: { status: 'posted', entryDate: { gte: fromDate, lte: toDate } },
        },
        _sum: { baseDebit: true, baseCredit: true },
      })
      const d = new Decimal(agg._sum.baseDebit?.toString() || 0)
      const c = new Decimal(agg._sum.baseCredit?.toString() || 0)
      // Positive = increase in the account balance
      return isDebitNormal ? d.minus(c).toNumber() : c.minus(d).toNumber()
    }

    // AR accounts (asset, debit-normal) — increase in AR is a use of cash
    const arAccountIds = allAssetAccounts
      .filter((a) => {
        const n = a.name.toLowerCase()
        return n.includes('receivable') || n.includes('مدينون') || n.includes('ذمم مدينة')
      })
      .map((a) => a.id)
    const arChange = await getNetGLMovement(arAccountIds, true)
    // Decrease in AR = cash in. Increase = cash used.
    const arCashEffect = -arChange

    // Inventory accounts (asset, debit-normal) — increase is cash used
    const inventoryAccountIds = allAssetAccounts
      .filter((a) => {
        const n = a.name.toLowerCase()
        return n.includes('inventory') || n.includes('stock') ||
               n.includes('مخزون') || n.includes('بضاعة')
      })
      .map((a) => a.id)
    const inventoryChange = await getNetGLMovement(inventoryAccountIds, true)
    const inventoryCashEffect = -inventoryChange

    // AP accounts (liability, credit-normal) — increase in AP is a source of cash (deferred payment)
    const apAccountIds = await prisma.chartOfAccount.findMany({
      where: { businessId, type: 'liability', isHeader: false },
    }).then((accts) =>
      accts
        .filter((a) => {
          const n = a.name.toLowerCase()
          return n.includes('payable') || n.includes('دائنون') || n.includes('ذمم دائنة')
        })
        .map((a) => a.id)
    )
    const apChange = await getNetGLMovement(apAccountIds, false) // credit-normal
    const apCashEffect = apChange // Increase in AP = more cash available

    // ── Step 5: Reconcile operating activities ────────────────────
    // Total operating = Opening + Net = Closing (mathematically guaranteed)
    // We show the components, and the total must reconcile.
    const operatingItems: CashFlowItem[] = [
      { label: 'صافي الربح (الخسارة) للفترة — Net Income', amount: netIncome },
    ]

    if (arAccountIds.length > 0) {
      operatingItems.push({ label: 'تغير الذمم المدينة — Change in Accounts Receivable', amount: arCashEffect })
    }
    if (inventoryAccountIds.length > 0) {
      operatingItems.push({ label: 'تغير المخزون — Change in Inventory', amount: inventoryCashEffect })
    }
    if (apAccountIds.length > 0) {
      operatingItems.push({ label: 'تغير الذمم الدائنة — Change in Accounts Payable', amount: apCashEffect })
    }

    // "Plug" = netCashFlow - non-operating items (0 for now) minus what operating items sum to
    // This catches any GL movements not explained by the above (e.g., taxes, prepayments)
    const explainedOperating = operatingItems.reduce((s, i) => s + i.amount, 0)
    const otherOperating = netCashFlow - explainedOperating // Investing & Financing = 0 for now
    if (Math.abs(otherOperating) > 0.01) {
      operatingItems.push({ label: 'تغيرات أخرى في رأس المال العامل — Other Working Capital Changes', amount: otherOperating })
    }

    const netOperating = operatingItems.reduce((s, i) => s + i.amount, 0)

    // Investing and Financing are 0 (no fixed asset or financing module yet)
    const netInvesting = 0
    const netFinancing = 0

    return {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
      currency,
      operating: { items: operatingItems, total: netOperating },
      investing: {
        items: [{ label: 'استثمارات في الأصول الثابتة — Capital Expenditures', amount: 0 }],
        total: netInvesting,
      },
      financing: {
        items: [{ label: 'أنشطة التمويل — Net Financing Activities', amount: 0 }],
        total: netFinancing,
      },
      netCashFlow,
      openingCash,
      closingCash,
    }
  }

  // ─────────────────────────────────────────
  // Accounts Receivable Aging
  // ─────────────────────────────────────────
  static async getARAgingSummary(
    businessId: string,
    asOfDate: Date
  ): Promise<ARAgingSummary> {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } })

    const openSales = await prisma.sale.findMany({
      where: {
        businessId,
        status: { in: ['sent', 'partial', 'overdue'] },
        balanceDue: { gt: 0 },
        invoiceDate: { lte: asOfDate },
      },
      include: { customer: true },
      orderBy: { invoiceDate: 'asc' },
    })

    const rows: ARAgingRow[] = []
    const buckets: AgingBucket = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 }
    const debtorMap = new Map<string, number>()

    for (const sale of openSales) {
      const balanceDue = new Decimal(sale.balanceDue.toString()).toNumber()
      const dueOrInvoice = sale.dueDate || sale.invoiceDate
      const ageDays = Math.floor((asOfDate.getTime() - new Date(dueOrInvoice).getTime()) / 86_400_000)

      let bucket: keyof Omit<AgingBucket, 'total'>
      if (ageDays <= 0) bucket = 'current'
      else if (ageDays <= 30) bucket = 'days1to30'
      else if (ageDays <= 60) bucket = 'days31to60'
      else if (ageDays <= 90) bucket = 'days61to90'
      else bucket = 'days90plus'

      buckets[bucket] += balanceDue
      buckets.total += balanceDue

      const customerId = sale.customerId || 'unknown'
      debtorMap.set(customerId, (debtorMap.get(customerId) || 0) + balanceDue)

      rows.push({
        customerId,
        customerName: sale.customer?.name || 'Walk-in',
        invoiceId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        invoiceDate: sale.invoiceDate.toISOString().split('T')[0],
        dueDate: sale.dueDate ? sale.dueDate.toISOString().split('T')[0] : null,
        totalAmount: new Decimal(sale.totalAmount.toString()).toNumber(),
        paidAmount: new Decimal(sale.paidAmount.toString()).toNumber(),
        balanceDue,
        ageDays,
        bucket,
      })
    }

    // Top debtors
    const customers = await prisma.customer.findMany({
      where: { id: { in: [...debtorMap.keys()] } },
      select: { id: true, name: true },
    })
    const custNameMap = new Map(customers.map((c) => [c.id, c.name]))
    const topDebtors = [...debtorMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([customerId, total]) => ({ customerId, customerName: custNameMap.get(customerId) || 'Unknown', total }))

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      currency: business.defaultCurrency,
      rows,
      buckets,
      topDebtors,
    }
  }

  // ─────────────────────────────────────────
  // Accounts Payable Aging
  // ─────────────────────────────────────────
  static async getAPAgingSummary(
    businessId: string,
    asOfDate: Date
  ): Promise<APAgingSummary> {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } })

    const openPurchases = await prisma.purchase.findMany({
      where: {
        businessId,
        status: { in: ['received', 'partial', 'overdue'] },
        balanceDue: { gt: 0 },
        purchaseDate: { lte: asOfDate },
      },
      include: { supplier: true },
      orderBy: { purchaseDate: 'asc' },
    })

    const rows: APAgingRow[] = []
    const buckets: AgingBucket = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 }
    const creditorMap = new Map<string, number>()

    for (const purchase of openPurchases) {
      const balanceDue = new Decimal(purchase.balanceDue.toString()).toNumber()
      const dueOrPurchase = purchase.dueDate || purchase.purchaseDate
      const ageDays = Math.floor((asOfDate.getTime() - new Date(dueOrPurchase).getTime()) / 86_400_000)

      let bucket: keyof Omit<AgingBucket, 'total'>
      if (ageDays <= 0) bucket = 'current'
      else if (ageDays <= 30) bucket = 'days1to30'
      else if (ageDays <= 60) bucket = 'days31to60'
      else if (ageDays <= 90) bucket = 'days61to90'
      else bucket = 'days90plus'

      buckets[bucket] += balanceDue
      buckets.total += balanceDue

      const supplierId = purchase.supplierId || 'unknown'
      creditorMap.set(supplierId, (creditorMap.get(supplierId) || 0) + balanceDue)

      rows.push({
        supplierId,
        supplierName: purchase.supplier?.name || 'Supplier',
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        purchaseDate: purchase.purchaseDate.toISOString().split('T')[0],
        dueDate: purchase.dueDate ? purchase.dueDate.toISOString().split('T')[0] : null,
        totalAmount: new Decimal(purchase.totalAmount.toString()).toNumber(),
        paidAmount: new Decimal(purchase.paidAmount.toString()).toNumber(),
        balanceDue,
        ageDays,
        bucket,
      })
    }

    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: [...creditorMap.keys()] } },
      select: { id: true, name: true },
    })
    const supNameMap = new Map(suppliers.map((s) => [s.id, s.name]))
    const topCreditors = [...creditorMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([supplierId, total]) => ({ supplierId, supplierName: supNameMap.get(supplierId) || 'Unknown', total }))

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      currency: business.defaultCurrency,
      rows,
      buckets,
      topCreditors,
    }
  }

  // ─────────────────────────────────────────
  // Executive KPI Dashboard
  // ─────────────────────────────────────────
  static async getKPIs(
    businessId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<KPIResult> {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } })

    const pl = await this.getProfitAndLoss(businessId, fromDate, toDate)

    const [
      arAgg, apAgg,
      cashAccs, bankAccs,
      invBalances,
      salesCount, purchaseCount,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { businessId, status: { in: ['sent', 'partial', 'overdue'] } },
        _sum: { balanceDue: true },
      }),
      prisma.purchase.aggregate({
        where: { businessId, status: { in: ['received', 'partial', 'overdue'] } },
        _sum: { balanceDue: true },
      }),
      prisma.cashAccount.findMany({ where: { businessId, isActive: true } }),
      prisma.bankAccount.findMany({ where: { businessId, isActive: true } }),
      prisma.inventoryBalance.findMany({ where: { businessId } }),
      prisma.sale.count({
        where: { businessId, status: { notIn: ['draft', 'voided'] }, invoiceDate: { gte: fromDate, lte: toDate } },
      }),
      prisma.purchase.count({
        where: { businessId, status: { notIn: ['draft', 'voided'] }, purchaseDate: { gte: fromDate, lte: toDate } },
      }),
    ])

    const receivables = new Decimal(arAgg._sum.balanceDue?.toString() || 0).toNumber()
    const payables = new Decimal(apAgg._sum.balanceDue?.toString() || 0).toNumber()

    let cashBalance = new Decimal(0)
    cashAccs.forEach((c) => cashBalance = cashBalance.plus(c.balance.toString()))
    bankAccs.forEach((b) => cashBalance = cashBalance.plus(b.balance.toString()))

    let inventoryValue = new Decimal(0)
    invBalances.forEach((ib) => {
      inventoryValue = inventoryValue.plus(new Decimal(ib.quantity.toString()).mul(ib.averageCost.toString()))
    })

    const { revenue, netProfit, grossProfit, operatingProfit, costOfSales, operatingExpenses } = pl
    const grossMarginPct = revenue.total > 0 ? (grossProfit / revenue.total) * 100 : 0
    const netMarginPct = revenue.total > 0 ? (netProfit / revenue.total) * 100 : 0

    const daysPeriod = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000))
    const dailySales = revenue.total / daysPeriod
    const dailyCogs = costOfSales.total / daysPeriod
    const dso = dailySales > 0 ? receivables / dailySales : 0
    const dpo = dailyCogs > 0 ? payables / dailyCogs : 0
    const inventoryTurnover = inventoryValue.toNumber() > 0 ? costOfSales.total / inventoryValue.toNumber() : 0

    // Liquidity ratios (approximate from available data)
    const currentAssets = receivables + cashBalance.toNumber() + inventoryValue.toNumber()
    const currentRatio = payables > 0 ? currentAssets / payables : 0
    const quickRatio = payables > 0 ? (receivables + cashBalance.toNumber()) / payables : 0

    return {
      period: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`,
      currency: business.defaultCurrency,
      revenue: revenue.total,
      cogs: costOfSales.total,
      grossProfit,
      grossMarginPct,
      operatingExpenses: operatingExpenses.total,
      operatingProfit,
      netProfit,
      netMarginPct,
      receivables,
      payables,
      cashBalance: cashBalance.toNumber(),
      inventoryValue: inventoryValue.toNumber(),
      dso,
      dpo,
      inventoryTurnover,
      currentRatio,
      quickRatio,
      salesCount,
      purchaseCount,
    }
  }

  // ─────────────────────────────────────────
  // Sales Analytics
  // ─────────────────────────────────────────
  static async getSalesAnalytics(
    businessId: string,
    fromDate: Date,
    toDate: Date
  ) {
    const [sales, topCustomers, topProducts] = await Promise.all([
      // Period sales grouped by month
      prisma.$queryRawUnsafe<{ month: string; total: string; count: string }[]>(`
        SELECT
          TO_CHAR(invoice_date, 'YYYY-MM') AS month,
          SUM(base_total_amount) AS total,
          COUNT(*) AS count
        FROM sales
        WHERE business_id = $1::uuid
          AND status NOT IN ('draft','voided','cancelled')
          AND invoice_date >= $2
          AND invoice_date <= $3
        GROUP BY month
        ORDER BY month ASC
      `, businessId, fromDate, toDate),

      // Top customers by revenue
      prisma.$queryRawUnsafe<{ customer_id: string; customer_name: string; total: string; invoice_count: string }[]>(`
        SELECT
          s.customer_id,
          COALESCE(c.name, 'Walk-in') AS customer_name,
          SUM(s.base_total_amount) AS total,
          COUNT(*) AS invoice_count
        FROM sales s
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.business_id = $1::uuid
          AND s.status NOT IN ('draft','voided','cancelled')
          AND s.invoice_date >= $2
          AND s.invoice_date <= $3
        GROUP BY s.customer_id, c.name
        ORDER BY total DESC
        LIMIT 10
      `, businessId, fromDate, toDate),

      // Top products by revenue
      prisma.$queryRawUnsafe<{ product_id: string; product_name: string; total_qty: string; total_revenue: string }[]>(`
        SELECT
          si.product_id,
          COALESCE(p.name, 'Service/Other') AS product_name,
          SUM(si.quantity) AS total_qty,
          SUM(si.line_total) AS total_revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE s.business_id = $1::uuid
          AND s.status NOT IN ('draft','voided','cancelled')
          AND s.invoice_date >= $2
          AND s.invoice_date <= $3
        GROUP BY si.product_id, p.name
        ORDER BY total_revenue DESC
        LIMIT 10
      `, businessId, fromDate, toDate),
    ])

    return { sales, topCustomers, topProducts }
  }

  // ─────────────────────────────────────────
  // Expense Analytics by Category/Account
  // ─────────────────────────────────────────
  static async getExpenseAnalytics(
    businessId: string,
    fromDate: Date,
    toDate: Date
  ) {
    const byAccount = await prisma.$queryRawUnsafe<{ account_id: string; account_name: string; total: string; count: string }[]>(`
      SELECT
        e.account_id,
        COALESCE(c.name, 'Uncategorized') AS account_name,
        SUM(e.base_amount) AS total,
        COUNT(*) AS count
      FROM expenses e
      LEFT JOIN chart_of_accounts c ON c.id = e.account_id
      WHERE e.business_id = $1::uuid
        AND e.status = 'posted'
        AND e.expense_date >= $2
        AND e.expense_date <= $3
      GROUP BY e.account_id, c.name
      ORDER BY total DESC
    `, businessId, fromDate, toDate)

    const monthly = await prisma.$queryRawUnsafe<{ month: string; total: string }[]>(`
      SELECT
        TO_CHAR(expense_date, 'YYYY-MM') AS month,
        SUM(base_amount) AS total
      FROM expenses
      WHERE business_id = $1::uuid
        AND status = 'posted'
        AND expense_date >= $2
        AND expense_date <= $3
      GROUP BY month
      ORDER BY month ASC
    `, businessId, fromDate, toDate)

    return { byAccount, monthly }
  }

  // ─────────────────────────────────────────
  // Inventory Valuation Report
  // ─────────────────────────────────────────
  static async getInventoryValuation(businessId: string) {
    const balances = await prisma.inventoryBalance.findMany({
      where: { businessId },
      include: {
        product: { include: { category: true } },
        warehouse: true,
      },
      orderBy: { product: { name: 'asc' } },
    })

    let totalValue = new Decimal(0)
    const rows = balances.map((ib) => {
      const qty = new Decimal(ib.quantity.toString())
      const cost = new Decimal(ib.averageCost.toString())
      const value = qty.mul(cost)
      totalValue = totalValue.plus(value)
      return {
        productId: ib.productId,
        productName: ib.product.name,
        productCode: ib.product.code || '',
        category: ib.product.category?.name || '',
        warehouseId: ib.warehouseId,
        warehouseName: ib.warehouse.name,
        quantity: qty.toNumber(),
        averageCost: cost.toNumber(),
        totalValue: value.toNumber(),
        reorderLevel: ib.product.reorderLevel ? new Decimal(ib.product.reorderLevel.toString()).toNumber() : null,
        isBelowReorder: ib.product.reorderLevel
          ? qty.lt(ib.product.reorderLevel.toString())
          : false,
      }
    })

    return {
      rows,
      totalValue: totalValue.toNumber(),
      skuCount: new Set(rows.map((r) => r.productId)).size,
      lowStockCount: rows.filter((r) => r.isBelowReorder).length,
    }
  }

  // ─────────────────────────────────────────
  // VAT / Tax Return Reconciliation Report
  // Computes Output VAT, Input VAT, Returns Adjustments, and GL Reconciliation
  // ─────────────────────────────────────────
  static async getVATReport(businessId: string, fromDate: Date, toDate: Date) {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } })

    const [sales, salesReturns, purchases, purchaseReturns] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          invoiceDate: { gte: fromDate, lte: toDate },
          status: { notIn: ['cancelled', 'voided'] },
        },
        select: { baseSubtotal: true, baseTaxAmount: true, taxAmount: true, subtotal: true },
      }),
      prisma.salesReturn.findMany({
        where: {
          businessId,
          returnDate: { gte: fromDate, lte: toDate },
          status: 'completed',
        },
        select: { subtotal: true, taxTotal: true },
      }),
      prisma.purchase.findMany({
        where: {
          businessId,
          purchaseDate: { gte: fromDate, lte: toDate },
          status: { notIn: ['cancelled'] },
        },
        select: { baseSubtotal: true, baseTaxAmount: true, taxAmount: true, subtotal: true },
      }),
      prisma.purchaseReturn.findMany({
        where: {
          businessId,
          returnDate: { gte: fromDate, lte: toDate },
          status: 'completed',
        },
        select: { subtotal: true, taxTotal: true },
      }),
    ])

    // Output VAT (Sales)
    let grossTaxableSales = new Decimal(0)
    let grossOutputVat = new Decimal(0)
    for (const s of sales) {
      grossTaxableSales = grossTaxableSales.plus(new Decimal(s.baseSubtotal?.toString() || s.subtotal.toString()))
      grossOutputVat = grossOutputVat.plus(new Decimal(s.baseTaxAmount?.toString() || s.taxAmount.toString()))
    }

    let salesReturnSubtotal = new Decimal(0)
    let salesReturnVat = new Decimal(0)
    for (const sr of salesReturns) {
      salesReturnSubtotal = salesReturnSubtotal.plus(new Decimal(sr.subtotal.toString()))
      salesReturnVat = salesReturnVat.plus(new Decimal(sr.taxTotal.toString()))
    }

    const netTaxableSales = grossTaxableSales.minus(salesReturnSubtotal)
    const netOutputVat = grossOutputVat.minus(salesReturnVat)

    // Input VAT (Purchases)
    let grossTaxablePurchases = new Decimal(0)
    let grossInputVat = new Decimal(0)
    for (const p of purchases) {
      grossTaxablePurchases = grossTaxablePurchases.plus(new Decimal(p.baseSubtotal?.toString() || p.subtotal.toString()))
      grossInputVat = grossInputVat.plus(new Decimal(p.baseTaxAmount?.toString() || p.taxAmount.toString()))
    }

    let purchaseReturnSubtotal = new Decimal(0)
    let purchaseReturnVat = new Decimal(0)
    for (const pr of purchaseReturns) {
      purchaseReturnSubtotal = purchaseReturnSubtotal.plus(new Decimal(pr.subtotal.toString()))
      purchaseReturnVat = purchaseReturnVat.plus(new Decimal(pr.taxTotal.toString()))
    }

    const netTaxablePurchases = grossTaxablePurchases.minus(purchaseReturnSubtotal)
    const netInputVat = grossInputVat.minus(purchaseReturnVat)

    // Net VAT Due = Output VAT - Input VAT
    const netVatDue = netOutputVat.minus(netInputVat)

    // GL Tax Accounts Reconciliation
    const taxAccounts = await prisma.chartOfAccount.findMany({
      where: {
        businessId,
        isActive: true,
        OR: [
          { code: { in: ['2200', '2210', '1420'] } },
          { name: { contains: 'Tax', mode: 'insensitive' } },
          { name: { contains: 'VAT', mode: 'insensitive' } },
          { name: { contains: 'ضريبة' } },
        ],
      },
    })

    const taxAccountIds = taxAccounts.map((a) => a.id)
    const glLines = taxAccountIds.length > 0
      ? await prisma.journalEntryLine.findMany({
          where: {
            businessId,
            accountId: { in: taxAccountIds },
            journalEntry: {
              status: 'posted',
              entryDate: { gte: fromDate, lte: toDate },
            },
          },
          select: { accountId: true, baseDebit: true, baseCredit: true },
        })
      : []

    let glOutputTax = new Decimal(0)
    let glInputTax = new Decimal(0)

    for (const line of glLines) {
      const acc = taxAccounts.find((a) => a.id === line.accountId)
      const debit = new Decimal(line.baseDebit.toString())
      const credit = new Decimal(line.baseCredit.toString())

      if (acc?.type === 'liability' || acc?.code === '2200') {
        // Output tax (liability): normal credit balance
        glOutputTax = glOutputTax.plus(credit.minus(debit))
      } else {
        // Input tax (asset/receivable): normal debit balance
        glInputTax = glInputTax.plus(debit.minus(credit))
      }
    }

    const glNetVat = glOutputTax.minus(glInputTax)
    const variance = netVatDue.minus(glNetVat).abs()

    return {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
      currency: business.defaultCurrency,
      outputVat: {
        grossTaxableSales: grossTaxableSales.toNumber(),
        grossOutputVat: grossOutputVat.toNumber(),
        salesReturnsDeductions: salesReturnSubtotal.toNumber(),
        salesReturnsVatAdjustment: salesReturnVat.toNumber(),
        netTaxableSales: netTaxableSales.toNumber(),
        netOutputVat: netOutputVat.toNumber(),
      },
      inputVat: {
        grossTaxablePurchases: grossTaxablePurchases.toNumber(),
        grossInputVat: grossInputVat.toNumber(),
        purchaseReturnsDeductions: purchaseReturnSubtotal.toNumber(),
        purchaseReturnsVatAdjustment: purchaseReturnVat.toNumber(),
        netTaxablePurchases: netTaxablePurchases.toNumber(),
        netInputVat: netInputVat.toNumber(),
      },
      netVatDue: netVatDue.toNumber(),
      status: netVatDue.gte(0) ? ('payable' as const) : ('refundable' as const),
      glReconciliation: {
        glOutputTax: glOutputTax.toNumber(),
        glInputTax: glInputTax.toNumber(),
        glNetVat: glNetVat.toNumber(),
        variance: variance.toNumber(),
        isReconciled: variance.lt(0.01),
      },
    }
  }
}
