'use client'

import React, { useState } from 'react'
import { LocalizationSettingsInput } from '@/lib/services/settings-service'
import { Globe, Check, Save } from 'lucide-react'
import { useLocale } from 'next-intl'

interface Props {
  businessId: string
  initialData: LocalizationSettingsInput
}

export function LocalizationForm({ businessId, initialData }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [formData, setFormData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const t = {
    title: isAr ? 'التفضيلات الإقليمية واللغة والاتجاه' : isTr ? 'Bölgesel Tercihler ve Dil Ayarları' : 'Regional & Localization Preferences',
    subtitle: isAr
      ? 'تحديد لغة واجهة النظام الافتراضية، اتجاه العرض (RTL/LTR)، المنطقة الزمنية، وصيغ التاريخ.'
      : isTr
      ? 'Varsayılan kullanıcı arayüzü dilini, metin yönünü (RTL/LTR), saat dilimini ve tarih formatını yapılandırın.'
      : 'Configure preferred UI language, text direction (RTL/LTR), regional date and number formats.',
    defaultLang: isAr ? 'لغة النظام الافتراضية' : isTr ? 'Varsayılan Sistem Dili' : 'Default System Language',
    direction: isAr ? 'اتجاه تخطيط الواجهة' : isTr ? 'Arayüz Yönü' : 'Layout Direction',
    timezone: isAr ? 'المنطقة الزمنية للنظام' : isTr ? 'Sistem Saat Dilimi' : 'System Timezone',
    dateFormat: isAr ? 'صيغة عرض التاريخ' : isTr ? 'Tarih Görüntüleme Formatı' : 'Date Display Format',
    dirLtr: isAr ? 'من اليسار إلى اليمين (LTR - إنجليزي / تركي)' : isTr ? 'Soldan Sağa (LTR - Türkçe / İngilizce)' : 'LTR — Left to Right (English / Turkish)',
    dirRtl: isAr ? 'من اليمين إلى اليسار (RTL - عربي)' : isTr ? 'Sağdan Sola (RTL - Arapça)' : 'RTL — Right to Left (Arabic)',
    successMsg: isAr ? 'تم حفظ التفضيلات الإقليمية بنجاح!' : isTr ? 'Bölgesel tercihler başarıyla kaydedildi!' : 'Regional preferences saved successfully!',
    saveBtn: isAr ? 'حفظ التفضيلات' : isTr ? 'Tercihleri Kaydet' : 'Save Preferences',
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
        body: JSON.stringify({ section: 'localization', data: formData }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update localization settings')

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '850px', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={18} /> {t.title}
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
          {t.subtitle}
        </p>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="form-label">{t.defaultLang}</label>
            <select
              className="form-control"
              value={formData.defaultLanguage}
              onChange={(e) => {
                const lang = e.target.value as 'en' | 'ar' | 'tr'
                setFormData({
                  ...formData,
                  defaultLanguage: lang,
                  direction: lang === 'ar' ? 'rtl' : 'ltr',
                })
              }}
            >
              <option value="ar">العربية (Arabic - RTL)</option>
              <option value="tr">Türkçe (Turkish - LTR)</option>
              <option value="en">English (English - LTR)</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t.direction}</label>
            <select
              className="form-control"
              value={formData.direction}
              onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'ltr' | 'rtl' })}
            >
              <option value="rtl">{t.dirRtl}</option>
              <option value="ltr">{t.dirLtr}</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t.timezone}</label>
            <select
              className="form-control"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            >
              <option value="Asia/Riyadh">Asia/Riyadh (GMT+3 — الرياض / مكة)</option>
              <option value="Asia/Dubai">Asia/Dubai (GMT+4 — دبي)</option>
              <option value="Europe/Istanbul">Europe/Istanbul (GMT+3 — اسطنبول)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="Europe/London">Europe/London (GMT+0 / GMT+1)</option>
              <option value="America/New_York">America/New York (EST/EDT)</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t.dateFormat}</label>
            <select
              className="form-control"
              value={formData.dateFormat}
              onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-09-24)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (24/09/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (09/24/2026)</option>
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
