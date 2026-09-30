'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Layers,
  Landmark,
  Coins,
  CheckCheck,
  AlertTriangle,
  WalletCards,
  Receipt,
  Printer,
  Download,
  Filter,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { printElement } from '@/utils/print-report'

interface TreasuryReportsClientProps {
  businessId: string
  defaultCurrency: string
  activeReportType: string
  reportData: any
  cashAccounts: Array<{ id: string; name: string; currency: string }>
  bankAccounts: Array<{ id: string; name: string; bankName: string; currency: string }>
}

export function TreasuryReportsClient({
  businessId,
  defaultCurrency,
  activeReportType,
  reportData,
  cashAccounts,
  bankAccounts,
}: TreasuryReportsClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency)

  const REPORT_TABS = [
    {
      id: 'cash_position',
      label: isAr ? '١. تقرير الموقف المالي والسيولة' : isTr ? '1. Nakit Pozisyonu Raporu' : '1. Cash Position Report',
      icon: Layers,
    },
    {
      id: 'bank_balance',
      label: isAr ? '٢. ملخص أرصدة البنوك' : isTr ? '2. Banka Bakiyeleri Özeti' : '2. Bank Balance Summary',
      icon: Landmark,
    },
    {
      id: 'cash_movement',
      label: isAr ? '٣. تقرير حركات الصناديق والخزينة' : isTr ? '3. Kasa Hareketleri Raporu' : '3. Cash Movements Report',
      icon: Coins,
    },
    {
      id: 'bank_reconciliation',
      label: isAr ? '٤. كشف التسوية والمطابقة البنكية' : isTr ? '4. Banka Mutabakat Raporu' : '4. Bank Reconciliation',
      icon: CheckCheck,
    },
    {
      id: 'unmatched_transactions',
      label: isAr ? '٥. العمليات غير المطابقة' : isTr ? '5. Eşleşmeyen İşlemler' : '5. Unmatched Transactions',
      icon: AlertTriangle,
    },
    {
      id: 'petty_cash',
      label: isAr ? '٦. تقرير فروقات العهد النقدية' : isTr ? '6. Küçük Kasa Farkları' : '6. Petty Cash Variance',
      icon: WalletCards,
    },
    {
      id: 'bank_fees',
      label: isAr ? '٧. تقرير المصاريف والعمولات البنكية' : isTr ? '7. Banka Masraf ve Komisyonları' : '7. Bank Charges & Fees',
      icon: Receipt,
    },
  ]

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والسيولة' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    reportsBreadcrumb: isAr ? 'التقارير والكشوفات' : isTr ? 'Raporlar' : 'Reports',
    title: isAr ? 'تقارير الخزينة والمطابقة البنكية' : isTr ? 'Hazine ve Banka Raporları' : 'Treasury & Banking Reports',
    subtitle: isAr
      ? 'تقارير مالية وتدقيقية قابلة للطباعة والتصدير لحركات النقد، التسويات البنكية، والمصروفات'
      : isTr
      ? 'Nakit akışları, banka mutabakatları ve masraflar için yazdırılabilir denetim ve finansal raporlar'
      : 'Exportable financial and audit statements for cash, bank reconciliations, and movements',
    printBtn: isAr ? 'طباعة التقرير' : isTr ? 'Raporu Yazdır' : 'Print Report',
    availableReportsTitle: isAr ? 'تقارير الخزينة المتاحة' : isTr ? 'Kullanılabilir Hazine Raporları' : 'Available Treasury Reports',
    fromLabel: isAr ? 'من تاريخ:' : isTr ? 'Başlangıç:' : 'From:',
    toLabel: isAr ? 'إلى تاريخ:' : isTr ? 'Bitiş:' : 'To:',
    bankLabel: isAr ? 'البنك:' : isTr ? 'Banka:' : 'Bank:',
    allBanks: isAr ? '-- كافة الحسابات البنكية --' : isTr ? '-- Tüm Banka Hesapları --' : '-- All Bank Accounts --',
    filterBtn: isAr ? 'تطبيق التصفية' : isTr ? 'Filtrele' : 'Filter',
    generatedAsOf: (dt: string) => isAr ? `تم استخراج التقرير في ${dt}` : isTr ? `${dt} tarihinde oluşturuldu` : `Generated As of ${dt}`,
    noData: isAr ? 'جارٍ تحميل بيانات التقرير أو لا توجد سجلات متاحة للفترة المحددة.' : isTr ? 'Rapor verisi yükleniyor veya seçilen dönem için kayıt bulunamadı.' : 'Loading report data or no records available.',
  }

  const handleSelectReport = (type: string) => {
    router.push(`/b/${businessId}/treasury/reports?reportType=${type}&currency=${selectedCurrency}`)
  }

  const handleApplyFilter = () => {
    router.push(
      `/b/${businessId}/treasury/reports?reportType=${activeReportType}&startDate=${startDate}&endDate=${endDate}&accountId=${selectedAccountId}&currency=${selectedCurrency}`
    )
  }

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasuryBreadcrumb}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{t.reportsBreadcrumb}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={26} className="text-brand-600" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => printElement('treasury-report-card', { title: t.title, isAr })}>
            <Printer size={16} /> {t.printBtn}
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar of Reports + Report Viewer */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Reports Navigation Sidebar */}
        <div className="card" style={{ padding: '0.5rem' }}>
          <div style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.availableReportsTitle}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {REPORT_TABS.map((tab) => {
              const isActive = activeReportType === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectReport(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: isActive ? 'var(--color-brand-50)' : 'transparent',
                    color: isActive ? 'var(--color-brand-600)' : 'var(--text-primary)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.8125rem',
                    textAlign: isAr ? 'right' : 'left',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  <Icon size={16} style={{ flexShrink: 0, color: isActive ? 'var(--color-brand-600)' : 'var(--text-secondary)' }} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Report Content Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Filters Bar */}
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.fromLabel}</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.toLabel}</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {activeReportType.includes('bank') && bankAccounts.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.bankLabel}</span>
                  <select
                    className="form-input"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    <option value="">{t.allBanks}</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button className="btn btn-secondary btn-sm" onClick={handleApplyFilter}>
                <Filter size={14} /> {t.filterBtn}
              </button>
            </div>
          </div>

          {/* Render Active Report */}
          <div className="card" id="treasury-report-card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">
                {REPORT_TABS.find((t) => t.id === activeReportType)?.label}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t.generatedAsOf(new Date().toLocaleString())}
              </span>
            </div>
            <div className="card-body">
              {!reportData ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {t.noData}
                </div>
              ) : (
                <div className="table-responsive">
                  <pre style={{ background: 'var(--bg-page)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', overflowX: 'auto', textAlign: 'left', direction: 'ltr' }}>
                    {JSON.stringify(reportData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
