'use client'

import React, { useState } from 'react'
import { Plus, Check, Save, ArrowRightLeft } from 'lucide-react'
import { useLocale } from 'next-intl'

interface CurrencyItem {
  id: string
  code: string
  name: string
  symbol: string
  decimalPlaces: number
  isActive: boolean
}

interface ExchangeRateItem {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  rateDate: string
  source: string
}

interface Props {
  businessId: string
  baseCurrency: string
  currencies: CurrencyItem[]
  exchangeRates: ExchangeRateItem[]
}

export function CurrenciesForm({ businessId, baseCurrency, currencies, exchangeRates }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [rates, setRates] = useState<ExchangeRateItem[]>(exchangeRates)
  const [showAddRate, setShowAddRate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [newRate, setNewRate] = useState({
    fromCurrency: 'EUR',
    toCurrency: baseCurrency,
    rate: 1.08,
    rateDate: new Date().toISOString().split('T')[0],
  })

  const t = {
    supportedTitle: isAr ? 'العملات المدعومة في النظام' : isTr ? 'Desteklenen Para Birimleri' : 'Supported Currencies',
    supportedSubtitle: (base: string) =>
      isAr
        ? `العملة التشغيلية الأساسية هي ${base}. يتم تحويل المعاملات متعددة العملات إلى العملة الأساسية في دفتر الأستاذ العام.`
        : isTr
        ? `Temel operasyonel para birimi ${base}. Çoklu para birimi işlemleri Büyük Defterde temel para birimine dönüştürülür.`
        : `Base operating currency is ${base}. Multi-currency transactions convert to base currency in General Ledger.`,
    baseCurrencyBadge: isAr ? 'العملة الأساسية' : isTr ? 'Temel Para Birimi' : 'Base Currency',
    ratesTitle: isAr ? 'أسعار الصرف التاريخية والتشغيلية' : isTr ? 'Geçmiş ve Güncel Döviz Kurları' : 'Historical & Operational Exchange Rates',
    ratesSubtitle: isAr
      ? 'تحديد أسعار الصرف مقابل العملة الأساسية. تحتفظ المعاملات التاريخية بأسعار صرفها المسجلة وقت القيد.'
      : isTr
      ? 'Temel para birimine karşı döviz kurlarını tanımlayın. Geçmiş işlemler kendi kurlarını korur.'
      : 'Define exchange rates against base currency. Historical transactions retain their booked rates.',
    addRateBtn: isAr ? 'إضافة سعر صرف جديد' : isTr ? 'Yeni Kur Ekle' : 'Add Exchange Rate',
    addRateModalTitle: isAr ? 'تسجيل سعر صرف جديد' : isTr ? 'Yeni Döviz Kuru Ekle' : 'Add Exchange Rate',
    fromCurrency: isAr ? 'من عملة' : isTr ? 'Kaynak Para Birimi' : 'From Currency',
    toCurrency: isAr ? 'إلى عملة' : isTr ? 'Hedef Para Birimi' : 'To Currency',
    rateValue: isAr ? 'سعر الصرف' : isTr ? 'Döviz Kuru' : 'Exchange Rate',
    effectiveDate: isAr ? 'تاريخ السريان' : isTr ? 'Geçerlilik Tarihi' : 'Effective Date',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    saveRate: isAr ? 'حفظ سعر الصرف' : isTr ? 'Kuru Kaydet' : 'Save Rate',
    saving: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Saving...',
    thPair: isAr ? 'زوج العملات' : isTr ? 'Para Birimi Çifti' : 'Currency Pair',
    thRate: isAr ? 'السعر' : isTr ? 'Kur' : 'Rate',
    thDate: isAr ? 'تاريخ السريان' : isTr ? 'Geçerlilik Tarihi' : 'Effective Date',
    thSource: isAr ? 'المصدر' : isTr ? 'Kaynak' : 'Source',
    noRates: isAr ? 'لا توجد أسعار صرف مسجلة حتى الآن.' : isTr ? 'Henüz kaydedilmiş döviz kuru yok.' : 'No exchange rates configured yet.',
    successMsg: isAr ? 'تمت إضافة سعر الصرف بنجاح!' : isTr ? 'Döviz kuru başarıyla eklendi!' : 'Exchange rate added successfully!',
  }

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/b/${businessId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'exchangeRate',
          data: {
            fromCurrency: newRate.fromCurrency,
            toCurrency: newRate.toCurrency,
            rate: Number(newRate.rate),
            rateDate: new Date(newRate.rateDate),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add exchange rate')

      setRates([
        {
          id: data.result.id,
          fromCurrency: newRate.fromCurrency,
          toCurrency: newRate.toCurrency,
          rate: Number(newRate.rate),
          rateDate: newRate.rateDate,
          source: 'manual',
        },
        ...rates,
      ])

      setShowAddRate(false)
      setSuccess(t.successMsg)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Active Currencies */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t.supportedTitle}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {t.supportedSubtitle(baseCurrency)}
          </p>
        </div>

        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {currencies.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  border: c.code === baseCurrency ? '2px solid var(--color-brand-500, #4f46e5)' : '1px solid var(--border-color)',
                  background: c.code === baseCurrency ? 'rgba(79, 70, 229, 0.04)' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{c.code}</span>
                  <span style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>{c.symbol}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{c.name}</div>
                {c.code === baseCurrency && (
                  <span className="badge badge-success" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                    {t.baseCurrencyBadge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="card-title">{t.ratesTitle}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {t.ratesSubtitle}
            </p>
          </div>
          <button
            onClick={() => setShowAddRate(!showAddRate)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> {t.addRateBtn}
          </button>
        </div>

        <div className="card-body">
          {error && (
            <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#15803d', borderRadius: '6px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Check size={16} /> {success}
            </div>
          )}

          {showAddRate && (
            <form onSubmit={handleAddRate} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>{t.addRateModalTitle}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">{t.fromCurrency}</label>
                  <select
                    className="form-control"
                    value={newRate.fromCurrency}
                    onChange={(e) => setNewRate({ ...newRate, fromCurrency: e.target.value })}
                  >
                    {currencies.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">{t.toCurrency}</label>
                  <select
                    className="form-control"
                    value={newRate.toCurrency}
                    onChange={(e) => setNewRate({ ...newRate, toCurrency: e.target.value })}
                  >
                    {currencies.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">{t.rateValue}</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-control"
                    value={newRate.rate}
                    onChange={(e) => setNewRate({ ...newRate, rate: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">{t.effectiveDate}</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newRate.rateDate}
                    onChange={(e) => setNewRate({ ...newRate, rateDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddRate(false)} className="btn btn-secondary">
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? t.saving : t.saveRate}
                </button>
              </div>
            </form>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thPair}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thRate}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thDate}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thSource}</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600, direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                      {r.fromCurrency} / {r.toCurrency}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-brand-500, #4f46e5)', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                      {Number(r.rate).toFixed(6)}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(r.rateDate).toISOString().split('T')[0]}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {r.source}
                    </td>
                  </tr>
                ))}
                {rates.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t.noRates}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
