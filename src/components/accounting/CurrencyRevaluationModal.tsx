// =============================================================
// Currency Revaluation Modal — Period-End FX Revaluation Wizard (IAS 21)
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

'use client'

import { useState, useTransition } from 'react'
import {
  Coins,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import {
  getRevaluationPreviewAction,
  executeRevaluationAction,
} from '@/actions/accounting/currency-revaluation-actions'
import { RevaluationPreviewResult } from '@/lib/services/currency-revaluation-service'

interface CurrencyRevaluationModalProps {
  businessId: string
}

export function CurrencyRevaluationModal({ businessId }: CurrencyRevaluationModalProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isOpen, setIsOpen] = useState(false)
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const [rates, setRates] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState<RevaluationPreviewResult | null>(null)
  const [autoReverse, setAutoReverse] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<any | null>(null)

  const t = {
    triggerBtn: isAr ? 'إعادة تقييم العملات (IAS 21)' : isTr ? 'Döviz Değerleme (IAS 21)' : 'FX Revaluation (IAS 21)',
    modalTitle: isAr ? 'إعادة تقييم فروق أسعار الصرف الدورية' : isTr ? 'Dönem Sonu Döviz Kuru Değerleme Sihirbazı' : 'Period-End FX Revaluation Wizard',
    modalSubtitle: isAr
      ? 'معالجة فروق العملة غير المحققة للحسابات النقدية والذمم وفق المعيار الدولي IAS 21'
      : isTr
      ? 'IAS 21 standardına göre nakit ve cari hesapların gerçekleşmemiş kur farklarını değerleyin'
      : 'Calculate and post unrealized FX gains/losses for monetary accounts per IAS 21',
    asOfDateLabel: isAr ? 'تاريخ التقييم والإقفال' : isTr ? 'Değerleme Tarihi' : 'Evaluation / Closing Date',
    fetchPreviewBtn: isAr ? 'فحص واحتساب الفروق' : isTr ? 'Farkları Hesapla' : 'Calculate Variances',
    ratesTitle: isAr ? 'أسعار إقفال العملات الأجنبية' : isTr ? 'Döviz Kapanış Kurları' : 'Closing Exchange Rates',
    accountCol: isAr ? 'الحساب النقدي' : isTr ? 'Hesap' : 'Account',
    foreignBalCol: isAr ? 'الرصيد بالعملة' : isTr ? 'Döviz Bakiyesi' : 'Foreign Balance',
    bookBaseCol: isAr ? 'القيمة الدفترية' : isTr ? 'Defter Değeri' : 'Book Base Value',
    revaluedBaseCol: isAr ? 'القيمة بعد التقييم' : isTr ? 'Değerlenmiş Değer' : 'Revalued Value',
    varianceCol: isAr ? 'أرباح / خسائر غير محققة' : isTr ? 'Gerçekleşmemiş Kur Farkı' : 'Unrealized Gain / Loss',
    totalGain: isAr ? 'إجمالي أرباح التقييم' : isTr ? 'Toplam Değerleme Kârı' : 'Total Unrealized Gain',
    totalLoss: isAr ? 'إجمالي خسائر التقييم' : isTr ? 'Toplam Değerleme Zararı' : 'Total Unrealized Loss',
    netImpact: isAr ? 'صافي الأثر على الأرباح والخسائر' : isTr ? 'Net Gelir Tablosu Etkisi' : 'Net P&L Impact',
    autoReverseLabel: isAr ? 'إنشاء قيد عكس تلقائي في أول يوم من الفترة التالية (موصى به محاسبياً)' : isTr ? 'Gelecek dönemin ilk gününde otomatik ters kayıt oluştur (Tavsiye Edilir)' : 'Auto-reverse on first day of next period (Recommended)',
    postJournalBtn: isAr ? 'ترحيل قيد التقييم للأستاذ العام' : isTr ? 'Değerleme Fişini Yevmiyeye Kaydet' : 'Post Revaluation Journal',
    noCandidates: isAr ? 'لا توجد حسابات نقدية أجنبية بحاجة لإعادة التقييم في هذا التاريخ.' : isTr ? 'Bu tarihte değerleme gerektiren dövizli parasal hesap bulunamadı.' : 'No monetary foreign currency accounts require revaluation on this date.',
    successTitle: isAr ? 'تم ترحيل قيد إعادة تقييم العملات بنجاح!' : isTr ? 'Döviz değerleme fişi başarıyla kaydedildi!' : 'FX Revaluation Journal posted successfully!',
    journalEntryNo: isAr ? 'رقم القيد المرحل:' : isTr ? 'Yevmiye Fiş No:' : 'Journal Entry #:',
    close: isAr ? 'إغلاق' : isTr ? 'Kapat' : 'Close',
  }

  function handleFetchPreview() {
    setError(null)
    setSuccessResult(null)

    startTransition(async () => {
      const res = await getRevaluationPreviewAction(businessId, asOfDate, rates)
      if (res.success && res.preview) {
        setPreview(res.preview)
        // Initialize rates state
        const initialRates: Record<string, number> = { ...rates }
        res.preview.candidates.forEach((c) => {
          if (!initialRates[c.currencyCode]) {
            initialRates[c.currencyCode] = c.closingExchangeRate
          }
        })
        setRates(initialRates)
      } else {
        setError(res.error || 'فشل في احتساب الفروق')
      }
    })
  }

  function handleRateChange(currency: string, newRate: number) {
    const updatedRates = { ...rates, [currency]: newRate }
    setRates(updatedRates)

    startTransition(async () => {
      const res = await getRevaluationPreviewAction(businessId, asOfDate, updatedRates)
      if (res.success && res.preview) {
        setPreview(res.preview)
      }
    })
  }

  function handleExecutePost() {
    if (!preview || preview.candidates.length === 0) return
    setError(null)

    startTransition(async () => {
      const res = await executeRevaluationAction(businessId, {
        asOfDateStr: asOfDate,
        rates,
        autoReverse,
      })

      if (res.success && res.result) {
        setSuccessResult(res.result)
      } else {
        setError(res.error || 'فشل في ترحيل قيد التقييم')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true)
          handleFetchPreview()
        }}
        className="btn btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.875rem',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.8125rem',
        }}
      >
        <Coins size={16} color="var(--color-brand-500, #4f46e5)" />
        <span>{t.triggerBtn}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.25rem',
          }}
        >
          <div
            className="animate-scale-in"
            style={{
              background: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: isAr ? 'right' : 'left',
              direction: isAr ? 'rtl' : 'ltr',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '10px',
                    background: 'rgba(79, 70, 229, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-brand-500, #4f46e5)',
                  }}
                >
                  <Coins size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {t.modalTitle}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                    {t.modalSubtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {successResult ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                  {t.successTitle}
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
                  {t.journalEntryNo} <strong>{successResult.journalEntry?.entryNumber}</strong>
                </p>
                <button onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ padding: '0.625rem 2rem' }}>
                  {t.close}
                </button>
              </div>
            ) : (
              <>
                {/* Date Selection Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'var(--bg-muted, #f8fafc)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calendar size={18} color="var(--text-secondary)" />
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.asOfDateLabel}:
                    </label>
                    <input
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <button
                    onClick={handleFetchPreview}
                    disabled={isPending}
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 1rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={14} className={isPending ? 'animate-spin' : ''} />
                    <span>{t.fetchPreviewBtn}</span>
                  </button>
                </div>

                {/* Candidate Breakdown */}
                {preview && preview.candidates.length > 0 ? (
                  <>
                    {/* Currency Rate Adjustment Chips */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {t.ratesTitle}:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {Array.from(new Set(preview.candidates.map((c) => c.currencyCode))).map((curr) => (
                          <div
                            key={curr}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '8px',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.8125rem',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: 'var(--color-brand-500, #4f46e5)' }}>1 {curr} =</span>
                            <input
                              type="number"
                              step="any"
                              value={rates[curr] ?? ''}
                              onChange={(e) => handleRateChange(curr, parseFloat(e.target.value) || 0)}
                              style={{
                                width: '80px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-page)',
                                color: 'var(--text-primary)',
                                fontWeight: 700,
                                fontSize: '0.8125rem',
                                outline: 'none',
                                textAlign: 'center',
                              }}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>{preview.baseCurrency}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Table */}
                    <div
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-muted, #f8fafc)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.65rem 0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.accountCol}</th>
                            <th style={{ padding: '0.65rem 0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.foreignBalCol}</th>
                            <th style={{ padding: '0.65rem 0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.bookBaseCol}</th>
                            <th style={{ padding: '0.65rem 0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.revaluedBaseCol}</th>
                            <th style={{ padding: '0.65rem 0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: isAr ? 'left' : 'right' }}>
                              {t.varianceCol}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.candidates.map((c) => (
                            <tr key={`${c.accountId}_${c.currencyCode}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.65rem 0.875rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.accountName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.accountCode} ({c.accountType})</div>
                              </td>
                              <td style={{ padding: '0.65rem 0.875rem', fontWeight: 600 }}>
                                {c.foreignBalance.toLocaleString()} {c.currencyCode}
                              </td>
                              <td style={{ padding: '0.65rem 0.875rem', color: 'var(--text-secondary)' }}>
                                {c.currentBaseBalance.toLocaleString()} {preview.baseCurrency}
                              </td>
                              <td style={{ padding: '0.65rem 0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {c.revaluedBaseBalance.toLocaleString()} {preview.baseCurrency}
                              </td>
                              <td style={{ padding: '0.65rem 0.875rem', textAlign: isAr ? 'left' : 'right' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    background: c.isGain ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: c.isGain ? '#10b981' : '#ef4444',
                                  }}
                                >
                                  {c.isGain ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                  {c.isGain ? '+' : ''}
                                  {c.unrealizedGainLoss.toFixed(2)} {preview.baseCurrency}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Stats Cards */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <div style={{ padding: '0.875rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>{t.totalGain}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
                          +${preview.totalUnrealizedGain.toFixed(2)}
                        </div>
                      </div>

                      <div style={{ padding: '0.875rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>{t.totalLoss}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                          -${preview.totalUnrealizedLoss.toFixed(2)}
                        </div>
                      </div>

                      <div style={{ padding: '0.875rem', borderRadius: '10px', background: 'var(--bg-muted, #f8fafc)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.netImpact}</div>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: preview.netUnrealizedGainLoss >= 0 ? '#059669' : '#dc2626',
                            marginTop: '0.25rem',
                          }}
                        >
                          {preview.netUnrealizedGainLoss >= 0 ? '+' : ''}${preview.netUnrealizedGainLoss.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Auto-reverse Option */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <input
                        type="checkbox"
                        id="chk-auto-reverse"
                        checked={autoReverse}
                        onChange={(e) => setAutoReverse(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <label htmlFor="chk-auto-reverse" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        {t.autoReverseLabel}
                      </label>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button onClick={() => setIsOpen(false)} className="btn btn-secondary" style={{ padding: '0.625rem 1.25rem' }}>
                        {t.close}
                      </button>
                      <button
                        onClick={handleExecutePost}
                        disabled={isPending}
                        className="btn btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.625rem 1.5rem',
                          fontWeight: 600,
                        }}
                      >
                        <Scale size={16} />
                        <span>{t.postJournalBtn}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Scale size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>{t.noCandidates}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
