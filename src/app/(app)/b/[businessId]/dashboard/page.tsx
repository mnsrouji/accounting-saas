import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import {
  Users,
  Truck,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  PiggyBank,
  Landmark,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/utils/decimal'
import Decimal from 'decimal.js'
import { RangeSelect } from '@/components/dashboard/range-select'

export const metadata: Metadata = {
  title: 'Dashboard | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ range?: string }>
}

export default async function BusinessDashboardPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sParams = (await searchParams) || {}
  const rangeFilter = sParams.range || 'all'

  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const { business } = await requireBusinessAccess(businessId)
  const currency = business.defaultCurrency

  // Date filter construction
  let dateGte: Date | undefined
  const now = new Date()
  if (rangeFilter === 'month') {
    dateGte = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (rangeFilter === '30d') {
    dateGte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  } else if (rangeFilter === 'quarter') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3
    dateGte = new Date(now.getFullYear(), qMonth, 1)
  } else if (rangeFilter === 'ytd') {
    dateGte = new Date(now.getFullYear(), 0, 1)
  }

  const dateCondition = dateGte ? { gte: dateGte } : undefined

  // Batch 1: Counts & Aggregates
  const [
    customerCount,
    supplierCount,
    salesAgg,
    purchasesAgg,
    expensesAgg,
    arAgg,
    apAgg,
    cashAccounts,
    bankAccounts,
    glAccountsWithLines,
  ] = await Promise.all([
    prisma.customer.count({ where: { businessId, isActive: true } }),
    prisma.supplier.count({ where: { businessId, isActive: true } }),
    prisma.sale.aggregate({
      where: { businessId, status: { in: ['sent', 'paid', 'partial'] }, ...(dateCondition ? { invoiceDate: dateCondition } : {}) },
      _sum: { baseTotalAmount: true },
    }),
    prisma.purchase.aggregate({
      where: { businessId, status: { in: ['received', 'paid', 'partial'] }, ...(dateCondition ? { purchaseDate: dateCondition } : {}) },
      _sum: { baseTotalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { businessId, status: 'posted', ...(dateCondition ? { expenseDate: dateCondition } : {}) },
      _sum: { baseAmount: true },
    }),
    prisma.sale.aggregate({
      where: { businessId, status: { in: ['sent', 'partial', 'overdue'] } },
      _sum: { balanceDue: true },
    }),
    prisma.purchase.aggregate({
      where: { businessId, status: { in: ['received', 'partial', 'overdue'] } },
      _sum: { balanceDue: true },
    }),
    prisma.cashAccount.findMany({
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
    }),
    prisma.bankAccount.findMany({
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
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      include: {
        journalLines: {
          where: {
            businessId,
            journalEntry: {
              status: 'posted',
              ...(dateCondition ? { entryDate: dateCondition } : {}),
            },
          },
        },
      },
    }),
  ])

  // Batch 2: Record Lists
  const [
    recentSales,
    outstandingCustomerInvoices,
    outstandingSupplierInvoices,
    recentExpenses,
    inventoryBalancesList,
    recentStockMovements,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId, status: { not: 'voided' }, ...(dateCondition ? { invoiceDate: dateCondition } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: true },
    }),
    prisma.sale.findMany({
      where: { businessId, status: { in: ['sent', 'partial', 'paid', 'overdue'] }, balanceDue: { gt: 0 } },
      orderBy: { dueDate: 'asc' },
      take: 5,
      include: { customer: true },
    }),
    prisma.purchase.findMany({
      where: { businessId, status: { in: ['received', 'partial', 'paid', 'overdue'] }, balanceDue: { gt: 0 } },
      orderBy: { dueDate: 'asc' },
      take: 5,
      include: { supplier: true },
    }),
    prisma.expense.findMany({
      where: { businessId, status: 'posted' },
      orderBy: { expenseDate: 'desc' },
      take: 5,
      include: { account: true },
    }),
    prisma.inventoryBalance.findMany({
      where: { businessId },
      include: { product: true },
    }),
    prisma.inventoryMovement.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { product: true, warehouse: true },
    }),
  ])

  const inventoryBalances = inventoryBalancesList

  // 1. Sales Revenue: GL Revenue accounts (4xxx) + Sales Invoices Subledger
  const glSalesSum = glAccountsWithLines
    .filter((a) => a.type === 'revenue' || a.code.startsWith('4'))
    .reduce((acc, a) => {
      const cr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
      const dr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
      return acc.plus(cr.minus(dr))
    }, new Decimal(0))
  const salesSubledgerSum = new Decimal(salesAgg._sum.baseTotalAmount?.toString() || 0)
  const totalSalesVal = glSalesSum.gt(0) ? glSalesSum : salesSubledgerSum

  // 2. Purchases: GL Purchases/COGS accounts (51xx) + Purchases Subledger
  const glPurchasesSum = glAccountsWithLines
    .filter((a) => a.code.startsWith('51'))
    .reduce((acc, a) => {
      const dr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
      const cr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
      return acc.plus(dr.minus(cr))
    }, new Decimal(0))
  const purchasesSubledgerSum = new Decimal(purchasesAgg._sum.baseTotalAmount?.toString() || 0)
  const totalPurchasesVal = glPurchasesSum.gt(0) ? glPurchasesSum : purchasesSubledgerSum

  // 3. Accounts Receivable (ذمم العملاء): GL Accounts Receivable (1103xx) + Invoices Balance Due
  const glArSum = glAccountsWithLines
    .filter((a) => a.code.startsWith('1103'))
    .reduce((acc, a) => {
      const dr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
      const cr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
      return acc.plus(dr.minus(cr))
    }, new Decimal(0))
  const arSubledgerSum = new Decimal(arAgg._sum.balanceDue?.toString() || 0)
  const receivablesVal = glArSum.gt(0) ? glArSum : arSubledgerSum

  // 4. Accounts Payable (ذمم الموردين): GL Accounts Payable (2101xx) + Bills Balance Due
  const glApSum = glAccountsWithLines
    .filter((a) => a.code.startsWith('2101'))
    .reduce((acc, a) => {
      const cr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
      const dr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
      return acc.plus(cr.minus(dr))
    }, new Decimal(0))
  const apSubledgerSum = new Decimal(apAgg._sum.balanceDue?.toString() || 0)
  const payablesVal = glApSum.gt(0) ? glApSum : apSubledgerSum

  // 5. Cash & Bank total balance: live from GL linked accounts
  let cashBankTotal = new Decimal(0)
  cashAccounts.forEach((ca) => {
    const bal = ca.account?.journalLines && ca.account.journalLines.length > 0
      ? ca.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.debitAmount)).minus(new Decimal(l.creditAmount)), new Decimal(0))
      : new Decimal(ca.balance.toString())
    cashBankTotal = cashBankTotal.plus(bal)
  })
  bankAccounts.forEach((ba) => {
    const bal = ba.account?.journalLines && ba.account.journalLines.length > 0
      ? ba.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.debitAmount)).minus(new Decimal(l.creditAmount)), new Decimal(0))
      : new Decimal(ba.balance.toString())
    cashBankTotal = cashBankTotal.plus(bal)
  })
  if (cashBankTotal.isZero()) {
    const glCashBankSum = glAccountsWithLines
      .filter((a) => a.code.startsWith('1101') || a.code.startsWith('1102'))
      .reduce((acc, a) => {
        const dr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const cr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
        return acc.plus(dr.minus(cr))
      }, new Decimal(0))
    if (glCashBankSum.gt(0)) {
      cashBankTotal = glCashBankSum
    }
  }

  // 6. Inventory value total: WAC from Inventory subledger + fallback to GL (1104xx)
  let inventoryValueTotal = new Decimal(0)
  inventoryBalances.forEach((ib) => {
    const qty = new Decimal(ib.quantity.toString())
    const avgCost = new Decimal(ib.averageCost.toString())
    inventoryValueTotal = inventoryValueTotal.plus(qty.mul(avgCost))
  })
  if (inventoryValueTotal.isZero()) {
    const glInvSum = glAccountsWithLines
      .filter((a) => a.code.startsWith('1104'))
      .reduce((acc, a) => {
        const dr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const cr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
        return acc.plus(dr.minus(cr))
      }, new Decimal(0))
    if (glInvSum.gt(0)) {
      inventoryValueTotal = glInvSum
    }
  }

  // 7. Operating Expenses: GL Expense accounts (5xxx except 51xx COGS) + Expense Subledger
  const glExpensesSum = glAccountsWithLines
    .filter((a) => a.type === 'expense' && !a.code.startsWith('51'))
    .reduce((acc, a) => {
      const dr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
      const cr = a.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
      return acc.plus(dr.minus(cr))
    }, new Decimal(0))
  const expensesSubledgerSum = new Decimal(expensesAgg._sum.baseAmount?.toString() || 0)
  const totalExpensesVal = glExpensesSum.gt(0) ? glExpensesSum : expensesSubledgerSum

  // 8. Net Result (Profit / Loss = Sales - Expenses)
  const netProfitVal = totalSalesVal.minus(totalExpensesVal)
  const isNetProfitPositive = netProfitVal.gte(0)

  const t = {
    subtitle: isAr
      ? 'لوحة التحكم المالية والتحليلات التشغيلية اللحظية'
      : isTr
      ? 'Gerçek zamanlı finansal gösterge paneli ve operasyonel analizler'
      : 'Real-time financial dashboard & operational analytics',
    period: isAr ? 'الفترة:' : isTr ? 'Dönem:' : 'Period:',
    newInvoice: isAr ? 'فاتورة جديدة' : isTr ? 'Yeni Fatura' : 'New Invoice',
    statSales: isAr ? 'إجمالي إيرادات المبيعات' : isTr ? 'Toplam Satış Geliri' : 'Total Sales Revenue',
    statSalesSub: isAr ? 'إيرادات المبيعات المرحلة' : isTr ? 'Kaydedilen satış geliri' : 'Posted sales revenue',
    statPurchases: isAr ? 'إجمالي المشتريات' : isTr ? 'Toplam Satın Almalar' : 'Total Purchases',
    statPurchasesSub: isAr ? 'حجم المشتريات والتوريد' : isTr ? 'Tedarik hacmi' : 'Procurement volume',
    statAr: isAr ? 'حسابات القبض (ذمم العملاء)' : isTr ? 'Ticari Alacaklar (Müşteriler)' : 'Accounts Receivable',
    statArSub: (count: number, hasBalance: boolean) => {
      if (count > 0) {
        return isAr ? `${count} فواتير غير مدفوعة` : isTr ? `${count} ödenmemiş fatura` : `${count} unpaid invoices`
      }
      if (hasBalance) {
        return isAr ? 'رصيد الذمم المدينة الدفتري' : isTr ? 'Defter Alacak Bakiyesi' : 'Book AR balance'
      }
      return isAr ? 'لا توجد مستحقات معلقة' : isTr ? 'Bekleyen alacak yok' : 'No receivables'
    },
    statAp: isAr ? 'حسابات الدفع (ذمم الموردين)' : isTr ? 'Ticari Borçlar (Tedarikçiler)' : 'Accounts Payable',
    statApSub: (count: number, hasBalance: boolean) => {
      if (count > 0) {
        return isAr ? `${count} فواتير شراء مستحقة` : isTr ? `${count} ödenmemiş fatura` : `${count} unpaid bills`
      }
      if (hasBalance) {
        return isAr ? 'رصيد الذمم الدائنة الدفتري' : isTr ? 'Defter Borç Bakiyesi' : 'Book AP balance'
      }
      return isAr ? 'لا توجد ذمم مستحقة' : isTr ? 'Ödenecek borç yok' : 'No payables'
    },
    statCashBank: isAr ? 'رصيد الخزينة والبنوك' : isTr ? 'Kasa ve Banka Bakiyesi' : 'Cash & Bank Balance',
    statCashBankSub: (count: number) =>
      isAr ? `${count} حسابات نقدية وبنكية نشطة` : isTr ? `${count} aktif hesap` : `${count} active accounts`,
    statInventory: isAr ? 'إجمالي قيمة المخزون' : isTr ? 'Toplam Stok Değeri' : 'Inventory Value',
    statInventorySub: isAr ? 'وفق المتوسط المرجح WAC' : isTr ? 'Ağırlıklı ortalama maliyete göre' : 'Weighted average cost basis',
    statExpenses: isAr ? 'المصروفات التشغيلية' : isTr ? 'Faaliyet Giderleri' : 'Operating Expenses',
    statExpensesSub: isAr ? 'المصروفات المرحلة' : isTr ? 'Kaydedilen giderler' : 'Posted expenses',
    statNet: isAr ? 'صافي النتيجة (المبيعات - المصروفات)' : isTr ? 'Net Sonuç (Satışlar - Giderler)' : 'Net Result (Sales - Exp)',
    statNetSub: isAr ? 'صافي الإيراد بعد المصروفات' : isTr ? 'Giderler sonrası gelir' : 'Revenue after expenses',
    profit: isAr ? 'ربح' : isTr ? 'Kâr' : 'Profit',
    deficit: isAr ? 'عجز' : isTr ? 'Zarar' : 'Deficit',
    viewAll: isAr ? 'عرض الكل ←' : isTr ? 'Tümünü gör →' : 'View all →',
    viewLog: isAr ? 'سجل الحركات ←' : isTr ? 'Kayıtları gör →' : 'View log →',
    inventoryLink: isAr ? 'المخزون ←' : isTr ? 'Stok →' : 'Inventory →',
    // Customer Invoices
    custInvoicesTitle: isAr ? 'فواتير العملاء المستحقة للتحصيل' : isTr ? 'Ödenmemiş Müşteri Faturaları' : 'Outstanding Customer Invoices',
    noCustInvoicesTitle: isAr ? 'لا توجد مستحقات معلقة' : isTr ? 'Bekleyen alacak yok' : 'No receivables outstanding',
    noCustInvoicesSub: isAr ? 'تم تحصيل كافة فواتير المبيعات بالكامل.' : isTr ? 'Tüm satış faturaları tamamen ödendi.' : 'All sales invoices have been paid in full.',
    colInvoice: isAr ? 'الفاتورة' : isTr ? 'Fatura' : 'Invoice',
    colCustomer: isAr ? 'العميل' : isTr ? 'Müşteri' : 'Customer',
    colBalanceDue: isAr ? 'المتبقي' : isTr ? 'Kalan Tutar' : 'Balance Due',
    colStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    // Supplier Bills
    suppBillsTitle: isAr ? 'فواتير الموردين المستحقة للدفع' : isTr ? 'Ödenecek Tedarikçi Faturaları' : 'Outstanding Supplier Bills',
    noSuppBillsTitle: isAr ? 'لا توجد ذمم مستحقة' : isTr ? 'Ödenecek borç yok' : 'No payables outstanding',
    noSuppBillsSub: isAr ? 'تم سداد كافة فواتير الموردين بالكامل.' : isTr ? 'Tüm tedarikçi faturaları ödendi.' : 'All supplier invoices have been settled.',
    colPurchase: isAr ? 'رقم الشراء' : isTr ? 'Alış No' : 'Purchase #',
    colSupplier: isAr ? 'المورد' : isTr ? 'Tedarikçi' : 'Supplier',
    // Low Stock
    lowStockTitle: isAr ? 'تنبيهات انخفاض المخزون' : isTr ? 'Düşük Stok Uyarıları' : 'Low Stock & Inventory Alerts',
    noLowStockTitle: isAr ? 'مستويات المخزون ممتازة' : isTr ? 'Stok seviyeleri sağlıklı' : 'Stock levels healthy',
    noLowStockSub: isAr ? 'لا توجد منتجات أقل من حد الأمان حالياً.' : isTr ? 'Şu anda minimum stok eşiğinin altında ürün yok.' : 'No products are currently below minimum stock threshold.',
    colProduct: isAr ? 'المنتج' : isTr ? 'Ürün' : 'Product',
    colSku: isAr ? 'الرمز' : isTr ? 'Kod' : 'SKU',
    colStockLevel: isAr ? 'الرصيد المتوفر' : isTr ? 'Stok Miktarı' : 'Stock Level',
    units: isAr ? 'وحدة' : isTr ? 'adet' : 'units',
    // Movements
    movementsTitle: isAr ? 'أحدث حركات المخزون' : isTr ? 'Son Stok Hareketleri' : 'Recent Stock Movements',
    noMovementsTitle: isAr ? 'لا توجد حركات مخزنية' : isTr ? 'Stok hareketi yok' : 'No stock movements',
    noMovementsSub: isAr ? 'ستظهر الحركات فور تسجيل فواتير أو مناقلات أو تسويات.' : isTr ? 'Faturalar, transferler veya düzeltmeler yapıldığında görünecektir.' : 'Stock movements will appear when invoices, transfers or adjustments occur.',
    colType: isAr ? 'النوع' : isTr ? 'Tür' : 'Type',
    colQty: isAr ? 'الكمية' : isTr ? 'Miktar' : 'Qty',
    // Shortcuts
    shortcutsTitle: isAr ? 'الإجراءات السريعة والمساعد المالي' : isTr ? 'Kısayollar ve Hızlı İşlemler' : 'Shortcuts & Workflows',
    scSales: isAr ? 'فاتورة مبيعات جديدة' : isTr ? 'Yeni Satış Faturası' : 'New Sales Invoice',
    scPurchases: isAr ? 'فاتورة مشتريات جديدة' : isTr ? 'Yeni Alış Faturası' : 'New Purchase Invoice',
    scPayIn: isAr ? 'سند قبض عميل' : isTr ? 'Müşteri Tahsilatı Al' : 'Receive Customer Payment',
    scPayOut: isAr ? 'سند صرف لمورد' : isTr ? 'Tedarikçi Ödemesi Yap' : 'Make Supplier Payment',
    scExpense: isAr ? 'تسجيل مصروف تشغيلي' : isTr ? 'Gider Kaydet' : 'Post Expense',
    scTransfer: isAr ? 'مناقلة بين المستودعات' : isTr ? 'Depolar Arası Transfer' : 'Stock Transfer',
    scJournal: isAr ? 'قيد يومية يدوي' : isTr ? 'Yevmiye Kaydı' : 'Journal Entry',
    scReports: isAr ? 'التقارير والقوائم المالية' : isTr ? 'Finansal Raporlar' : 'Financial Reports',
    // Expenses
    expensesTitle: isAr ? 'أحدث المصروفات التشغيلية' : isTr ? 'Son Faaliyet Giderleri' : 'Recent Operating Expenses',
    noExpensesTitle: isAr ? 'لا توجد مصروفات مسجلة' : isTr ? 'Kayıtlı gider yok' : 'No expenses recorded',
    noExpensesSub: isAr ? 'قم بتسجيل المصروفات لتتبع التدفقات النقدية الخارجة.' : isTr ? 'Nakit çıkışlarını izlemek için gider kaydedin.' : 'Record business operating expenses to track cash outflow.',
    colExpenseNum: isAr ? 'رقم المصروف' : isTr ? 'Gider No' : 'Expense #',
    colDesc: isAr ? 'البيان / الوصف' : isTr ? 'Açıklama' : 'Description',
    colAmount: isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount',
    statuses: {
      draft: isAr ? 'مسودة' : isTr ? 'Taslak' : 'Draft',
      sent: isAr ? 'مرسلة' : isTr ? 'Gönderildi' : 'Sent',
      paid: isAr ? 'مدفوعة' : isTr ? 'Ödendi' : 'Paid',
      partial: isAr ? 'جزئية' : isTr ? 'Kısmi' : 'Partial',
      overdue: isAr ? 'متأخرة' : isTr ? 'Gecikmiş' : 'Overdue',
      received: isAr ? 'مستلمة' : isTr ? 'Alındı' : 'Received',
    },
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Header with Date Range Filter */}
      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{business.name}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.25rem 0.5rem' }}>
            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.period}</span>
            <RangeSelect defaultValue={rangeFilter} />
          </div>

          <Link href={`/b/${businessId}/sales/new`} className="btn btn-primary" id="create-invoice-btn">
            <ShoppingCart size={16} />
            {t.newInvoice}
          </Link>
        </div>
      </div>

      {/* Financial KPI Grid */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard
          label={t.statSales}
          value={formatCurrency(totalSalesVal.toFixed(2), currency)}
          icon={<DollarSign size={20} />}
          iconBg="rgba(99, 102, 241, 0.12)"
          iconColor="var(--color-brand-500)"
          subtext={t.statSalesSub}
        />
        <StatCard
          label={t.statPurchases}
          value={formatCurrency(totalPurchasesVal.toFixed(2), currency)}
          icon={<Package size={20} />}
          iconBg="rgba(245, 158, 11, 0.12)"
          iconColor="var(--color-warning)"
          subtext={t.statPurchasesSub}
        />
        <StatCard
          label={t.statAr}
          value={formatCurrency(receivablesVal.toFixed(2), currency)}
          icon={<ArrowUpRight size={20} />}
          iconBg="rgba(16, 185, 129, 0.12)"
          iconColor="var(--color-success)"
          subtext={t.statArSub(outstandingCustomerInvoices.length, receivablesVal.gt(0))}
        />
        <StatCard
          label={t.statAp}
          value={formatCurrency(payablesVal.toFixed(2), currency)}
          icon={<ArrowDownRight size={20} />}
          iconBg="rgba(239, 68, 68, 0.12)"
          iconColor="var(--color-danger)"
          subtext={t.statApSub(outstandingSupplierInvoices.length, payablesVal.gt(0))}
        />
      </div>

      {/* Second KPI Grid */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard
          label={t.statCashBank}
          value={formatCurrency(cashBankTotal.toFixed(2), currency)}
          icon={<Landmark size={20} />}
          iconBg="rgba(59, 130, 246, 0.12)"
          iconColor="var(--color-info)"
          subtext={t.statCashBankSub(cashAccounts.length + bankAccounts.length)}
        />
        <StatCard
          label={t.statInventory}
          value={formatCurrency(inventoryValueTotal.toFixed(2), currency)}
          icon={<Package size={20} />}
          iconBg="rgba(139, 92, 246, 0.12)"
          iconColor="#8b5cf6"
          subtext={t.statInventorySub}
        />
        <StatCard
          label={t.statExpenses}
          value={formatCurrency(totalExpensesVal.toFixed(2), currency)}
          icon={<Receipt size={20} />}
          iconBg="rgba(236, 72, 153, 0.12)"
          iconColor="#ec4899"
          subtext={t.statExpensesSub}
        />
        <StatCard
          label={t.statNet}
          value={formatCurrency(netProfitVal.toFixed(2), currency)}
          icon={isNetProfitPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          iconBg={isNetProfitPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}
          iconColor={isNetProfitPositive ? 'var(--color-success)' : 'var(--color-danger)'}
          badge={isNetProfitPositive ? t.profit : t.deficit}
          subtext={t.statNetSub}
        />
      </div>

      {/* Operation Lists Grid */}
      <div className="dashboard-grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Outstanding Customer Invoices */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.custInvoicesTitle}</span>
            <Link href={`/b/${businessId}/sales`} style={{ fontSize: '0.8125rem', color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
              {t.viewAll}
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            {outstandingCustomerInvoices.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p className="empty-state-title">{t.noCustInvoicesTitle}</p>
                <p className="empty-state-text">{t.noCustInvoicesSub}</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colInvoice}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colCustomer}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colBalanceDue}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingCustomerInvoices.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                        <Link href={`/b/${businessId}/sales/${s.id}`} style={{ color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
                          {s.invoiceNumber}
                        </Link>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {s.customer?.name || (isAr ? 'عميل نقدي' : isTr ? 'Müşteri' : 'Customer')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger)' }}>
                        {formatCurrency(s.balanceDue.toString(), s.currencyCode)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge badge-${s.status === 'overdue' ? 'danger' : 'warning'}`}>
                          {t.statuses[s.status as keyof typeof t.statuses] || s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Outstanding Supplier Bills */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.suppBillsTitle}</span>
            <Link href={`/b/${businessId}/purchases`} style={{ fontSize: '0.8125rem', color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
              {t.viewAll}
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            {outstandingSupplierInvoices.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p className="empty-state-title">{t.noSuppBillsTitle}</p>
                <p className="empty-state-text">{t.noSuppBillsSub}</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colPurchase}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colSupplier}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colBalanceDue}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingSupplierInvoices.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                        <Link href={`/b/${businessId}/purchases/${p.id}`} style={{ color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
                          {p.purchaseNumber}
                        </Link>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {p.supplier?.name || (isAr ? 'مورد' : isTr ? 'Tedarikçi' : 'Supplier')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger)' }}>
                        {formatCurrency(p.balanceDue.toString(), p.currencyCode)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge badge-${p.status === 'overdue' ? 'danger' : 'warning'}`}>
                          {t.statuses[p.status as keyof typeof t.statuses] || p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Operation Lists Grid — Low Stock & Inventory Movements */}
      <div className="dashboard-grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} style={{ color: 'var(--color-warning)' }} />
              {t.lowStockTitle}
            </span>
            <Link href={`/b/${businessId}/inventory`} style={{ fontSize: '0.8125rem', color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
              {t.inventoryLink}
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            {inventoryBalancesList.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p className="empty-state-title">{t.noLowStockTitle}</p>
                <p className="empty-state-text">{t.noLowStockSub}</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colProduct}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colSku}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.colStockLevel}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryBalancesList.slice(0, 5).map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                        <Link href={`/b/${businessId}/inventory/${b.productId}`} style={{ color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
                          {b.product.name}
                        </Link>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{b.product.code}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, textAlign: 'right', color: Number(b.quantity) <= 5 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {Number(b.quantity)} {t.units}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Inventory Movements */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.movementsTitle}</span>
            <Link href={`/b/${businessId}/inventory`} style={{ fontSize: '0.8125rem', color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
              {t.viewLog}
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            {recentStockMovements.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p className="empty-state-title">{t.noMovementsTitle}</p>
                <p className="empty-state-text">{t.noMovementsSub}</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colType}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colProduct}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.colQty}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStockMovements.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>{m.movementType}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{m.product.name}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, textAlign: 'right', color: Number(m.quantity) > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {Number(m.quantity) > 0 ? `+${Number(m.quantity)}` : Number(m.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Bar & Recent Expenses */}
      <div className="dashboard-grid-2">
        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.shortcutsTitle}</span>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <QuickAction href={`/b/${businessId}/sales/new`} icon={<ShoppingCart size={18} />} label={t.scSales} color="var(--color-brand-500)" />
            <QuickAction href={`/b/${businessId}/purchases/new`} icon={<Package size={18} />} label={t.scPurchases} color="var(--color-warning)" />
            <QuickAction href={`/b/${businessId}/payments/incoming/new`} icon={<DollarSign size={18} />} label={t.scPayIn} color="var(--color-success)" />
            <QuickAction href={`/b/${businessId}/payments/outgoing/new`} icon={<Receipt size={18} />} label={t.scPayOut} color="var(--color-danger)" />
            <QuickAction href={`/b/${businessId}/expenses/new`} icon={<Receipt size={18} />} label={t.scExpense} color="#ec4899" />
            <QuickAction href={`/b/${businessId}/inventory/transfer`} icon={<Package size={18} />} label={t.scTransfer} color="#8b5cf6" />
            <QuickAction href={`/b/${businessId}/accounting/journal-entries`} icon={<BarChart3 size={18} />} label={t.scJournal} color="var(--color-info)" />
            <QuickAction href={`/b/${businessId}/reports`} icon={<BarChart3 size={18} />} label={t.scReports} color="var(--text-secondary)" />
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.expensesTitle}</span>
            <Link href={`/b/${businessId}/expenses`} style={{ fontSize: '0.8125rem', color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 500 }}>
              {t.viewAll}
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            {recentExpenses.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p className="empty-state-title">{t.noExpensesTitle}</p>
                <p className="empty-state-text">{t.noExpensesSub}</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colExpenseNum}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colDesc}</th>
                    <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.colAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{e.expenseNumber}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{e.description}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>{formatCurrency(e.amount.toString(), e.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  subtext,
  badge,
}: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  subtext?: string
  badge?: string
}) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
        {value}
      </div>
      {(subtext || badge) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem' }}>
          {subtext && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{subtext}</span>}
          {badge && <span className="badge badge-primary">{badge}</span>}
        </div>
      )}
    </div>
  )
}

function QuickAction({
  href,
  icon,
  label,
  color,
}: {
  href: string
  icon: React.ReactNode
  label: string
  color: string
}) {
  return (
    <Link href={href} className="quick-action-link">
      <span style={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}


