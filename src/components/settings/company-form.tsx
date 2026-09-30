'use client'

import React, { useState } from 'react'
import { CompanyProfileInput } from '@/lib/services/settings-service'
import { Save, Check } from 'lucide-react'
import { useLocale } from 'next-intl'

interface Props {
  businessId: string
  initialData: CompanyProfileInput & { name: string }
}

export function CompanyProfileForm({ businessId, initialData }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [formData, setFormData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const t = {
    title: isAr ? 'الملف التعريفي للمنشأة والبيانات القانونية' : isTr ? 'Şirket Profili ve Resmi Bilgiler' : 'Company Profile & Information',
    successMsg: isAr ? 'تم تحديث الملف التعريفي للشركة بنجاح!' : isTr ? 'Şirket profili başarıyla güncellendi!' : 'Company profile updated successfully!',
    displayName: isAr ? 'الاسم التجاري للمنشأة *' : isTr ? 'Ticari İşletme Adı *' : 'Business Display Name *',
    legalName: isAr ? 'الاسم القانوني المسجل' : isTr ? 'Resmi Şirket Ünvanı' : 'Legal Registered Name',
    taxNumber: isAr ? 'الرقم الضريبي (VAT / Tax ID)' : isTr ? 'Vergi / KDV Numarası' : 'Tax / VAT Registration #',
    registrationNumber: isAr ? 'رقم السجل التجاري (CR)' : isTr ? 'Ticaret Sicil No' : 'Company Registration #',
    email: isAr ? 'البريد الإلكتروني الرسمي' : isTr ? 'Resmi E-posta' : 'Official Email',
    phone: isAr ? 'رقم الهاتف / الاتصال' : isTr ? 'Telefon Numarası' : 'Phone Number',
    website: isAr ? 'الموقع الإلكتروني' : isTr ? 'Web Sitesi' : 'Website URL',
    country: isAr ? 'الدولة' : isTr ? 'Ülke' : 'Country',
    address: isAr ? 'العنوان الوطني / المقر الرئيسي' : isTr ? 'Açık Adres / Genel Merkez' : 'Physical Address',
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
        body: JSON.stringify({ section: 'company', data: formData }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update company profile')

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="form-label">{t.displayName}</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label">{t.legalName}</label>
            <input
              type="text"
              className="form-control"
              value={formData.legalName || ''}
              onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t.taxNumber}</label>
            <input
              type="text"
              className="form-control"
              value={formData.taxNumber || ''}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t.registrationNumber}</label>
            <input
              type="text"
              className="form-control"
              value={formData.registrationNumber || ''}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t.email}</label>
            <input
              type="email"
              className="form-control"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t.phone}</label>
            <input
              type="tel"
              className="form-control"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t.website}</label>
            <input
              type="url"
              className="form-control"
              value={formData.website || ''}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="form-label">{t.country}</label>
            <input
              type="text"
              className="form-control"
              value={formData.country || ''}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="form-label">{t.address}</label>
          <textarea
            className="form-control"
            rows={2}
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
