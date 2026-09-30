'use client'

import React, { useState } from 'react'
import { Plus, Check, Save } from 'lucide-react'
import { useLocale } from 'next-intl'
import { AccountSearchSelect } from '@/components/accounting/AccountSearchSelect'

interface TaxItem {
  id: string
  name: string
  code: string
  rate: number
  taxType: string
  salesAccountId?: string | null
  purchaseAccountId?: string | null
  isDefault: boolean
  isActive: boolean
  salesAccount?: { id: string; code: string; name: string } | null
  purchaseAccount?: { id: string; code: string; name: string } | null
}

interface AccountItem {
  id: string
  code: string
  name: string
  type: string
}

interface Props {
  businessId: string
  initialTaxes: TaxItem[]
  accounts: AccountItem[]
}

export function TaxesForm({ businessId, initialTaxes, accounts }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [taxes, setTaxes] = useState<TaxItem[]>(initialTaxes)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // New tax state
  const [newTax, setNewTax] = useState({
    name: '',
    code: '',
    rate: 15,
    taxType: 'percentage',
    salesAccountId: '',
    purchaseAccountId: '',
    isDefault: false,
  })

  const t = {
    title: isAr ? 'إعدادات الضرائب وربط الحسابات المحاسبية' : isTr ? 'Vergi Yapılandırması ve Hesap Eşleştirmesi' : 'Tax Configuration & Accounts Mapping',
    subtitle: isAr
      ? 'تحديد معدلات ضريبة القيمة المضافة وربطها بحسابات الالتزامات والأصول في شجرة الحسابات'
      : isTr
      ? 'Satış ve alış KDV oranlarını belirleyin ve Genel Muhasebe hesaplarıyla eşleştirin'
      : 'Define sales and purchase tax rates and link them to General Ledger liability/asset accounts',
    addTaxBtn: isAr ? 'إضافة معدل ضريبي' : isTr ? 'Yeni Vergi Oranı Ekle' : 'Add Tax Rate',
    newTaxTitle: isAr ? 'إضافة معدل ضريبي جديد' : isTr ? 'Yeni Vergi Oranı Tanımla' : 'New Tax Rate',
    taxName: isAr ? 'اسم الضريبة *' : isTr ? 'Vergi Adı *' : 'Tax Name *',
    taxNamePlaceholder: isAr ? 'مثال: ضريبة القيمة المضافة 15%' : isTr ? 'Örn: KDV %20' : 'e.g. VAT 15%',
    code: isAr ? 'الرمز التعريفي *' : isTr ? 'Vergi Kodu *' : 'Code *',
    codePlaceholder: isAr ? 'مثال: VAT15' : isTr ? 'Örn: KDV20' : 'e.g. VAT15',
    rate: isAr ? 'النسبة المئوية (%) *' : isTr ? 'Oran (%) *' : 'Rate (%) *',
    outputAcc: isAr ? 'حساب ضريبة المخرجات (المبيعات) في الدليل' : isTr ? 'Hesaplanan KDV Hesabı (Satışlar)' : 'Output Tax Account (Sales)',
    inputAcc: isAr ? 'حساب ضريبة المدخلات (المشتريات) في الدليل' : isTr ? 'İndirilecek KDV Hesabı (Alışlar)' : 'Input Tax Account (Purchases)',
    searchAccPlaceholder: isAr ? '— ابحث برقم أو اسم الحساب —' : isTr ? '— Hesap Kodu veya Adı Ara —' : '— Search by account code or name —',
    defaultCheck: isAr ? 'تعيين كضريبة افتراضية للفواتير الجديدة' : isTr ? 'Yeni faturalarda varsayılan vergi olarak kullan' : 'Set as default tax for new invoices',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    saveTax: isAr ? 'حفظ الضريبة' : isTr ? 'Vergiyi Kaydet' : 'Save Tax',
    creating: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Creating...',
    thName: isAr ? 'اسم الضريبة' : isTr ? 'Vergi Adı' : 'Name',
    thCode: isAr ? 'الرمز' : isTr ? 'Kod' : 'Code',
    thRate: isAr ? 'النسبة' : isTr ? 'Oran' : 'Rate',
    thSalesAcc: isAr ? 'حساب ضريبة المبيعات' : isTr ? 'Satış KDV Hesabı' : 'Sales Account',
    thPurchaseAcc: isAr ? 'حساب ضريبة المشتريات' : isTr ? 'Alış KDV Hesabı' : 'Purchase Account',
    thStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    thActions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    defaultBadge: isAr ? 'افتراضية' : isTr ? 'Varsayılan' : 'Default',
    activeBadge: isAr ? 'نشطة' : isTr ? 'Aktif' : 'Active',
    inactiveBadge: isAr ? 'معطلة' : isTr ? 'Pasif' : 'Inactive',
    setDefaultBtn: isAr ? 'تعيين كافتراضية' : isTr ? 'Varsayılan Yap' : 'Set Default',
    deactivateBtn: isAr ? 'تعطيل' : isTr ? 'Pasifleştir' : 'Deactivate',
    activateBtn: isAr ? 'تفعيل' : isTr ? 'Aktifleştir' : 'Activate',
    successMsg: isAr ? 'تم إنشاء الضريبة بنجاح!' : isTr ? 'Vergi oranı başarıyla oluşturuldu!' : 'Tax rate created successfully!',
  }

  const handleCreateTax = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/b/${businessId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'tax',
          data: {
            name: newTax.name,
            code: newTax.code,
            rate: Number(newTax.rate),
            taxType: newTax.taxType,
            salesAccountId: newTax.salesAccountId || null,
            purchaseAccountId: newTax.purchaseAccountId || null,
            isDefault: newTax.isDefault,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create tax')

      setTaxes([data.result, ...taxes])
      setShowAdd(false)
      setNewTax({
        name: '',
        code: '',
        rate: 15,
        taxType: 'percentage',
        salesAccountId: '',
        purchaseAccountId: '',
        isDefault: false,
      })
      setSuccess(t.successMsg)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (tax: TaxItem) => {
    try {
      const res = await fetch(`/api/b/${businessId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'tax',
          data: {
            taxId: tax.id,
            isActive: !tax.isActive,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update tax')

      setTaxes(taxes.map((t) => (t.id === tax.id ? { ...t, isActive: !t.isActive } : t)))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSetDefault = async (tax: TaxItem) => {
    try {
      const res = await fetch(`/api/b/${businessId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'tax',
          data: {
            taxId: tax.id,
            isDefault: true,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set default tax')

      setTaxes(taxes.map((t) => ({ ...t, isDefault: t.id === tax.id })))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="card-title">{t.title}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {t.subtitle}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> {t.addTaxBtn}
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

          {showAdd && (
            <form onSubmit={handleCreateTax} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>{t.newTaxTitle}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">{t.taxName}</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t.taxNamePlaceholder}
                    value={newTax.name}
                    onChange={(e) => setNewTax({ ...newTax, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">{t.code}</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t.codePlaceholder}
                    value={newTax.code}
                    onChange={(e) => setNewTax({ ...newTax, code: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">{t.rate}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={newTax.rate}
                    onChange={(e) => setNewTax({ ...newTax, rate: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">{t.outputAcc}</label>
                  <AccountSearchSelect
                    accounts={accounts}
                    value={newTax.salesAccountId || ''}
                    onChange={(val) => setNewTax({ ...newTax, salesAccountId: val || '' })}
                    placeholder={t.searchAccPlaceholder}
                  />
                </div>
                <div>
                  <label className="form-label">{t.inputAcc}</label>
                  <AccountSearchSelect
                    accounts={accounts}
                    value={newTax.purchaseAccountId || ''}
                    onChange={(val) => setNewTax({ ...newTax, purchaseAccountId: val || '' })}
                    placeholder={t.searchAccPlaceholder}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newTax.isDefault}
                    onChange={(e) => setNewTax({ ...newTax, isDefault: e.target.checked })}
                  />
                  {t.defaultCheck}
                </label>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">
                    {t.cancel}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? t.creating : t.saveTax}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Taxes Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thName}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thCode}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thRate}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thSalesAcc}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thPurchaseAcc}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thStatus}</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: isAr ? 'left' : 'right' }}>{t.thActions}</th>
                </tr>
              </thead>
              <tbody>
                {taxes.map((tax) => (
                  <tr key={tax.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                      {tax.name}
                      {tax.isDefault && (
                        <span className="badge badge-success" style={{ marginInlineStart: '0.5rem', fontSize: '0.7rem' }}>
                          {t.defaultBadge}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{tax.code}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600, direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>{Number(tax.rate)}%</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {tax.salesAccount ? `${tax.salesAccount.code} - ${tax.salesAccount.name}` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {tax.purchaseAccount ? `${tax.purchaseAccount.code} - ${tax.purchaseAccount.name}` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge ${tax.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {tax.isActive ? t.activeBadge : t.inactiveBadge}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: isAr ? 'left' : 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {!tax.isDefault && (
                          <button
                            onClick={() => handleSetDefault(tax)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            {t.setDefaultBtn}
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(tax)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          {tax.isActive ? t.deactivateBtn : t.activateBtn}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
