'use client'

import React, { useState } from 'react'
import { DocumentType } from '@/lib/services/document-numbering-service'
import { NumberingConfigItem } from '@/lib/services/settings-service'
import { Hash, Check, Save } from 'lucide-react'
import { useLocale } from 'next-intl'

interface Props {
  businessId: string
  initialNumbering: Record<DocumentType, NumberingConfigItem>
}

export function NumberingForm({ businessId, initialNumbering }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const DOC_TYPES: { type: DocumentType; label: string }[] = [
    { type: 'sales_invoice', label: isAr ? 'فواتير المبيعات' : isTr ? 'Satış Faturaları' : 'Sales Invoice' },
    { type: 'purchase_invoice', label: isAr ? 'فواتير المشتريات' : isTr ? 'Alış Faturaları' : 'Purchase Invoice' },
    { type: 'payment', label: isAr ? 'سندات القبض والصرف' : isTr ? 'Tahsilat / Ödeme Makbuzları' : 'Payment Receipt / Voucher' },
    { type: 'expense', label: isAr ? 'سندات المصروفات' : isTr ? 'Gider Kayıtları' : 'Expense Record' },
    { type: 'journal_entry', label: isAr ? 'قيود اليومية المحاسبية' : isTr ? 'Yevmiye Fişleri' : 'Manual Journal Entry' },
    { type: 'inventory_transfer', label: isAr ? 'التحويلات المخزنية' : isTr ? 'Stok Transferleri' : 'Stock Transfer' },
    { type: 'inventory_adjustment', label: isAr ? 'تسويات الجرد المخزني' : isTr ? 'Stok Düzeltmeleri' : 'Stock Adjustment' },
  ]

  const [configs, setConfigs] = useState<Record<DocumentType, NumberingConfigItem>>(initialNumbering)
  const [loading, setLoading] = useState<string | null>(null)
  const [savedType, setSavedType] = useState<string | null>(null)
  const [error, setError] = useState('')

  const t = {
    title: isAr ? 'الترقيم التلقائي وتسلسل المستندات' : isTr ? 'Otomatik Belge Numaralandırma ve Seri Ayarları' : 'Configurable Document Sequences',
    subtitle: isAr
      ? 'تخصيص البادئات، أنماط الترقيم، وعدد الخانات للمستندات المستقبلية. أرقام المستندات الصادرة سابقة تظل ثابتة وغير قابلة للتعديل.'
      : isTr
      ? 'Gelecekteki belgeler için önek, sıra şablonu ve basamak sayısını yapılandırın. Mevcut belge numaraları değiştirilemez.'
      : 'Configure prefix, sequence pattern, and padding for future documents. Existing document numbers are immutable.',
    preview: isAr ? 'معاينة الرقم:' : isTr ? 'Önizleme:' : 'Preview:',
    prefix: isAr ? 'البادئة (Prefix)' : isTr ? 'Önek (Prefix)' : 'Prefix',
    formatPattern: isAr ? 'نمط التنسيق' : isTr ? 'Format Şablonu' : 'Format Pattern',
    padding: isAr ? 'الخانات العشرية (Padding)' : isTr ? 'Basamak Sayısı' : 'Padding (Digits)',
    startingNumber: isAr ? 'رقم البداية' : isTr ? 'Başlangıç No' : 'Starting Number',
    includeYear: isAr ? 'تضمين السنة الحالية في الترقيم ({YYYY})' : isTr ? 'Mevcut yılı seri numarasına dahil et ({YYYY})' : 'Include current year in sequence',
    saved: isAr ? 'تم الحفظ' : isTr ? 'Kaydedildi' : 'Saved',
    saveSequence: isAr ? 'حفظ التسلسل' : isTr ? 'Seriyi Kaydet' : 'Save Sequence',
    saving: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Saving...',
  }

  const handleUpdate = (type: DocumentType, field: keyof NumberingConfigItem, value: any) => {
    setConfigs({
      ...configs,
      [type]: {
        ...configs[type],
        [field]: value,
      },
    })
  }

  const handleSave = async (docType: DocumentType) => {
    setLoading(docType)
    setError('')
    setSavedType(null)

    try {
      const res = await fetch(`/api/b/${businessId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'numbering',
          data: {
            docType,
            config: configs[docType],
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update numbering configuration')

      setSavedType(docType)
      setTimeout(() => setSavedType(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const getPreview = (conf: NumberingConfigItem) => {
    const year = new Date().getFullYear().toString()
    const padded = (conf.startingNumber || 1).toString().padStart(conf.paddingLength || 4, '0')
    let formatted = conf.format || '{PREFIX}-{YYYY}-{SEQ}'
    formatted = formatted.replace('{PREFIX}', conf.prefix || 'DOC')
    formatted = formatted.replace('{SEQ}', padded)
    if (conf.includeYear) {
      formatted = formatted.replace('{YYYY}', year)
      formatted = formatted.replace('{YY}', year.slice(-2))
    } else {
      formatted = formatted.replace(/-?\{YYYY\}-?/g, '-').replace(/\/?\{YYYY\}\/?/g, '/')
      formatted = formatted.replace(/--+/g, '-').replace(/\/\/+/g, '/')
      formatted = formatted.replace(/^-|-$/g, '').replace(/^\/|\/$/g, '')
    }
    return formatted
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Hash size={18} /> {t.title}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {t.subtitle}
          </p>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          {DOC_TYPES.map(({ type, label }) => {
            const conf = configs[type] || {
              prefix: 'DOC',
              format: '{PREFIX}-{YYYY}-{SEQ}',
              startingNumber: 1,
              paddingLength: 4,
              includeYear: true,
            }

            return (
              <div
                key={type}
                style={{
                  background: '#f8fafc',
                  padding: '1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                    {t.preview} <strong style={{ color: 'var(--color-brand-500, #4f46e5)', direction: 'ltr', display: 'inline-block' }}>{getPreview(conf)}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.prefix}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={conf.prefix}
                      onChange={(e) => handleUpdate(type, 'prefix', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.formatPattern}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={conf.format}
                      onChange={(e) => handleUpdate(type, 'format', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.padding}</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="form-control"
                      value={conf.paddingLength}
                      onChange={(e) => handleUpdate(type, 'paddingLength', parseInt(e.target.value, 10) || 4)}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.startingNumber}</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={conf.startingNumber}
                      onChange={(e) => handleUpdate(type, 'startingNumber', parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={conf.includeYear}
                      onChange={(e) => handleUpdate(type, 'includeYear', e.target.checked)}
                    />
                    {t.includeYear}
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {savedType === type && (
                      <span style={{ fontSize: '0.8rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Check size={14} /> {t.saved}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSave(type)}
                      className="btn btn-secondary btn-sm"
                      disabled={loading === type}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Save size={14} /> {loading === type ? t.saving : t.saveSequence}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
