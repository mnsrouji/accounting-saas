'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  PiggyBank,
  Landmark,
  Coins,
  ArrowLeftRight,
  Receipt,
  FileSpreadsheet,
  CheckCheck,
  WalletCards,
  Layers,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
  BarChart3,
  Plus,
} from 'lucide-react'
import { formatCurrency } from '@/utils/decimal'

interface AccountSummary {
  id: string
  name: string
  currency: string
  balance: number
  isPettyCash?: boolean
  bankName?: string
  accountNumber?: string
  glAccountCode: string
  glAccountName: string
}

interface TreasuryDashboardClientProps {
  businessId: string
  defaultCurrency: string
  selectedCurrency: string
  data: any
  cashAccounts: AccountSummary[]
  bankAccounts: AccountSummary[]
}

export function TreasuryDashboardClient({
  businessId,
  defaultCurrency,
  selectedCurrency,
  data,
  cashAccounts,
  bankAccounts,
}: TreasuryDashboardClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const {
    totalCash = 0,
    totalBankBalance = 0,
    pettyCashTotal = 0,
    availableLiquidity = 0,
    restrictedFunds = 0,
    unreconciledTransactionsCount = 0,
    upcoming30DayInflows = 0,
    upcoming30DayOutflows = 0,
    projectedNetCashChange = 0,
    accountsRequiringAttention = [],
  } = data || {}

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    router.push(`/b/${businessId}/treasury?currency=${val}`)
  }

  const base = `/b/${businessId}/treasury`

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-brand-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isAr ? 'إدارة الخزينة والسيولة النقدية' : isTr ? 'Hazine ve Nakit Yönetimi' : 'Treasury & Cash Management'}
            </span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PiggyBank className="text-brand-600" size={28} />
            {isAr ? 'لوحة الخزينة وإدارة السيولة' : isTr ? 'Hazine Paneli ve Likidite' : 'Treasury Workspace & Liquidity'}
          </h1>
          <p className="page-subtitle">
            {isAr
              ? 'متابعة السيولة المباشرة، الحسابات البنكية، كشوف الحسابات، والتنبؤ بالتدفقات النقدية'
              : isTr
              ? 'Gerçek zamanlı likidite, banka hesapları, ekstreler ve nakit akışı tahmini'
              : 'Real-time liquidity, banking coordinates, statements, and forward cash forecasting'}
          </p>
        </div>

        {/* Currency & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {isAr ? 'العملة:' : isTr ? 'Para Birimi:' : 'Currency:'}
            </span>
            <select
              value={selectedCurrency}
              onChange={handleCurrencyChange}
              style={{
                border: 'none',
                fontWeight: 600,
                background: 'transparent',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="SAR">SAR (ر.س)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="TRY">TRY (₺)</option>
            </select>
          </div>

          <Link href={`${base}/transfers`} className="btn btn-primary">
            <ArrowLeftRight size={16} />
            {isAr ? 'تحويل مالي جديد' : isTr ? 'Yeni Transfer' : 'New Transfer'}
          </Link>
          <Link href={`${base}/transactions`} className="btn btn-secondary">
            <Receipt size={16} />
            {isAr ? 'تسجيل حركة مالية' : isTr ? 'İşlem Kaydet' : 'Post Transaction'}
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Available Liquidity */}
        <div className="stat-card" style={{ [isAr ? 'borderRight' : 'borderLeft']: '4px solid var(--color-brand-600)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">
                {isAr ? 'السيولة المتاحة' : isTr ? 'Kullanılabilir Likidite' : 'Available Liquidity'}
              </div>
              <div className="stat-card-value" style={{ color: 'var(--color-brand-600)' }}>
                {formatCurrency(availableLiquidity, selectedCurrency)}
              </div>
            </div>
            <div className="stat-card-icon" style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-600)' }}>
              <Layers size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {isAr ? 'النقدية + الأرصدة البنكية غير المقيدة' : isTr ? 'Nakit + Kısıtlanmamış Banka Bakiyeleri' : 'Cash + Unrestricted Bank Balances'}
          </div>
        </div>

        {/* Bank Balances */}
        <div className="stat-card" style={{ [isAr ? 'borderRight' : 'borderLeft']: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">
                {isAr ? 'إجمالي الأرصدة البنكية' : isTr ? 'Toplam Banka Bakiyesi' : 'Total Bank Balance'}
              </div>
              <div className="stat-card-value" style={{ color: '#0284c7' }}>
                {formatCurrency(totalBankBalance, selectedCurrency)}
              </div>
            </div>
            <div className="stat-card-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <Landmark size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {isAr
              ? `عبر ${bankAccounts.length} حسابات بنكية نشطة`
              : isTr
              ? `${bankAccounts.length} aktif banka hesabında`
              : `Across ${bankAccounts.length} active bank accounts`}
          </div>
        </div>

        {/* Total Cash & Petty Cash */}
        <div className="stat-card" style={{ [isAr ? 'borderRight' : 'borderLeft']: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">
                {isAr ? 'النقدية في الصناديق' : isTr ? 'Eldeki Nakit' : 'Cash on Hand'}
              </div>
              <div className="stat-card-value" style={{ color: '#10b981' }}>
                {formatCurrency(totalCash, selectedCurrency)}
              </div>
            </div>
            <div className="stat-card-icon" style={{ background: '#d1fae5', color: '#10b981' }}>
              <Coins size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {isAr ? 'العهدة النقدية / المصروفات النثرية: ' : isTr ? 'Küçük Kasa: ' : 'Petty Cash: '}
            {formatCurrency(pettyCashTotal, selectedCurrency)}
          </div>
        </div>

        {/* Projected 30-Day Net Cash Flow */}
        <div className="stat-card" style={{ [isAr ? 'borderRight' : 'borderLeft']: `4px solid ${projectedNetCashChange >= 0 ? '#10b981' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">
                {isAr ? 'صافي التوقع (30 يوماً)' : isTr ? '30 Günlük Tahmini Net' : 'Projected 30d Net'}
              </div>
              <div className="stat-card-value" style={{ color: projectedNetCashChange >= 0 ? '#10b981' : '#ef4444' }}>
                {projectedNetCashChange >= 0 ? '+' : ''}{formatCurrency(projectedNetCashChange, selectedCurrency)}
              </div>
            </div>
            <div className="stat-card-icon" style={{ background: projectedNetCashChange >= 0 ? '#d1fae5' : '#fee2e2', color: projectedNetCashChange >= 0 ? '#10b981' : '#ef4444' }}>
              <TrendingUp size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
              <ArrowDownLeft size={12} /> {isAr ? 'داخل: ' : isTr ? 'Giriş: ' : 'In: '}{formatCurrency(upcoming30DayInflows, selectedCurrency)}
            </span>
            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <ArrowUpRight size={12} /> {isAr ? 'خارج: ' : isTr ? 'Çıkış: ' : 'Out: '}{formatCurrency(upcoming30DayOutflows, selectedCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* Warning/Attention Banner if Any */}
      {(accountsRequiringAttention.length > 0 || unreconciledTransactionsCount > 0) && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle className="text-warning" size={20} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#92400e' }}>
                {isAr
                  ? `${unreconciledTransactionsCount} حركة غير مطابقة و ${accountsRequiringAttention.length} حساب(ات) تتطلب المتابعة`
                  : isTr
                  ? `${unreconciledTransactionsCount} mutabakat bekleyen kalem ve ${accountsRequiringAttention.length} hesap ilgi bekliyor`
                  : `${unreconciledTransactionsCount} Unreconciled Item(s) & ${accountsRequiringAttention.length} Account(s) Require Attention`}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                {isAr
                  ? 'قم باستيراد كشوف الحسابات أو إجراء التسوية البنكية الدورية لمطابقة دفتر الأستاذ العام مع الأرصدة البنكية.'
                  : isTr
                  ? 'Büyük defter ile banka bakiyelerini eşleştirmek için ekstre içe aktarımı veya periyodik mutabakat yapın.'
                  : 'Perform statement imports or periodic reconciliation to align general ledger with bank balances.'}
              </div>
            </div>
          </div>
          <Link href={`${base}/reconciliation`} className="btn btn-secondary btn-sm" style={{ background: 'white' }}>
            {isAr ? 'الانتقال للتسوية البنكية' : isTr ? 'Mutabakata Git' : 'Go to Reconciliation'}
          </Link>
        </div>
      )}

      {/* Navigation Feature Cards */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.875rem' }}>
          {isAr ? 'أقسام ومساحات عمل الخزينة' : isTr ? 'Hazine Çalışma Alanları' : 'Treasury Workspaces'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          
          <Link href={`${base}/cash`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                <Coins size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'حسابات الصناديق والخزائن' : isTr ? 'Nakit ve Kasa Hesapları' : 'Cash & Vault Accounts'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {cashAccounts.filter(c => !c.isPettyCash).length} {isAr ? 'صندوق نقدي نشط' : isTr ? 'Aktif Nakit Hesabı' : 'Active Cash Accounts'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'الخزائن النقدية، نقاط البيع، وأرصدة الصناديق المرتبطة بدليل الحسابات العام.'
                : isTr
                ? 'Fiziksel kasalar ve Genel Muhasebeye bağlı nakit bakiyeleri.'
                : 'Physical tills, vault registers, and cash balances linked to General Ledger.'}
            </p>
          </Link>

          <Link href={`${base}/banks`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                <Landmark size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'الحسابات البنكية والآيبان' : isTr ? 'Banka Hesapları ve IBAN' : 'Bank Accounts & IBANs'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {bankAccounts.length} {isAr ? 'حساب بنكي تجاري' : isTr ? 'Ticari Banka Hesabı' : 'Commercial Bank Accounts'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'الحسابات الجارية، بيانات IBAN/SWIFT، العملات، وربط كشوف الحسابات البنكية.'
                : isTr
                ? 'Vadesiz hesaplar, IBAN/SWIFT bilgileri, para birimleri ve ekstre akışları.'
                : 'Operating accounts, IBAN/SWIFT coordinates, currencies, and statement feeds.'}
            </p>
          </Link>

          <Link href={`${base}/transfers`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--color-brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-brand-600)' }}>
                <ArrowLeftRight size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'التحويلات المالية الداخلية' : isTr ? 'Dahili Transferler' : 'Internal Transfers'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isAr ? 'مسودة ← معتمد ← مرحل' : isTr ? 'Taslak → Onaylı → İşlendi' : 'Draft → Approved → Posted'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'نقل الأموال بين الصناديق والبنوك مع دعم فروق العملات الأجنبية ودورة الاعتماد.'
                : isTr
                ? 'Nakit ve bankalar arasında çoklu para birimi ve onay kontrolleriyle fon transferi.'
                : 'Move funds between cash and banks with multi-currency FX and approval controls.'}
            </p>
          </Link>

          <Link href={`${base}/statements`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'كشوف الحسابات البنكية' : isTr ? 'Banka Ekstreleri' : 'Bank Statements'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isAr ? 'استيراد وإدخال CSV' : isTr ? 'CSV İçe Aktarma ve Giriş' : 'CSV Import & Entry'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'استيراد كشوف البنك الإلكترونية، تواريخ الاستحقاق، وأرقام العمليات الخارجية.'
                : isTr
                ? 'Elektronik banka ekstrelerini, valör tarihlerini ve işlem satırlarını içe aktarın.'
                : 'Import electronic bank statements, value dates, external txn IDs, and lines.'}
            </p>
          </Link>

          <Link href={`${base}/reconciliation`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                <CheckCheck size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'التسوية والمطابقة البنكية' : isTr ? 'Banka Mutabakatı' : 'Bank Reconciliation'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isAr ? 'مطابقة آلية وتسويات' : isTr ? 'Otomatik Eşleştirme ve Düzeltmeler' : 'Auto-Match & Adjustments'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'مطابقة بنود الكشف البنكي مع قيود دفتر الأستاذ، وإثبات الرسوم، وإغلاق الفترات.'
                : isTr
                ? 'Ekstre satırlarını defter kayıtlarıyla eşleştirin, ücretleri kaydedin ve dönemleri kapatın.'
                : 'Match statement lines vs book GL, post bank fees, and close periods.'}
            </p>
          </Link>

          <Link href={`${base}/petty-cash`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }}>
                <WalletCards size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'العهدة النقدية والجرد' : isTr ? 'Küçük Kasa ve Sayımlar' : 'Petty Cash & Counts'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isAr ? 'جرد الفئات واستعاضة السلفة' : isTr ? 'Kasa Avansı ve Kupür Sayımı' : 'Float & Denomination Counts'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'جرد الفئات النقدية الفعلية، استعاضة العهدة، وترحيل فروقات الصندوق محاسبياً.'
                : isTr
                ? 'Fiziksel para sayımları, avans tamamlama ve kasa farkı muhasebe kayıtları.'
                : 'Physical denomination counts, float replenishment, and cash variance GL posting.'}
            </p>
          </Link>

          <Link href={`${base}/cash-position`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488' }}>
                <Layers size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'الموقف المالي والنقدي' : isTr ? 'Nakit Pozisyonu' : 'Cash Position'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isAr ? 'تفصيل متعدد العملات' : isTr ? 'Çoklu Para Birimi Dağılımı' : 'Multi-Currency Breakdown'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'السيولة المجمعة المباشرة، الاحتياطيات المقيدة، وتفاصيل أرصدة جميع الحسابات.'
                : isTr
                ? 'Konsolide gerçek zamanlı likit fonlar, kısıtlı rezervler ve hesap dökümü.'
                : 'Consolidated real-time liquid funds, restricted reserves, and account breakdown.'}
            </p>
          </Link>

          <Link href={`${base}/forecast`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fae8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'توقع التدفقات النقدية' : isTr ? 'Nakit Akışı Tahmini' : 'Cash Flow Forecast'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isAr ? 'تحصيلات العملاء مقابل التزامات الموردين' : isTr ? 'Alacak Tahsilatları vs Borç Ödemeleri' : 'AR Collections vs AP Commitments'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'أفق السيولة المستقبلي المبني على استحقاقات الفواتير ومواعيد سداد الموردين.'
                : isTr
                ? 'Müşteri taahhütleri ve tedarikçi faturalarına dayalı ileriye dönük likidite tahmini.'
                : 'Forward liquidity horizon based on real customer promises, invoices, and purchase bills.'}
            </p>
          </Link>

          <Link href={`${base}/reports`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', transition: 'all 200ms', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                <BarChart3 size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'تقارير الخزينة والسيولة' : isTr ? 'Hazine Raporları' : 'Treasury Reports'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isAr ? '7 تقارير رقابية وتدقيقية' : isTr ? '7 Finansal Denetim Raporu' : '7 Financial Audit Reports'}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isAr
                ? 'تقارير التسويات البنكية، حركات الخزينة، العمولات المصرفية، وجرد العهد القابلة للتصدير.'
                : isTr
                ? 'Dışa aktarılabilir mutabakatlar, nakit hareketleri, banka masrafları ve kasa raporları.'
                : 'Exportable statement reconciliations, cash movements, bank charges, and petty cash reports.'}
            </p>
          </Link>
        </div>
      </div>

      {/* Account Balances Summary Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        
        {/* Bank Accounts Overview */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Landmark size={18} className="text-brand-600" />
              <span className="card-title">
                {isAr ? 'الحسابات البنكية التجارية' : isTr ? 'Ticari Banka Hesapları' : 'Commercial Bank Accounts'}
              </span>
            </div>
            <Link href={`${base}/banks`} className="btn btn-ghost btn-sm">
              {isAr ? 'عرض الكل' : isTr ? 'Tümünü Gör' : 'View All'}
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {bankAccounts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {isAr ? 'لا توجد حسابات بنكية مسجلة بعد.' : isTr ? 'Henüz banka hesabı oluşturulmadı.' : 'No bank accounts created yet.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الحساب' : isTr ? 'Hesap' : 'Account'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'البنك / الرقم' : isTr ? 'Banka / Numara' : 'Bank / Number'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'حساب الدليل' : isTr ? 'Muhasebe Hesabı' : 'GL Account'}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'الرصيد' : isTr ? 'Bakiye' : 'Balance'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Link href={`${base}/banks/${b.id}`} style={{ fontWeight: 600, color: 'var(--color-brand-600)', textDecoration: 'none' }}>
                            {b.name}
                          </Link>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8125rem' }}>{b.bankName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.accountNumber}</div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                            {b.glAccountCode}
                          </span>
                        </td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>
                          {formatCurrency(b.balance, b.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Cash & Petty Cash Accounts */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Coins size={18} className="text-brand-600" />
              <span className="card-title">
                {isAr ? 'حسابات الصناديق والعهدة النقدية' : isTr ? 'Nakit ve Küçük Kasa Hesapları' : 'Cash & Petty Cash Accounts'}
              </span>
            </div>
            <Link href={`${base}/cash`} className="btn btn-ghost btn-sm">
              {isAr ? 'عرض الكل' : isTr ? 'Tümünü Gör' : 'View All'}
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {cashAccounts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {isAr ? 'لا توجد حسابات نقدية مسجلة بعد.' : isTr ? 'Henüz nakit hesabı kaydedilmedi.' : 'No cash accounts registered yet.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الحساب' : isTr ? 'Hesap' : 'Account'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'النوع' : isTr ? 'Tür' : 'Type'}</th>
                      <th style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'حساب الدليل' : isTr ? 'Muhasebe Hesabı' : 'GL Account'}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'الرصيد' : isTr ? 'Bakiye' : 'Balance'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashAccounts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`${base}/cash/${c.id}`} style={{ fontWeight: 600, color: 'var(--color-brand-600)', textDecoration: 'none' }}>
                            {c.name}
                          </Link>
                        </td>
                        <td>
                          {c.isPettyCash ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                              {isAr ? 'عهدة نقدية' : isTr ? 'Küçük Kasa' : 'Petty Cash'}
                            </span>
                          ) : (
                            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                              {isAr ? 'صندوق عام' : isTr ? 'Genel Kasa' : 'General Cash'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                            {c.glAccountCode}
                          </span>
                        </td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>
                          {formatCurrency(c.balance, c.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
