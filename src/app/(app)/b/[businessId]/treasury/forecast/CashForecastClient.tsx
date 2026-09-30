'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  Calendar,
  ShieldAlert,
  Users,
  Truck,
  CheckCircle2,
  Clock,
  Coins,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'

interface ForecastItem {
  id: string
  type: 'receivable' | 'promise' | 'payable' | 'purchase_order' | 'commitment' | 'other'
  sourceDocument: string
  entityName: string
  expectedDate: string
  amount: number
  currency: string
  confidence: number
  status: string
}

interface CashForecastClientProps {
  businessId: string
  defaultCurrency: string
  selectedCurrency: string
  horizonDays: number
  data: {
    currentLiquidity: number
    projectedInflows: number
    projectedOutflows: number
    netProjectedMovement: number
    projectedClosingLiquidity: number
    inflowItems: ForecastItem[]
    outflowItems: ForecastItem[]
  }
}

export function CashForecastClient({
  businessId,
  defaultCurrency,
  selectedCurrency,
  horizonDays,
  data,
}: CashForecastClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const {
    currentLiquidity = 0,
    projectedInflows = 0,
    projectedOutflows = 0,
    netProjectedMovement = 0,
    projectedClosingLiquidity = 0,
    inflowItems = [],
    outflowItems = [],
  } = data || {}

  const handleHorizonChange = (days: number) => {
    router.push(`/b/${businessId}/treasury/forecast?horizonDays=${days}&currency=${selectedCurrency}`)
  }

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/b/${businessId}/treasury/forecast?horizonDays=${horizonDays}&currency=${e.target.value}`)
  }

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والسيولة' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    forecastBreadcrumb: isAr ? 'توقعات التدفقات النقدية' : isTr ? 'Nakit Akış Tahmini' : 'Cash Flow Forecast',
    title: isAr ? 'توقعات التدفقات النقدية والسيولة المستقبلية' : isTr ? 'Geleceğe Yönelik Nakit Akışı ve Likidite Tahmini' : 'Forward Cash Flow & Liquidity Forecast',
    subtitle: isAr
      ? 'أفق السيولة المستقبلي المبني على استحقاقات العملاء، وعود السداد، والتزامات الموردين'
      : isTr
      ? 'Müşteri alacakları, ödeme sözleri ve tedarikçi borçlarına dayalı likidite projeksiyonu'
      : 'Forward-looking liquidity horizon derived from real customer AR receivables, promises, and vendor payables',
    days: isAr ? 'يوم' : isTr ? 'Gün' : 'Days',
    currencyLabel: isAr ? 'العملة:' : isTr ? 'Para Birimi:' : 'Currency:',
    currentActual: isAr ? 'الرصيد الفعلي الحالي (المتاح)' : isTr ? 'Mevcut Gerçek Nakit (Fiili)' : 'Current Actual Cash (Actual)',
    currentActualSub: isAr ? 'إجمالي السيولة الحالية حتى تاريخ اليوم' : isTr ? 'Bugün itibarıyla mevcut likit bakiye' : 'Current liquid balance as of today',
    expectedInflows: (d: number) => isAr ? `التدفقات الداخلة المتوقعة (${d} يوم)` : isTr ? `Beklenen Girişler (${d} Gün)` : `Expected Inflows (${d}d)`,
    inflowSub: (count: number) => isAr ? `${count} فاتورة مستحقة ووعود سداد عملاء` : isTr ? `${count} Satış Faturası ve Ödeme Sözü` : `${count} AR Invoices & Payment Promises`,
    expectedOutflows: (d: number) => isAr ? `التدفقات الخارجة المتوقعة (${d} يوم)` : isTr ? `Beklenen Çıkışlar (${d} Gün)` : `Expected Outflows (${d}d)`,
    outflowSub: (count: number) => isAr ? `${count} فاتورة مورد والتزام شراء` : isTr ? `${count} Alış Faturası ve Taahhüt` : `${count} AP Bills & Commitments`,
    closingLiquidity: isAr ? 'الرصيد الختامي المتوقع للسيولة' : isTr ? 'Tahmini Dönem Sonu Likiditesi' : 'Projected Closing Liquidity',
    netDelta: isAr ? 'صافي التغير:' : isTr ? 'Net Değişim:' : 'Net Delta:',
    inflowBoxTitle: (count: number) => isAr ? `التدفقات النقدية المتوقع تحصيلها (${count})` : isTr ? `Beklenen Nakit Girişleri (${count})` : `Expected Cash Inflows (${count})`,
    outflowBoxTitle: (count: number) => isAr ? `الالتزامات النقدية المتوقع سدادها (${count})` : isTr ? `Beklenen Nakit Çıkışları (${count})` : `Expected Cash Outflows (${count})`,
    total: isAr ? 'الإجمالي:' : isTr ? 'Toplam:' : 'Total:',
    noInflows: isAr ? 'لا توجد تدفقات نقدية داخلة متوقعة خلال هذا الأفق الزمني.' : isTr ? 'Bu dönemde beklenen müşteri tahsilatı bulunmamaktadır.' : 'No anticipated customer inflows in this horizon.',
    noOutflows: isAr ? 'لا توجد التزامات سداد متوقعة خلال هذا الأفق الزمني.' : isTr ? 'Bu dönemde beklenen tedarikçi ödemesi bulunmamaktadır.' : 'No anticipated supplier obligations in this horizon.',
    thExpectedDate: isAr ? 'تاريخ الاستحقاق' : isTr ? 'Beklenen Tarih' : 'Expected Date',
    thCustomerSource: isAr ? 'العميل / المصدر' : isTr ? 'Müşteri / Kaynak' : 'Customer / Source',
    thSupplierSource: isAr ? 'المورد / الالتزام' : isTr ? 'Tedarikçi / Yükümlülük' : 'Supplier / Obligation',
    thType: isAr ? 'النوع' : isTr ? 'Tür' : 'Type',
    thAmount: isAr ? 'المبلغ' : isTr ? 'Tutar' : 'Amount',
    thConfidence: isAr ? 'درجة الثقة' : isTr ? 'Güvenilirlik' : 'Confidence',
    thStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
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
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{t.forecastBreadcrumb}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={26} className="text-brand-600" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Horizon Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            {[15, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => handleHorizonChange(d)}
                className={`btn btn-sm ${horizonDays === d ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.8125rem' }}
              >
                {d} {t.days}
              </button>
            ))}
          </div>

          {/* Currency */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'var(--bg-card)', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.currencyLabel}</span>
            <select
              value={selectedCurrency}
              onChange={handleCurrencyChange}
              style={{ border: 'none', fontWeight: 600, background: 'transparent', outline: 'none', cursor: 'pointer' }}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="SAR">SAR (ر.س)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="TRY">TRY (₺)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Forecast Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Current Liquid Funds */}
        <div className="stat-card" style={{ borderInlineStart: '4px solid #64748b' }}>
          <div className="stat-card-label">{t.currentActual}</div>
          <div className="stat-card-value" style={{ fontSize: '1.625rem', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
            {formatCurrency(currentLiquidity, selectedCurrency)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            {t.currentActualSub}
          </div>
        </div>

        {/* Projected Inflows */}
        <div className="stat-card" style={{ borderInlineStart: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">{t.expectedInflows(horizonDays)}</div>
              <div className="stat-card-value" style={{ color: '#10b981', fontSize: '1.625rem', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                +{formatCurrency(projectedInflows, selectedCurrency)}
              </div>
            </div>
            <div className="stat-card-icon" style={{ background: '#d1fae5', color: '#10b981' }}>
              <ArrowDownLeft size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            {t.inflowSub(inflowItems.length)}
          </div>
        </div>

        {/* Projected Outflows */}
        <div className="stat-card" style={{ borderInlineStart: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">{t.expectedOutflows(horizonDays)}</div>
              <div className="stat-card-value" style={{ color: '#ef4444', fontSize: '1.625rem', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                -{formatCurrency(projectedOutflows, selectedCurrency)}
              </div>
            </div>
            <div className="stat-card-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
              <ArrowUpRight size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            {t.outflowSub(outflowItems.length)}
          </div>
        </div>

        {/* Projected Closing Liquidity */}
        <div className="stat-card" style={{ borderInlineStart: '4px solid var(--color-brand-600)' }}>
          <div className="stat-card-label">{t.closingLiquidity}</div>
          <div className="stat-card-value" style={{ color: 'var(--color-brand-600)', fontSize: '1.625rem', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
            {formatCurrency(projectedClosingLiquidity, selectedCurrency)}
          </div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.375rem', color: netProjectedMovement >= 0 ? '#10b981' : '#ef4444' }}>
            {t.netDelta} <span style={{ direction: 'ltr', display: 'inline-block' }}>{netProjectedMovement >= 0 ? '+' : ''}{formatCurrency(netProjectedMovement, selectedCurrency)}</span>
          </div>
        </div>
      </div>

      {/* 2-Column Forecast Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Inflows Table */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} className="text-success" />
              <span className="card-title">{t.inflowBoxTitle(inflowItems.length)}</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', direction: 'ltr' }}>
              {t.total} +{formatCurrency(projectedInflows, selectedCurrency)}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 450, overflowY: 'auto' }}>
            {inflowItems.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noInflows}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ textAlign: isAr ? 'right' : 'left' }}>
                  <thead>
                    <tr>
                      <th>{t.thExpectedDate}</th>
                      <th>{t.thCustomerSource}</th>
                      <th>{t.thType}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.thAmount}</th>
                      <th>{t.thConfidence}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflowItems.map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                          {new Date(item.expectedDate).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{item.entityName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sourceDocument}</div>
                        </td>
                        <td>
                          <span className={`badge ${item.type === 'promise' ? 'badge-info' : 'badge-neutral'}`} style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                            {item.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 700, color: '#10b981', direction: 'ltr' }}>
                          +{formatCurrency(item.amount, item.currency)}
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                            {item.confidence}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Outflows Table */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={16} className="text-danger" />
              <span className="card-title">{t.outflowBoxTitle(outflowItems.length)}</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', direction: 'ltr' }}>
              {t.total} -{formatCurrency(projectedOutflows, selectedCurrency)}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 450, overflowY: 'auto' }}>
            {outflowItems.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t.noOutflows}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ textAlign: isAr ? 'right' : 'left' }}>
                  <thead>
                    <tr>
                      <th>{t.thExpectedDate}</th>
                      <th>{t.thSupplierSource}</th>
                      <th>{t.thType}</th>
                      <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.thAmount}</th>
                      <th>{t.thStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outflowItems.map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                          {new Date(item.expectedDate).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{item.entityName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sourceDocument}</div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                            {item.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 700, color: '#ef4444', direction: 'ltr' }}>
                          -{formatCurrency(item.amount, item.currency)}
                        </td>
                        <td>
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                            {item.status}
                          </span>
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
