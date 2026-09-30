'use client'

import React, { useState } from 'react'
import { TemplateSettingsInput } from '@/lib/services/settings-service'
import { Save, Check, FileText } from 'lucide-react'
import { useLocale } from 'next-intl'

interface Props {
  businessId: string
  initialData: TemplateSettingsInput
}

export function TemplatesForm({ businessId, initialData }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [formData, setFormData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const t = {
    title: isAr ? 'قوالب المستندات وتخصيص الهوية التجارية' : isTr ? 'Belge Şablonları ve Marka Kimliği' : 'Document Templates & Branding',
    subtitle: isAr
      ? 'تخصيص تصاميم فواتير المبيعات، فواتير الشراء، سندات القبض والصرف، وكشوفات الحساب.'
      : isTr
      ? 'Satış faturaları, alış faturaları, makbuzlar ve müşteri ekstreleri için şablonları özelleştirin.'
      : 'Customize your invoices, purchase bills, payment receipts, and customer statements.',
    accentColor: isAr ? 'اللون المميز للهوية (Accent Color)' : isTr ? 'Kurumsal Vurgu Rengi' : 'Brand Accent Color',
    defaultDocLang: isAr ? 'لغة المستندات المطبوعة الافتراضية' : isTr ? 'Varsayılan Belge Dili' : 'Default Document Language',
    bankDetails: isAr ? 'بيانات الحسابات البنكية والتحويلات المطبوعة' : isTr ? 'Banka Hesap ve Havale Bilgileri' : 'Bank Account & Transfer Details',
    bankDetailsPlaceholder: isAr ? 'اسم البنك: مصرف الراجحي&#10;الآيبان: SA1234567890&#10;السويفت: RJHIXX' : isTr ? 'Banka Adı: Garanti BBVA&#10;IBAN: TR1234567890&#10;SWIFT: TGBATRIS' : 'Bank Name: Example Bank\nIBAN: US1234567890\nSwift: EXMPUS33',
    terms: isAr ? 'الشروط والأحكام وسياسة السداد المطبوعة' : isTr ? 'Standart Ödeme Şartları ve Koşulları' : 'Standard Payment Terms & Conditions',
    termsPlaceholder: isAr ? 'تستحق الفاتورة السداد خلال 30 يوماً من تاريخ الإصدار.' : isTr ? 'Fatura bedeli düzenleme tarihinden itibaren 30 gün içinde ödenecektir.' : 'Payment due within 30 days from invoice issue date.',
    footer: isAr ? 'ملاحظة تذييل الفاتورة المطبوعة' : isTr ? 'Fatura Alt Bilgi Notu' : 'Invoice Footer Note',
    footerPlaceholder: isAr ? 'شكراً لتعاملكم معنا!' : isTr ? 'Bizi tercih ettiğiniz için teşekkür ederiz!' : 'Thank you for your business!',
    successMsg: isAr ? 'تم حفظ إعدادات القوالب بنجاح!' : isTr ? 'Şablon ayarları başarıyla kaydedildi!' : 'Template settings saved successfully!',
    saveBtn: isAr ? 'حفظ إعدادات القوالب' : isTr ? 'Ayarları Kaydet' : 'Save Settings',
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
        body: JSON.stringify({ section: 'templates', data: formData }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update template settings')

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
          <FileText size={18} /> {t.title}
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
            <label className="form-label">{t.accentColor}</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="color"
                value={formData.accentColor || '#4f46e5'}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                style={{ width: '45px', height: '38px', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              />
              <input
                type="text"
                className="form-control"
                value={formData.accentColor || '#4f46e5'}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="form-label">{t.defaultDocLang}</label>
            <select
              className="form-control"
              value={formData.defaultLanguage || 'en'}
              onChange={(e) => setFormData({ ...formData, defaultLanguage: e.target.value as any })}
            >
              <option value="ar">العربية — Arabic (RTL)</option>
              <option value="tr">Türkçe — Turkish (LTR)</option>
              <option value="en">English (LTR)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">{t.bankDetails}</label>
          <textarea
            className="form-control"
            rows={3}
            value={formData.bankDetailsText || ''}
            onChange={(e) => setFormData({ ...formData, bankDetailsText: e.target.value })}
            placeholder={t.bankDetailsPlaceholder}
          />
        </div>

        <div>
          <label className="form-label">{t.terms}</label>
          <textarea
            className="form-control"
            rows={2}
            value={formData.termsAndConditions || ''}
            onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
            placeholder={t.termsPlaceholder}
          />
        </div>

        <div>
          <label className="form-label">{t.footer}</label>
          <input
            type="text"
            className="form-control"
            value={formData.footerText || ''}
            onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
            placeholder={t.footerPlaceholder}
          />
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
