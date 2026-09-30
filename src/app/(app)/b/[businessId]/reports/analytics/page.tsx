import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ReportingService } from '@/lib/services/reporting-service'
import { formatCurrency } from '@/utils/decimal'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Business Analytics | AccountFlow',
  description: 'Sales, Expense, and Inventory Analytics with trend analysis',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ fromDate?: string; toDate?: string; view?: string }>
}

export default async function AnalyticsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sp = (await searchParams) || {}
  const { business } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), 0, 1)
  const fromDate = sp.fromDate ? new Date(sp.fromDate) : defaultFrom
  const toDate = sp.toDate ? new Date(sp.toDate) : now
  const view = sp.view || 'sales'

  const [salesData, expenseData, inventoryData] = await Promise.all([
    ReportingService.getSalesAnalytics(businessId, fromDate, toDate),
    ReportingService.getExpenseAnalytics(businessId, fromDate, toDate),
    ReportingService.getInventoryValuation(businessId),
  ])

  const currency = business.defaultCurrency
  const fmt = (n: number) => formatCurrency(Number(n).toFixed(2), currency)

  // Compute max for bar charts
  const salesMaxMonthly = salesData.sales.reduce((m, r) => Math.max(m, Number(r.total)), 0)
  const expMaxMonthly = expenseData.monthly.reduce((m, r) => Math.max(m, Number(r.total)), 0)
  const topCustMax = salesData.topCustomers.reduce((m, r) => Math.max(m, Number(r.total)), 0)
  const topExpMax = expenseData.byAccount.reduce((m, r) => Math.max(m, Number(r.total)), 0)
  const invMax = inventoryData.rows.reduce((m, r) => Math.max(m, r.totalValue), 0)

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/reports`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              {isAr ? 'التقارير المالية' : isTr ? 'Raporlar' : 'Reports'}
            </Link>
            <ChevronRight size={12} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
            <span>{isAr ? 'التحليلات والمؤشرات' : isTr ? 'Analitik' : 'Analytics'}</span>
          </div>
          <h1 className="page-title">
            {isAr ? 'تحليلات ومؤشرات الأعمال' : isTr ? 'İşletme Analitiği ve Trendler' : 'Business Analytics'}
          </h1>
          <p className="page-subtitle">
            {business.name} · {fromDate.toISOString().split('T')[0]} {isAr ? 'إلى' : isTr ? '-' : 'to'} {toDate.toISOString().split('T')[0]}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <form method="GET" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="hidden" name="view" value={view} />
            <input type="date" name="fromDate" defaultValue={fromDate.toISOString().split('T')[0]} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{isAr ? 'إلى' : isTr ? '-' : 'to'}</span>
            <input type="date" name="toDate" defaultValue={toDate.toISOString().split('T')[0]} className="form-control" style={{ fontSize: '0.8125rem' }} />
            <button type="submit" className="btn btn-secondary btn-sm">
              {isAr ? 'تطبيق' : isTr ? 'Uygula' : 'Apply'}
            </button>
          </form>
        </div>
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'sales', label: isAr ? '📈 تحليلات المبيعات' : isTr ? '📈 Satış Analitiği' : '📈 Sales Analytics' },
          { id: 'expenses', label: isAr ? '📋 تفصيل المصروفات' : isTr ? '📋 Gider Dağılımı' : '📋 Expense Breakdown' },
          { id: 'inventory', label: isAr ? '📦 تقييم المخزون' : isTr ? '📦 Stok Değerleme' : '📦 Inventory Valuation' },
        ].map((tab) => (
          <Link
            key={tab.id}
            href={`/b/${businessId}/reports/analytics?view=${tab.id}&fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}`}
            className={`btn btn-sm ${view === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            id={`analytics-${tab.id}-tab`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* ── SALES ANALYTICS ── */}
      {view === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Monthly Sales Bar Chart */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              {isAr ? 'اتجاه المبيعات الشهري' : isTr ? 'Aylık Satış Trendi' : 'Monthly Sales Trend'}
            </h3>
            {salesData.sales.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {isAr ? 'لا توجد بيانات مبيعات لهذه الفترة.' : isTr ? 'Bu dönem için satış verisi yok.' : 'No sales data for this period.'}
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {salesData.sales.map((row) => {
                  const h = salesMaxMonthly > 0 ? (Number(row.total) / salesMaxMonthly) * 200 : 0
                  return (
                    <div key={row.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', minWidth: '64px' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>{fmt(Number(row.total))}</div>
                      <div style={{
                        width: '100%', height: `${Math.max(h, 4)}px`, borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(180deg, var(--color-brand-500) 0%, var(--color-brand-700) 100%)',
                        position: 'relative', minHeight: '4px',
                      }} />
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }}>{row.month}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{row.count} {isAr ? 'فاتورة' : isTr ? 'fatura' : 'inv.'}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                {isAr ? 'أعلى العملاء إيراداً' : isTr ? 'En Çok Gelir Getiren Müşteriler' : 'Top Customers by Revenue'}
              </h3>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {salesData.topCustomers.length} {isAr ? 'عميل' : isTr ? 'müşteri' : 'customers'}
              </span>
            </div>
            {salesData.topCustomers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {isAr ? 'لا توجد بيانات عملاء لهذه الفترة.' : isTr ? 'Bu dönem için müşteri verisi yok.' : 'No customer data for this period.'}
              </div>
            ) : (
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {salesData.topCustomers.map((cust, i) => (
                  <div key={cust.customer_id || i}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '20px' }}>#{i + 1}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{cust.customer_name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({cust.invoice_count} {isAr ? 'فاتورة' : isTr ? 'fatura' : 'invoices'})</span>
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>{fmt(Number(cust.total))}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-page)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${topCustMax > 0 ? (Number(cust.total) / topCustMax) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, var(--color-brand-500), var(--color-brand-400))',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                {isAr ? 'أعلى المنتجات مبيعاً وإيراداً' : isTr ? 'En Çok Satan Ürünler' : 'Top Products by Revenue'}
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'المنتج' : isTr ? 'Ürün' : 'Product'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'الكمية المباعة' : isTr ? 'Satılan Miktar' : 'Qty Sold'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'الإيراد المحقق' : isTr ? 'Toplam Gelir' : 'Revenue'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.topProducts.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>{isAr ? 'لا توجد بيانات منتجات.' : isTr ? 'Ürün verisi yok.' : 'No product data.'}</td></tr>
                  ) : salesData.topProducts.map((prod, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}>{prod.product_name}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem' }}>{Number(prod.total_qty).toFixed(2)}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>{fmt(Number(prod.total_revenue))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPENSE ANALYTICS ── */}
      {view === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Monthly Expense Trend */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              {isAr ? 'اتجاه المصروفات الشهري' : isTr ? 'Aylık Gider Trendi' : 'Monthly Expense Trend'}
            </h3>
            {expenseData.monthly.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {isAr ? 'لا توجد بيانات مصروفات لهذه الفترة.' : isTr ? 'Bu dönem için gider verisi yok.' : 'No expense data for this period.'}
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {expenseData.monthly.map((row) => {
                  const h = expMaxMonthly > 0 ? (Number(row.total) / expMaxMonthly) * 200 : 0
                  return (
                    <div key={row.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', minWidth: '64px' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-danger)' }}>{fmt(Number(row.total))}</div>
                      <div style={{
                        width: '100%', height: `${Math.max(h, 4)}px`, borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(180deg, var(--color-danger) 0%, #b91c1c 100%)',
                        minHeight: '4px',
                      }} />
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }}>{row.month}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Expense by Account */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
              {isAr ? 'المصروفات حسب الحساب والتصنيف' : isTr ? 'Hesap ve Kategori Bazında Giderler' : 'Expense by Account / Category'}
            </h3>
            {expenseData.byAccount.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {isAr ? 'لا توجد بيانات مصروفات لهذه الفترة.' : isTr ? 'Bu dönem için gider verisi yok.' : 'No expense data for this period.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {expenseData.byAccount.map((acc, i) => (
                  <div key={acc.account_id || i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{acc.account_name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', [isAr ? 'marginRight' : 'marginLeft']: '0.5rem' }}>({acc.count} {isAr ? 'حركة' : isTr ? 'kayıt' : 'records'})</span>
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)' }}>{fmt(Number(acc.total))}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-page)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${topExpMax > 0 ? (Number(acc.total) / topExpMax) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, var(--color-danger), #f87171)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── INVENTORY VALUATION ── */}
      {view === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem', borderTop: '3px solid var(--color-brand-500)' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {isAr ? 'إجمالي قيمة المخزون' : isTr ? 'Toplam Stok Değeri' : 'Total Inventory Value'}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--color-brand-500)' }}>{fmt(inventoryData.totalValue)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {isAr ? 'بناءً على متوسط التكلفة المرجح WAC' : isTr ? 'Ağırlıklı ortalama maliyet esası' : 'Weighted average cost basis'}
              </div>
            </div>
            <div className="card" style={{ padding: '1.25rem', borderTop: '3px solid var(--color-success)' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {isAr ? 'عدد الأصناف المميزة' : isTr ? 'Benzersiz Ürün (SKU)' : 'Unique SKUs'}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--color-success)' }}>{inventoryData.skuCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {isAr ? 'منتج مسجل ومتتبع' : isTr ? 'Takip edilen ürün' : 'Distinct products tracked'}
              </div>
            </div>
            <div className="card" style={{ padding: '1.25rem', borderTop: `3px solid ${inventoryData.lowStockCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {isAr ? 'تنبيهات انخفاض المخزون' : isTr ? 'Düşük Stok Uyarıları' : 'Low Stock Alerts'}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: inventoryData.lowStockCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {inventoryData.lowStockCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {isAr ? 'أقل من حد الطلب' : isTr ? 'Yeniden sipariş seviyesinin altında' : 'Below reorder level'}
              </div>
            </div>
          </div>

          {/* Inventory by Value */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
              {isAr ? 'الأصناف الأعلى قيمة في المخزون' : isTr ? 'Değere Göre Stok Kalemleri' : 'Inventory by Value'}
            </h3>
            {inventoryData.rows.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{isAr ? 'لا توجد بيانات مخزون.' : isTr ? 'Stok verisi yok.' : 'No inventory data.'}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[...inventoryData.rows].sort((a, b) => b.totalValue - a.totalValue).slice(0, 15).map((row) => (
                  <div key={row.productId + row.warehouseId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {row.isBelowReorder && <span title={isAr ? 'أقل من حد إعادة الطلب' : 'Below reorder level'} style={{ color: 'var(--color-danger)', fontSize: '0.75rem' }}>⚠️</span>}
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{row.productName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({row.warehouseName} · {row.quantity.toFixed(2)} {isAr ? 'وحدة' : isTr ? 'birim' : 'units'})</span>
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>{fmt(row.totalValue)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-page)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${invMax > 0 ? (row.totalValue / invMax) * 100 : 0}%`,
                        background: row.isBelowReorder
                          ? 'linear-gradient(90deg, var(--color-danger), #f87171)'
                          : 'linear-gradient(90deg, var(--color-brand-500), var(--color-brand-400))',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full Inventory Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                {isAr ? 'تقرير تقييم المخزون التفصيلي' : isTr ? 'Detaylı Stok Değerleme Raporu' : 'Full Inventory Valuation'}
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'المنتج' : isTr ? 'Ürün' : 'Product'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>SKU</th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'التصنيف' : isTr ? 'Kategori' : 'Category'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'المستودع' : isTr ? 'Depo' : 'Warehouse'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'الكمية' : isTr ? 'Miktar' : 'Qty'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'متوسط التكلفة (WAC)' : isTr ? 'Ortalama Maliyet' : 'Avg Cost (WAC)'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'القيمة الإجمالية' : isTr ? 'Toplam Değer' : 'Total Value'}
                    </th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                      {isAr ? 'الحالة' : isTr ? 'Durum' : 'Status'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        <Link href={`/b/${businessId}/inventory/${row.productId}`} style={{ color: 'var(--color-brand-500)', textDecoration: 'none' }}>
                          {row.productName}
                        </Link>
                      </td>
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{row.productCode || '—'}</td>
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{row.category || '—'}</td>
                      <td style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem' }}>{row.warehouseName}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', fontWeight: 600 }}>{row.quantity.toFixed(2)}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem' }}>{fmt(row.averageCost)}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: isAr ? 'left' : 'right', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>{fmt(row.totalValue)}</td>
                      <td style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>
                        {row.isBelowReorder
                          ? <span className="badge badge-danger">{isAr ? 'مخزون منخفض' : isTr ? 'Düşük Stok' : 'Low Stock'}</span>
                          : <span className="badge badge-success">{isAr ? 'متوفر' : isTr ? 'Yeterli' : 'OK'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-page)', borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={6} style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>
                      {isAr ? 'إجمالي قيمة المخزون' : isTr ? 'TOPLAM STOK DEĞERİ' : 'TOTAL INVENTORY VALUE'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: isAr ? 'left' : 'right', fontWeight: 800, fontSize: '1rem', color: 'var(--color-brand-500)' }}>{fmt(inventoryData.totalValue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
