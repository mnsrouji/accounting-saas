'use client'

import React, { useState } from 'react'
import { FinancialSettingsInput } from '@/lib/services/settings-service'
import { Save, Check, AlertCircle } from 'lucide-react'
import { useLocale } from 'next-intl'

interface Props {
  businessId: string
  initialData: FinancialSettingsInput & { baseCurrency: string; fiscalYearStart: string }
}

export function FinancialSettingsForm({ businessId, initialData }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [formData, setFormData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const t = {
    title: isAr ? 'الإعدادات المالية والسنة المالية' : isTr ? 'Mali ve Hesap Dönemi Ayarları' : 'Financial & Fiscal Year Settings',
    successMsg: isAr ? 'تم تحديث الإعدادات المالية بنجاح!' : isTr ? 'Mali ayarlar başarıyla güncellendi!' : 'Financial settings updated successfully!',
    noticeTitle: isAr ? 'ملاحظة العملة الأساسية:' : isTr ? 'Temel Para Birimi Bildirimi:' : 'Base Currency Notice:',
    noticeText: isAr
      ? 'تُعتمد العملة الأساسية كعملة قياسية رئيسية لدفتر الأستاذ العام، ميزان المراجعة، والقوائم المالية (الأرباح والخسائر، الميزانية العمومية). أسعار الصرف التاريخية للعمليات تبقى ثابتة.'
      : isTr
      ? 'Temel para birimi; Büyük Defter, Mizan ve Finansal Tablolar (Gelir Tablosu, Bilanço) için birincil para birimidir. Geçmiş işlem kurları değiştirilemez.'
      : 'The base operating currency serves as the primary currency for your General Ledger, Trial Balance, and Financial Statements (P&L, Balance Sheet). Historical transaction rates remain permanently immutable.',
    baseCurrency: isAr ? 'العملة الأساسية للنظام' : isTr ? 'Temel Para Birimi' : 'Base Currency',
    fiscalYearStart: isAr ? 'بداية السنة المالية (MM-DD)' : isTr ? 'Mali Yıl Başlangıcı (AA-GG)' : 'Fiscal Year Start (MM-DD)',
    paymentTerms: isAr ? 'شروط السداد الافتراضية (بالأيام)' : isTr ? 'Varsayılan Vade Süresi (Gün)' : 'Default Payment Terms (Days)',
    decimalPrecision: isAr ? 'دقة المنازل العشرية' : isTr ? 'Kuruş / Ondalık Hassasiyeti' : 'Decimal Precision',
    dateFormat: isAr ? 'صيغة عرض التاريخ' : isTr ? 'Tarih Formatı' : 'Date Format',
    numberFormat: isAr ? 'صيغة الأرقام والفواصل' : isTr ? 'Sayı ve Ayraç Formatı' : 'Number Format',
    decimals2: isAr ? 'منزلتان عشريتان (مثال: 100.00)' : isTr ? '2 Basamak (Örn: 100.00)' : '2 Decimals (e.g. 100.00)',
    decimals3: isAr ? '3 منازل عشرية (مثال: 100.000)' : isTr ? '3 Basamak (Örn: 100.000)' : '3 Decimals (e.g. 100.000)',
    decimals4: isAr ? '4 منازل عشرية (مثال: 100.0000)' : isTr ? '4 Basamak (Örn: 100.0000)' : '4 Decimals (e.g. 100.0000)',
    numStandard: isAr ? 'قياسي بفواصل الآلاف (1,234.56)' : isTr ? 'Standart Binlik Ayraçlı (1,234.56)' : 'Standard (1,234.56)',
    numNone: isAr ? 'بدون فواصل آلاف (1234.56)' : isTr ? 'Ayraçsız (1234.56)' : 'No Separators (1234.56)',
    saveBtn: isAr ? 'حفظ التغييرات' : isTr ? 'Değişiklikleri Kaydet' : 'Save Changes',
    saving: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Saving...',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch(`/api/b/${businessId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'financial', data: formData }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update financial settings')

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '800px', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="card-header">
        <h2 className="card-title">{t.title}</h2>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {error && (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#15803d', borderRadius: '6px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} /> {t.successMsg}
          </div>
        )}

        <div style={{ padding: '1rem', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '6px', border: '1px solid rgba(79, 70, 229, 0.2)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertCircle size={20} color="var(--color-brand-500, #4f46e5)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong>{t.noticeTitle}</strong> {t.noticeText}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="form-label">{t.baseCurrency}</label>
            <select
              className="form-control"
              value={formData.baseCurrency}
              onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
            >
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
              <option value="SAR">SAR — Saudi Riyal (ر.س)</option>
              <option value="AED">AED — UAE Dirham (د.إ)</option>
              <option value="TRY">TRY — Turkish Lira (₺)</option>
              <option value="CAD">CAD — Canadian Dollar ($)</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t.fiscalYearStart}</label>
            <input
              type="text"
              className="form-control"
              value={formData.fiscalYearStart}
              onChange={(e) => setFormData({ ...formData, fiscalYearStart: e.target.value })}
              placeholder="01-01"
            />
          </div>

          <div>
            <label className="form-label">{t.paymentTerms}</label>
            <input
              type="number"
              className="form-control"
              value={formData.defaultPaymentTerms || 30}
              onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: parseInt(e.target.value, 10) || 0 })}
            />
          </div>

          <div>
            <label className="form-label">{t.decimalPrecision}</label>
            <select
              className="form-control"
              value={formData.decimalPrecision || 2}
              onChange={(e) => setFormData({ ...formData, decimalPrecision: parseInt(e.target.value, 10) })}
            >
              <option value={2}>{t.decimals2}</option>
              <option value={3}>{t.decimals3}</option>
              <option value={4}>{t.decimals4}</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t.dateFormat}</label>
            <select
              className="form-control"
              value={formData.dateFormat || 'YYYY-MM-DD'}
              onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (UK / International)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (US standard)</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t.numberFormat}</label>
            <select
              className="form-control"
              value={formData.numberFormat || 'standard'}
              onChange={(e) => setFormData({ ...formData, numberFormat: e.target.value })}
            >
              <option value="standard">{t.numStandard}</option>
              <option value="none">{t.numNone}</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={16} /> {loading ? t.saving : t.saveBtn}
          </button>
        </div>
      </div>
    </form>
  )
}
