'use client'

import React, { useState } from 'react'
import { AccountingDefaultsInput } from '@/lib/services/settings-service'
import { Save, Check, BookOpen } from 'lucide-react'
import { useLocale } from 'next-intl'

interface AccountItem {
  id: string
  code: string
  name: string
  type: string
}

interface Props {
  businessId: string
  initialData: AccountingDefaultsInput
  accounts: AccountItem[]
}

export function AccountingDefaultsForm({ businessId, initialData, accounts }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [formData, setFormData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const t = {
    title: isAr ? 'ربط الحسابات الافتراضية في شجرة الحسابات' : isTr ? 'Varsayılan Muhasebe Hesap Eşleştirmesi' : 'Default Chart of Accounts Mapping',
    subtitle: isAr
      ? 'تحديد الحسابات الدفترية القياسية المستخدمة عند إنشاء قيود اليومية آلياً للفواتير والسندات والمخزون.'
      : isTr
      ? 'Fatura, makbuz ve stok hareketlerinde otomatik yevmiye kaydı oluşturulurken kullanılacak varsayılan hesapları belirleyin.'
      : 'Specify the standard ledger accounts used when automatically generating journal entries for transactions.',
    selectAccount: isAr ? '— اختر الحساب —' : isTr ? '— Hesap Seçin —' : '— Select Account —',
    arAccount: isAr ? 'حساب العملاء والمدينون (أصول / AR)' : isTr ? 'Alıcılar / Müşteriler Hesabı (Varlık / AR)' : 'Accounts Receivable (Asset)',
    apAccount: isAr ? 'حساب الموردين والدائنون (خصوم / AP)' : isTr ? 'Satıcılar / Tedarikçiler Hesabı (Kaynak / AP)' : 'Accounts Payable (Liability)',
    salesRevenue: isAr ? 'حساب إيرادات المبيعات (إيرادات)' : isTr ? 'Yurtiçi Satış Gelirleri (Gelir)' : 'Sales Revenue (Revenue)',
    inventory: isAr ? 'حساب المخزون والبضاعة (أصول / مصروف)' : isTr ? 'Ticari Mallar / Stok Hesabı (Varlık/Gider)' : 'Inventory / Purchases (Asset/Expense)',
    cogs: isAr ? 'حساب تكلفة البضاعة المباعة (مصروف / COGS)' : isTr ? 'Satılan Ticari Mallar Maliyeti (Gider / COGS)' : 'Cost of Goods Sold (Expense)',
    salesTax: isAr ? 'حساب ضريبة المخرجات / القيمة المضافة (خصوم)' : isTr ? 'Hesaplanan KDV (Kaynak)' : 'Sales Tax / Output VAT (Liability)',
    purchaseTax: isAr ? 'حساب ضريبة المدخلات / القيمة المضافة (أصول)' : isTr ? 'İndirilecek KDV (Varlık)' : 'Purchase Tax / Input VAT (Asset)',
    retainedEarnings: isAr ? 'حساب الأرباح المبقاة / المدورة (حقوق ملكية)' : isTr ? 'Geçmiş Yıllar Karları / Dağıtılmamış Kâr (Özkaynak)' : 'Retained Earnings (Equity)',
    defaultExpense: isAr ? 'حساب المصروفات العمومية الافتراضي (مصروف)' : isTr ? 'Varsayılan Genel Yönetim Giderleri (Gider)' : 'Default General Expense (Expense)',
    successMsg: isAr ? 'تم حفظ ربط الحسابات الافتراضية بنجاح!' : isTr ? 'Varsayılan hesaplar başarıyla kaydedildi!' : 'Default accounts saved successfully!',
    saveBtn: isAr ? 'حفظ إعدادات الربط' : isTr ? 'Eşleştirmeleri Kaydet' : 'Save Mappings',
    saving: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Saving...',
  }

  const filterAccounts = (types: string[]) => {
    return accounts.filter((a) => types.includes(a.type.toLowerCase()))
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
        body: JSON.stringify({ section: 'accounting', data: formData }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update accounting defaults')

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
          <BookOpen size={18} /> {t.title}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <label className="form-label">{t.arAccount}</label>
            <select
              className="form-control"
              value={formData.arAccountId || ''}
              onChange={(e) => setFormData({ ...formData, arAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['asset']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.apAccount}</label>
            <select
              className="form-control"
              value={formData.apAccountId || ''}
              onChange={(e) => setFormData({ ...formData, apAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['liability']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.salesRevenue}</label>
            <select
              className="form-control"
              value={formData.salesRevenueAccountId || ''}
              onChange={(e) => setFormData({ ...formData, salesRevenueAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['revenue']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.inventory}</label>
            <select
              className="form-control"
              value={formData.inventoryAccountId || ''}
              onChange={(e) => setFormData({ ...formData, inventoryAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['asset', 'expense']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.cogs}</label>
            <select
              className="form-control"
              value={formData.cogsAccountId || ''}
              onChange={(e) => setFormData({ ...formData, cogsAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['expense']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.salesTax}</label>
            <select
              className="form-control"
              value={formData.salesTaxAccountId || ''}
              onChange={(e) => setFormData({ ...formData, salesTaxAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['liability']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.purchaseTax}</label>
            <select
              className="form-control"
              value={formData.purchaseTaxAccountId || ''}
              onChange={(e) => setFormData({ ...formData, purchaseTaxAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['asset']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.retainedEarnings}</label>
            <select
              className="form-control"
              value={formData.retainedEarningsAccountId || ''}
              onChange={(e) => setFormData({ ...formData, retainedEarningsAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['equity']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.defaultExpense}</label>
            <select
              className="form-control"
              value={formData.defaultExpenseAccountId || ''}
              onChange={(e) => setFormData({ ...formData, defaultExpenseAccountId: e.target.value || null })}
            >
              <option value="">{t.selectAccount}</option>
              {filterAccounts(['expense']).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
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
