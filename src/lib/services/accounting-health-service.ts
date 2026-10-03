import { prisma } from '@/lib/db/prisma'
import { Decimal } from 'decimal.js'
import { AccountingService } from './accounting-service'
import { ReportingService } from './reporting-service'
import { DocumentNumberingService } from './document-numbering-service'

export interface DiagnosticIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  category:
    | 'unbalanced_entry'
    | 'unlinked_sale'
    | 'unlinked_purchase'
    | 'unlinked_payment'
    | 'unlinked_expense'
    | 'unlinked_transfer'
    | 'coa_config'
    | 'balance_sheet_mismatch'
  titleAr: string
  titleEn: string
  descriptionAr: string
  descriptionEn: string
  documentRef?: string
  amount?: number
  canAutoFix: boolean
}

export interface AccountingHealthReport {
  timestamp: string
  businessId: string
  businessName: string
  isHealthy: boolean
  healthScore: number // 0 - 100
  trialBalance: {
    totalDebit: number
    totalCredit: number
    isBalanced: boolean
    variance: number
  }
  balanceSheet: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    totalLiabilitiesAndEquity: number
    isBalanced: boolean
    variance: number
  }
  stats: {
    totalJournalEntries: number
    unbalancedEntriesCount: number
    unlinkedSalesCount: number
    unlinkedPurchasesCount: number
    unlinkedPaymentsCount: number
    unlinkedExpensesCount: number
    unlinkedTransfersCount: number
  }
  issues: DiagnosticIssue[]
}

