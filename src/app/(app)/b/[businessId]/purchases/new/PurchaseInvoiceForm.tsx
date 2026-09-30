'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { postPurchaseInvoiceAction } from '@/actions/purchases/purchase-actions'
import { formatCurrency } from '@/utils/decimal'

interface Supplier {
  id: string
  name: string
  currency: string
}

interface Product {
  id: string
  name: string
  sku: string
  costPrice: number
}

interface Warehouse {
  id: string
  name: string
  code: string
}

interface PurchaseInvoiceFormProps {
  businessId: string
  defaultCurrency: string
  suppliers: Supplier[]
  products: Product[]
  warehouses: Warehouse[]
}

interface LineItem {
  id: string
  productId: string
  description: string
  warehouseId: string
  quantity: number
  unitPrice: number
  taxRatePercent: number
}

export function PurchaseInvoiceForm({
  businessId,
  defaultCurrency,
  suppliers,
  products,
  warehouses,
}: PurchaseInvoiceFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [loading, setLoading] = useState(false)

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [purchaseNumber, setPurchaseNumber] = useState(`PURCH-${Date.now().toString().slice(-6)}`)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency)
  const [exchangeRate, setExchangeRate] = useState(1)
  const [notes, setNotes] = useState('')

  const [lines, setLines] = useState<LineItem[]>([
    {
      id: '1',
      productId: products[0]?.id || '',
      description: products[0]?.name || (isAr ? 'بند مشتريات' : isTr ? 'Alış Kalemi' : 'Purchase Item'),
      warehouseId: warehouses[0]?.id || '',
      quantity: 1,
      unitPrice: products[0]?.costPrice || 50,
      taxRatePercent: 15,
    },
  ])

  const lineCalculations = lines.map((line) => {
    const qty = Number(line.quantity) || 0
    const price = Number(line.unitPrice) || 0
    const taxPct = Number(line.taxRatePercent) || 0

    const net = qty * price
    const tax = (net * taxPct) / 100
    const total = net + tax

    return { net, tax, total }
  })

  const subtotal = lineCalculations.reduce((acc, curr) => acc + curr.net, 0)
  const totalTax = lineCalculations.reduce((acc, curr) => acc + curr.tax, 0)
  const grandTotal = subtotal + totalTax

  const handleAddLine = () => {
    const p = products[0]
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        productId: p?.id || '',
        description: p?.name || (isAr ? 'بند مشتريات' : isTr ? 'Alış Kalemi' : 'Purchase Item'),
        warehouseId: warehouses[0]?.id || '',
        quantity: 1,
        unitPrice: p?.costPrice || 0,
        taxRatePercent: 15,
      },
    ])
  }

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) {
      toast.error(isAr ? 'يجب أن تحتوي فاتورة الشراء على بند واحد على الأقل' : isTr ? 'Alış faturası en az bir kalem içermelidir' : 'Purchase invoice must have at least one line item')
      return
    }
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleLineProductChange = (index: number, productId: string) => {
    const p = products.find((prod) => prod.id === productId)
    setLines((prev) => {
      const next = [...prev]
      next[index].productId = productId
      if (p) {
        next[index].description = p.name
        next[index].unitPrice = p.costPrice
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supplierId) {
      toast.error(isAr ? 'يرجى اختيار المورد' : isTr ? 'Lütfen bir tedarikçi seçin' : 'Please select a supplier')
      return
    }

    if (!purchaseNumber.trim()) {
      toast.error(isAr ? 'رقم فاتورة الشراء مطلوب' : isTr ? 'Alış faturası numarası zorunludur' : 'Purchase invoice number is required')
      return
    }

    setLoading(true)

    try {
      const payload = {
        supplierId,
        purchaseNumber,
        referenceNumber: referenceNumber || undefined,
        purchaseDate: new Date(purchaseDate),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        currencyCode,
        exchangeRate: Number(exchangeRate) || 1,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          productId: l.productId || undefined,
          warehouseId: l.warehouseId || undefined,
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxRatePercent: Number(l.taxRatePercent) || 0,
        })),
      }

      const res = await postPurchaseInvoiceAction(businessId, payload)

      if (res.success) {
        toast.success(
          isAr
            ? `تم ترحيل فاتورة المشتريات ${purchaseNumber} وتحديث المخزون بنجاح!`
            : isTr
            ? `Alış Faturası ${purchaseNumber} kaydedildi ve stok güncellendi!`
            : `Purchase Invoice ${purchaseNumber} posted & inventory updated!`
        )
        router.push(`/b/${businessId}/purchases`)
      } else {
        toast.error(res.error || (isAr ? 'فشل ترحيل فاتورة المشتريات' : isTr ? 'Alış faturası kaydedilemedi' : 'Failed to post purchase invoice'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ غير متوقع' : isTr ? 'Beklenmeyen bir hata oluştu' : 'An unexpected error occurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href={`/b/${businessId}/purchases`} className="btn btn-secondary btn-sm" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={16} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
          </Link>
          <div>
            <h1 className="page-title">
              {isAr ? 'تسجيل فاتورة مشتريات جديدة' : isTr ? 'Alış Faturası Kaydet' : 'Record Purchase Invoice'}
            </h1>
            <p className="page-subtitle">
              {isAr ? 'إثبات فاتورة المورد مع تحديث المخزون بمتوسط التكلفة وذمم الموردين آلياً' : isTr ? 'Otomatik AOM stok maliyeti ve satıcı borç kaydıyla fatura işleyin' : 'Post a supplier bill with automatic WAC inventory & AP posting'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <CheckCircle size={16} />
            {loading
              ? (isAr ? 'جاري الترحيل...' : isTr ? 'Kaydediliyor...' : 'Posting...')
              : (isAr ? 'ترحيل فاتورة المشتريات' : isTr ? 'Alış Faturasını Kaydet' : 'Post Purchase Invoice')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isAr ? 'بيانات المورد والفاتورة' : isTr ? 'Tedarikçi ve Fatura Bilgileri' : 'Supplier & Bill Info'}
            </span>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label required">
                {isAr ? 'المورد' : isTr ? 'Tedarikçi' : 'Supplier'}
              </label>
              <select
                className="form-control"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">{isAr ? '-- اختر المورد --' : isTr ? '-- Tedarikçi Seçin --' : '-- Select Supplier --'}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label required">
                {isAr ? 'رقم الشراء الداخلي' : isTr ? 'Alış Numarası' : 'Purchase #'}
              </label>
              <input
                type="text"
                className="form-control"
                value={purchaseNumber}
                onChange={(e) => setPurchaseNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">
                {isAr ? 'رقم فاتورة / مرجع المورد' : isTr ? 'Satıcı Fatura / Referans No' : 'Vendor Reference / Invoice #'}
              </label>
              <input
                type="text"
                className="form-control"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={isAr ? 'مثال: INV-SUPP-889' : isTr ? 'Örn: VEND-INV-889' : 'e.g. VEND-INV-889'}
              />
            </div>

            <div>
              <label className="form-label required">
                {isAr ? 'تاريخ الشراء' : isTr ? 'Alış Tarihi' : 'Purchase Date'}
              </label>
              <input
                type="date"
                className="form-control"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isAr ? 'العملة وسعر الصرف' : isTr ? 'Para Birimi ve Kur' : 'Currency & Rate'}
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label required">
                {isAr ? 'العملة' : isTr ? 'Para Birimi' : 'Currency'}
              </label>
              <select
                className="form-control"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="SAR">SAR (ر.س)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>

            <div>
              <label className="form-label required">
                {isAr ? 'سعر الصرف (للعملة الأساسية)' : isTr ? 'Döviz Kuru (Ana Para Birimi)' : 'Exchange Rate (to Base)'}
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                className="form-control"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">
            {isAr ? 'أصناف المشتريات واستلام المخزون' : isTr ? 'Alınan Kalemler ve Stok Girişi' : 'Purchased Items & Inventory Receipt'}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddLine}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Plus size={14} />
            {isAr ? 'إضافة بند' : isTr ? 'Satır Ekle' : 'Add Row'}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '22%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'المنتج / الأصل' : isTr ? 'Ürün / Varlık' : 'Product / Asset'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '20%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'الوصف / البيان' : isTr ? 'Açıklama' : 'Description'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '18%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'مستودع الاستلام' : isTr ? 'Giriş Deposu' : 'Receiving Warehouse'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '10%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'الكمية' : isTr ? 'Miktar' : 'Qty'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '12%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'تكلفة الوحدة' : isTr ? 'Birim Maliyet' : 'Unit Cost'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '8%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'الضريبة %' : isTr ? 'Vergi %' : 'Tax %'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '10%', textAlign: isAr ? 'left' : 'right' }}>
                  {isAr ? 'الإجمالي' : isTr ? 'Toplam' : 'Total'}
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontSize: '0.75rem', width: '4%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <select
                      className="form-control"
                      value={line.productId}
                      onChange={(e) => handleLineProductChange(idx, e.target.value)}
                      style={{ fontSize: '0.8125rem' }}
                    >
                      <option value="">{isAr ? '-- صنف يدوي --' : isTr ? '-- Manuel Kalem --' : '-- Manual Item --'}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={line.description}
                      onChange={(e) => {
                        const val = e.target.value
                        setLines((prev) => {
                          const n = [...prev]
                          n[idx].description = val
                          return n
                        })
                      }}
                      style={{ fontSize: '0.8125rem' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <select
                      className="form-control"
                      value={line.warehouseId}
                      onChange={(e) => {
                        const val = e.target.value
                        setLines((prev) => {
                          const n = [...prev]
                          n[idx].warehouseId = val
                          return n
                        })
                      }}
                      style={{ fontSize: '0.8125rem' }}
                    >
                      <option value="">{isAr ? '-- بدون مستودع --' : isTr ? '-- Depo Yok --' : '-- No Warehouse --'}</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={line.quantity}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setLines((prev) => {
                          const n = [...prev]
                          n[idx].quantity = val
                          return n
                        })
                      }}
                      style={{ fontSize: '0.8125rem' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setLines((prev) => {
                          const n = [...prev]
                          n[idx].unitPrice = val
                          return n
                        })
                      }}
                      style={{ fontSize: '0.8125rem' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <input
                      type="number"
                      step="1"
                      className="form-control"
                      value={line.taxRatePercent}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setLines((prev) => {
                          const n = [...prev]
                          n[idx].taxRatePercent = val
                          return n
                        })
                      }}
                      style={{ fontSize: '0.8125rem' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: isAr ? 'left' : 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                    {formatCurrency(lineCalculations[idx].total, currencyCode)}
                  </td>
                  <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                      title={isAr ? 'حذف البند' : isTr ? 'Satırı Sil' : 'Remove Line'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '1.25rem', background: 'var(--bg-page)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: isAr ? 'flex-start' : 'flex-end' }}>
          <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <span>{isAr ? 'المجموع الفرعي:' : isTr ? 'Ara Toplam:' : 'Subtotal:'}</span>
              <span>{formatCurrency(subtotal, currencyCode)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <span>{isAr ? 'مبلغ الضريبة:' : isTr ? 'Vergi Tutarı:' : 'Tax Amount:'}</span>
              <span>{formatCurrency(totalTax, currencyCode)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '0.5rem',
              }}
            >
              <span>{isAr ? 'إجمالي قيمة الفاتورة:' : isTr ? 'Toplam Fatura Tutarı:' : 'Total Bill Amount:'}</span>
              <span style={{ color: 'var(--color-warning)' }}>{formatCurrency(grandTotal, currencyCode)}</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