export class AccountingHealthService {
  /**
   * Run a deep diagnostic health check on all ledgers and operational sub-modules.
   */
  static async runComprehensiveDiagnostic(businessId: string): Promise<AccountingHealthReport> {
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
    })

    const issues: DiagnosticIssue[] = []

    // 1. Check all journal entries for double-entry balance integrity
    const entries = await prisma.journalEntry.findMany({
      where: { businessId },
      include: { lines: true },
    })

    let unbalancedEntriesCount = 0
    for (const e of entries) {
      const debitSum = e.lines.reduce((s, l) => s.plus(new Decimal(l.baseDebit || 0)), new Decimal(0))
      const creditSum = e.lines.reduce((s, l) => s.plus(new Decimal(l.baseCredit || 0)), new Decimal(0))
      const diff = debitSum.minus(creditSum).abs()

      if (diff.toNumber() > 0.0001) {
        unbalancedEntriesCount++
        issues.push({
          id: `entry-${e.id}`,
          severity: 'error',
          category: 'unbalanced_entry',
          titleAr: `قيد محاسبي غير متوازن: ${e.entryNumber}`,
          titleEn: `Unbalanced Journal Entry: ${e.entryNumber}`,
          descriptionAr: `القيد رقم ${e.entryNumber} بتاريخ ${e.entryDate.toISOString().slice(0, 10)} غير متزن (المدين: ${debitSum.toNumber()}، الدائن: ${creditSum.toNumber()}، الفارق: ${diff.toNumber()}).`,
          descriptionEn: `Journal entry #${e.entryNumber} dated ${e.entryDate.toISOString().slice(0, 10)} is out of balance (Debit: ${debitSum.toNumber()}, Credit: ${creditSum.toNumber()}, Variance: ${diff.toNumber()}).`,
          documentRef: e.entryNumber,
          amount: diff.toNumber(),
          canAutoFix: false,
        })
      }
    }

    // Collect all posted source IDs
    const postedSources = await prisma.journalEntry.findMany({
      where: {
        businessId,
        status: 'posted',
        sourceId: { not: null },
      },
      select: {
        sourceType: true,
        sourceId: true,
      },
    })

    const postedSaleIds = new Set(
      postedSources.filter((s) => s.sourceType === 'sale' && s.sourceId).map((s) => s.sourceId as string)
    )
    const postedPurchaseIds = new Set(
      postedSources.filter((s) => s.sourceType === 'purchase' && s.sourceId).map((s) => s.sourceId as string)
    )
    const postedPaymentIds = new Set(
      postedSources.filter((s) => s.sourceType === 'payment' && s.sourceId).map((s) => s.sourceId as string)
    )
    const postedExpenseIds = new Set(
      postedSources.filter((s) => s.sourceType === 'expense' && s.sourceId).map((s) => s.sourceId as string)
    )
    const postedTransferIds = new Set(
      postedSources.filter((s) => s.sourceType === 'treasury_transfer' && s.sourceId).map((s) => s.sourceId as string)
    )

    // 2. Check unlinked sales invoices
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: { in: ['sent', 'partial', 'paid'] },
      },
    })
    const unlinkedSales = sales.filter((s) => !postedSaleIds.has(s.id))
    for (const s of unlinkedSales) {
      issues.push({
        id: `sale-${s.id}`,
        severity: 'warning',
        category: 'unlinked_sale',
        titleAr: `فاتورة مبيعات غير مرحلة محاسبياً: ${s.invoiceNumber}`,
        titleEn: `Unposted Sales Invoice: ${s.invoiceNumber}`,
        descriptionAr: `فاتورة المبيعات ${s.invoiceNumber} بقيمة ${Number(s.totalAmount)} لم يتم إنشاء قيد يومية لها في الأستاذ العام.`,
        descriptionEn: `Sales invoice ${s.invoiceNumber} with amount ${Number(s.totalAmount)} has no linked journal entry in the General Ledger.`,
        documentRef: s.invoiceNumber,
        amount: Number(s.totalAmount),
        canAutoFix: true,
      })
    }

    // 3. Check unlinked purchases
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        status: { in: ['received', 'partial', 'paid'] },
      },
    })
    const unlinkedPurchases = purchases.filter((p) => !postedPurchaseIds.has(p.id))
    for (const p of unlinkedPurchases) {
      issues.push({
        id: `purchase-${p.id}`,
        severity: 'warning',
        category: 'unlinked_purchase',
        titleAr: `فاتورة مشتريات غير مرحلة محاسبياً: ${p.purchaseNumber}`,
        titleEn: `Unposted Purchase Bill: ${p.purchaseNumber}`,
        descriptionAr: `فاتورة الشراء ${p.purchaseNumber} بقيمة ${Number(p.totalAmount)} لم يتم إنشاء قيد يومية لها في الأستاذ العام.`,
        descriptionEn: `Purchase bill ${p.purchaseNumber} with amount ${Number(p.totalAmount)} has no linked journal entry in the General Ledger.`,
        documentRef: p.purchaseNumber,
        amount: Number(p.totalAmount),
        canAutoFix: true,
      })
    }

    // 4. Check unlinked payments
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        isVoided: false,
      },
    })
    const unlinkedPayments = payments.filter((pm) => !postedPaymentIds.has(pm.id))
    for (const pm of unlinkedPayments) {
      issues.push({
        id: `payment-${pm.id}`,
        severity: 'warning',
        category: 'unlinked_payment',
        titleAr: `سند دفع/قبض غير مرحل محاسبياً: ${pm.paymentNumber}`,
        titleEn: `Unposted Payment Voucher: ${pm.paymentNumber}`,
        descriptionAr: `السند رقم ${pm.paymentNumber} بقيمة ${Number(pm.amount)} لم يتم ربطه بقيد يومية.`,
        descriptionEn: `Payment voucher ${pm.paymentNumber} with amount ${Number(pm.amount)} has no linked journal entry.`,
        documentRef: pm.paymentNumber,
        amount: Number(pm.amount),
        canAutoFix: true,
      })
    }

    // 5. Check unlinked expenses
    const expenses = await prisma.expense.findMany({
      where: {
        businessId,
        isVoided: false,
      },
    })
    const unlinkedExpenses = expenses.filter((exp) => !postedExpenseIds.has(exp.id))
    for (const exp of unlinkedExpenses) {
      issues.push({
        id: `expense-${exp.id}`,
        severity: 'warning',
        category: 'unlinked_expense',
        titleAr: `مصروف مسجل غير مرحل: ${exp.expenseNumber}`,
        titleEn: `Unposted Expense: ${exp.expenseNumber}`,
        descriptionAr: `المصروف رقم ${exp.expenseNumber} بقيمة ${Number(exp.amount)} لم ينشأ له قيد محاسبي.`,
        descriptionEn: `Expense ${exp.expenseNumber} with amount ${Number(exp.amount)} has no linked journal entry.`,
        documentRef: exp.expenseNumber,
        amount: Number(exp.amount),
        canAutoFix: true,
      })
    }

    // 6. Check unlinked internal treasury transfers
    const transfers = await prisma.treasuryTransfer.findMany({
      where: {
        businessId,
        status: 'posted',
      },
    })
    const unlinkedTransfers = transfers.filter((tr) => !postedTransferIds.has(tr.id))
    for (const tr of unlinkedTransfers) {
      issues.push({
        id: `transfer-${tr.id}`,
        severity: 'warning',
        category: 'unlinked_transfer',
        titleAr: `تحويل مالي بين الحسابات غير مرحل: ${tr.transferNumber}`,
        titleEn: `Unposted Internal Transfer: ${tr.transferNumber}`,
        descriptionAr: `التحويل المالي رقم ${tr.transferNumber} بقيمة ${Number(tr.amount)} لم ينشأ له قيد محاسبي.`,
        descriptionEn: `Treasury transfer ${tr.transferNumber} with amount ${Number(tr.amount)} has no linked journal entry.`,
        documentRef: tr.transferNumber,
        amount: Number(tr.amount),
        canAutoFix: true,
      })
    }

    // 7. Trial Balance Check
    const tb = await AccountingService.getTrialBalance(businessId)
    const tbVariance = Math.abs(tb.totalNetDebit - tb.totalNetCredit)
    if (!tb.isBalanced) {
      issues.push({
        id: 'tb-unbalanced',
        severity: 'error',
        category: 'unbalanced_entry',
        titleAr: 'ميزان المراجعة غير متوازن!',
        titleEn: 'Trial Balance is Out of Balance!',
        descriptionAr: `إجمالي المدين (${tb.totalNetDebit}) لا يساوي إجمالي الدائن (${tb.totalNetCredit}) بفارق ${tbVariance}.`,
        descriptionEn: `Total Debit (${tb.totalNetDebit}) does not match Total Credit (${tb.totalNetCredit}) with variance of ${tbVariance}.`,
        amount: tbVariance,
        canAutoFix: false,
      })
    }

    // 8. Balance Sheet Check
    const bs = await ReportingService.getBalanceSheet(businessId, new Date())
    if (!bs.isBalanced) {
      issues.push({
        id: 'bs-unbalanced',
        severity: 'error',
        category: 'balance_sheet_mismatch',
        titleAr: 'الميزانية العمومية غير متطابقة!',
        titleEn: 'Balance Sheet Equation Mismatch!',
        descriptionAr: `إجمالي الأصول (${bs.assets.total}) لا يساوي إجمالي الخصوم وحقوق الملكية (${bs.totalLiabilitiesAndEquity}) بفارق ${bs.variance}.`,
        descriptionEn: `Total Assets (${bs.assets.total}) does not equal Total Liabilities + Equity (${bs.totalLiabilitiesAndEquity}) with variance of ${bs.variance}.`,
        amount: bs.variance,
        canAutoFix: true,
      })
    }

    // Calculate overall Health Score
    let score = 100
    score -= unbalancedEntriesCount * 25
    score -= issues.filter((i) => i.severity === 'error').length * 20
    score -= unlinkedSales.length * 5
    score -= unlinkedPurchases.length * 5
    score -= unlinkedPayments.length * 5
    score -= unlinkedExpenses.length * 5
    score -= unlinkedTransfers.length * 5
    score = Math.max(0, Math.min(100, score))

    return {
      timestamp: new Date().toISOString(),
      businessId,
      businessName: business.name,
      isHealthy: issues.length === 0 && tb.isBalanced && bs.isBalanced,
      healthScore: score,
      trialBalance: {
        totalDebit: tb.totalNetDebit,
        totalCredit: tb.totalNetCredit,
        isBalanced: tb.isBalanced,
        variance: tbVariance,
      },
      balanceSheet: {
        totalAssets: bs.assets.total,
        totalLiabilities: bs.liabilities.total,
        totalEquity: bs.equity.total,
        totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
        isBalanced: bs.isBalanced,
        variance: bs.variance,
      },
      stats: {
        totalJournalEntries: entries.length,
        unbalancedEntriesCount,
        unlinkedSalesCount: unlinkedSales.length,
        unlinkedPurchasesCount: unlinkedPurchases.length,
        unlinkedPaymentsCount: unlinkedPayments.length,
        unlinkedExpensesCount: unlinkedExpenses.length,
        unlinkedTransfersCount: unlinkedTransfers.length,
      },
      issues,
    }
  }

  /**
   * Automatically heals missing entries and re-synchronizes operational transactions to General Ledger.
   */
  static async repostAndHealLedgers(businessId: string, userId: string) {
    let healedSales = 0
    let healedPurchases = 0
    let healedPayments = 0
    let healedExpenses = 0
    let healedTransfers = 0

    // Fetch Master Accounts
    const defaultAccounts = await prisma.chartOfAccount.findMany({
      where: { businessId },
    })

    const arAccount =
      defaultAccounts.find((a) => a.code === '1300') ||
      defaultAccounts.find((a) => a.type === 'asset' && (a.name.toLowerCase().includes('receivable') || a.name.includes('عملاء') || a.name.includes('مدينة'))) ||
      defaultAccounts.find((a) => a.type === 'asset' && !a.isHeader)

    const apAccount =
      defaultAccounts.find((a) => a.code === '2100') ||
      defaultAccounts.find((a) => a.type === 'liability' && (a.name.toLowerCase().includes('payable') || a.name.includes('موردين') || a.name.includes('دائنة'))) ||
      defaultAccounts.find((a) => a.type === 'liability' && !a.isHeader)

    const salesAccount =
      defaultAccounts.find((a) => a.code === '4100') ||
      defaultAccounts.find((a) => a.type === 'revenue' && !a.isHeader)

    const vatOutputAccount =
      defaultAccounts.find((a) => a.code === '2200') ||
      defaultAccounts.find((a) => a.type === 'liability' && (a.name.toLowerCase().includes('tax') || a.name.includes('ضريبة')))

    const vatInputAccount =
      defaultAccounts.find((a) => a.code === '2210') ||
      defaultAccounts.find((a) => a.code === '2200') ||
      vatOutputAccount

    const cashAccount =
      defaultAccounts.find((a) => a.code === '1110' || a.code === '1100' || a.code === '1210') ||
      defaultAccounts.find((a) => a.type === 'asset' && !a.isHeader)

    const invAccount =
      defaultAccounts.find((a) => a.code === '1400') ||
      defaultAccounts.find((a) => a.type === 'asset' && (a.name.toLowerCase().includes('inventory') || a.name.includes('مخزون'))) ||
      cashAccount

    const defaultExpenseAccount =
      defaultAccounts.find((a) => a.code === '5100' || a.code === '5900') ||
      defaultAccounts.find((a) => a.type === 'expense' && !a.isHeader)

    // Find posted entries
    const postedSources = await prisma.journalEntry.findMany({
      where: {
        businessId,
        status: 'posted',
        sourceId: { not: null },
      },
      select: {
        sourceType: true,
        sourceId: true,
      },
    })

    const postedSaleIds = new Set(
      postedSources.filter((s) => s.sourceType === 'sale' && s.sourceId).map((s) => s.sourceId as string)
    )
    const postedPurchaseIds = new Set(
      postedSources.filter((s) => s.sourceType === 'purchase' && s.sourceId).map((s) => s.sourceId as string)
    )
    const postedPaymentIds = new Set(
      postedSources.filter((s) => s.sourceType === 'payment' && s.sourceId).map((s) => s.sourceId as string)
    )
    const postedExpenseIds = new Set(
      postedSources.filter((s) => s.sourceType === 'expense' && s.sourceId).map((s) => s.sourceId as string)
    )

    // 1. Heal unlinked Sales
    const unlinkedSales = (
      await prisma.sale.findMany({
        where: {
          businessId,
          status: { in: ['sent', 'partial', 'paid'] },
        },
      })
    ).filter((s) => !postedSaleIds.has(s.id))

    for (const sale of unlinkedSales) {
      if (!arAccount || !salesAccount) continue
      try {
        const subtotal = new Decimal(sale.subtotal || sale.totalAmount)
        const taxAmt = new Decimal(sale.taxAmount || 0)
        const total = new Decimal(sale.totalAmount)

        const lines = [
          {
            accountId: arAccount.id,
            description: `Sales Invoice ${sale.invoiceNumber}`,
            debitAmount: total.toNumber(),
            creditAmount: 0,
            customerId: sale.customerId || undefined,
          },
          {
            accountId: salesAccount.id,
            description: `Revenue from Invoice ${sale.invoiceNumber}`,
            debitAmount: 0,
            creditAmount: subtotal.toNumber(),
          },
        ]

        if (taxAmt.gt(0) && vatOutputAccount) {
          lines.push({
            accountId: vatOutputAccount.id,
            description: `Output VAT for Invoice ${sale.invoiceNumber}`,
            debitAmount: 0,
            creditAmount: taxAmt.toNumber(),
          })
        }

        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry')
        await AccountingService.postJournalEntry({
          businessId,
          entryNumber: jeNumber,
          entryDate: sale.invoiceDate,
          description: `Automated Sync for Sales Invoice ${sale.invoiceNumber}`,
          currencyCode: sale.currencyCode,
          exchangeRate: Number(sale.exchangeRate) || 1,
          reference: sale.invoiceNumber,
          sourceType: 'sale',
          sourceId: sale.id,
          lines,
          userId,
        })
        healedSales++
      } catch (err) {
        console.error(`Failed to heal sale ${sale.invoiceNumber}:`, err)
      }
    }

    // 2. Heal unlinked Purchases
    const unlinkedPurchases = (
      await prisma.purchase.findMany({
        where: {
          businessId,
          status: { in: ['received', 'partial', 'paid'] },
        },
      })
    ).filter((p) => !postedPurchaseIds.has(p.id))

    for (const purchase of unlinkedPurchases) {
      if (!apAccount) continue
      try {
        const subtotal = new Decimal(purchase.subtotal || purchase.totalAmount)
        const taxAmt = new Decimal(purchase.taxAmount || 0)
        const total = new Decimal(purchase.totalAmount)
        const purchaseAcc = invAccount || defaultExpenseAccount || cashAccount
        if (!purchaseAcc) continue

        const lines = [
          {
            accountId: purchaseAcc.id,
            description: `Purchases for Bill ${purchase.purchaseNumber}`,
            debitAmount: subtotal.toNumber(),
            creditAmount: 0,
          },
          {
            accountId: apAccount.id,
            description: `Payable for Bill ${purchase.purchaseNumber}`,
            debitAmount: 0,
            creditAmount: total.toNumber(),
            supplierId: purchase.supplierId || undefined,
          },
        ]

        if (taxAmt.gt(0) && vatInputAccount) {
          lines.push({
            accountId: vatInputAccount.id,
            description: `Input VAT for Bill ${purchase.purchaseNumber}`,
            debitAmount: taxAmt.toNumber(),
            creditAmount: 0,
          })
        }

        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry')
        await AccountingService.postJournalEntry({
          businessId,
          entryNumber: jeNumber,
          entryDate: purchase.purchaseDate,
          description: `Automated Sync for Purchase ${purchase.purchaseNumber}`,
          currencyCode: purchase.currencyCode,
          exchangeRate: Number(purchase.exchangeRate) || 1,
          reference: purchase.purchaseNumber,
          sourceType: 'purchase',
          sourceId: purchase.id,
          lines,
          userId,
        })
        healedPurchases++
      } catch (err) {
        console.error(`Failed to heal purchase ${purchase.purchaseNumber}:`, err)
      }
    }

    // 3. Heal unlinked Payments
    const unlinkedPayments = (
      await prisma.payment.findMany({
        where: {
          businessId,
          isVoided: false,
        },
      })
    ).filter((pm) => !postedPaymentIds.has(pm.id))

    for (const payment of unlinkedPayments) {
      const glCashAcc = cashAccount?.id
      if (!glCashAcc) continue
      try {
        const amt = new Decimal(payment.amount).toNumber()
        const isCustomer = payment.direction === 'inbound' || payment.type === 'incoming'

        const lines = isCustomer
          ? [
              {
                accountId: glCashAcc,
                description: `Receipt ${payment.paymentNumber}`,
                debitAmount: amt,
                creditAmount: 0,
              },
              {
                accountId: arAccount?.id || glCashAcc,
                description: `Customer settlement ${payment.paymentNumber}`,
                debitAmount: 0,
                creditAmount: amt,
                customerId: payment.customerId || undefined,
              },
            ]
          : [
              {
                accountId: apAccount?.id || glCashAcc,
                description: `Supplier payment ${payment.paymentNumber}`,
                debitAmount: amt,
                creditAmount: 0,
                supplierId: payment.supplierId || undefined,
              },
              {
                accountId: glCashAcc,
                description: `Disbursement ${payment.paymentNumber}`,
                debitAmount: 0,
                creditAmount: amt,
              },
            ]

        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry')
        await AccountingService.postJournalEntry({
          businessId,
          entryNumber: jeNumber,
          entryDate: payment.paymentDate,
          description: `Automated Sync for Payment ${payment.paymentNumber}`,
          currencyCode: payment.currencyCode,
          exchangeRate: Number(payment.exchangeRate) || 1,
          reference: payment.paymentNumber,
          sourceType: 'payment',
          sourceId: payment.id,
          lines,
          userId,
        })
        healedPayments++
      } catch (err) {
        console.error(`Failed to heal payment ${payment.paymentNumber}:`, err)
      }
    }

    // 4. Heal unlinked Expenses
    const unlinkedExpenses = (
      await prisma.expense.findMany({
        where: {
          businessId,
          isVoided: false,
        },
      })
    ).filter((exp) => !postedExpenseIds.has(exp.id))

    for (const expense of unlinkedExpenses) {
      const expAccId = expense.accountId || defaultExpenseAccount?.id
      const glCashAcc = cashAccount?.id
      if (!expAccId || !glCashAcc) continue
      try {
        const total = new Decimal(expense.totalAmount).toNumber()
        const base = new Decimal(expense.amount).toNumber()
        const tax = new Decimal(expense.taxAmount || 0).toNumber()

        const lines = [
          {
            accountId: expAccId,
            description: `Expense ${expense.expenseNumber} - ${expense.description}`,
            debitAmount: base,
            creditAmount: 0,
          },
          {
            accountId: glCashAcc,
            description: `Disbursement for Expense ${expense.expenseNumber}`,
            debitAmount: 0,
            creditAmount: total,
          },
        ]

        if (tax > 0 && vatInputAccount) {
          lines.push({
            accountId: vatInputAccount.id,
            description: `Input VAT for Expense ${expense.expenseNumber}`,
            debitAmount: tax,
            creditAmount: 0,
          })
        }

        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry')
        await AccountingService.postJournalEntry({
          businessId,
          entryNumber: jeNumber,
          entryDate: expense.expenseDate,
          description: `Automated Sync for Expense ${expense.expenseNumber}`,
          currencyCode: expense.currencyCode,
          exchangeRate: Number(expense.exchangeRate) || 1,
          reference: expense.expenseNumber,
          sourceType: 'expense',
          sourceId: expense.id,
          lines,
          userId,
        })
        healedExpenses++
      } catch (err) {
        console.error(`Failed to heal expense ${expense.expenseNumber}:`, err)
      }
    }

    // Re-run diagnostic after healing
    const postReport = await this.runComprehensiveDiagnostic(businessId)

    return {
      success: true,
      healed: {
        sales: healedSales,
        purchases: healedPurchases,
        payments: healedPayments,
        expenses: healedExpenses,
        transfers: healedTransfers,
        total: healedSales + healedPurchases + healedPayments + healedExpenses + healedTransfers,
      },
      report: postReport,
    }
  }
}
