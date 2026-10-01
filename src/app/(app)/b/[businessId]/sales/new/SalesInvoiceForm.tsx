'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, CheckCircle, Coins, Wallet, Landmark } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { postSalesInvoiceAction } from '@/actions/sales/sales-actions'
import { formatCurrency } from '@/utils/decimal'

interface Customer {
  id: string
  name: string
  currency: string
  balance?: number
  creditLimit?: number
}

interface Product {
  id: string
  name: string
  sku: string
  salePrice: number
  productType: string
}

interface Warehouse {
  id: string
  name: string
  code: string
}

export interface TreasuryAccountOption {
  id: string
  name: string
  currencyCode: string
  type: 'cash' | 'bank'
}

interface SalesInvoiceFormProps {
  businessId: string
  defaultCurrency: string
  customers: Customer[]
  products: Product[]
  warehouses: Warehouse[]
  treasuryAccounts?: TreasuryAccountOption[]
}

interface LineItem {
  id: string
  productId: string
  description: string
  warehouseId: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRatePercent: number
}

export function SalesInvoiceForm({
  businessId,
  defaultCurrency,
  customers,
  products,
  warehouses,
  treasuryAccounts = [],
}: SalesInvoiceFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [loading, setLoading] = useState(false)
  const [invoiceType, setInvoiceType] = useState<'credit' | 'cash'>('credit')
  const [selectedTreasuryId, setSelectedTreasuryId] = useState(treasuryAccounts[0]?.id || '')

  const [customerId, setCustomerId] = useState(customers[0]?.id || '')
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`)
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency)
  const [exchangeRate, setExchangeRate] = useState(1)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')

  const [lines, setLines] = useState<LineItem[]>([
    {
      id: '1',
      productId: products[0]?.id || '',
      description: products[0]?.name || (isAr ? 'بند مبيعات' : isTr ? 'Satış Kalemi' : 'Sales Item'),
      warehouseId: warehouses[0]?.id || '',
      quantity: 1,
      unitPrice: products[0]?.salePrice || 100,
      discountPercent: 0,
      taxRatePercent: 15,
    },
  ])

  // Live Calculations
  const lineCalculations = lines.map((line) => {
    const qty = Number(line.quantity) || 0
    const price = Number(line.unitPrice) || 0
    const discPct = Number(line.discountPercent) || 0
    const taxPct = Number(line.taxRatePercent) || 0

    const gross = qty * price
    const discount = (gross * discPct) / 100
    const net = gross - discount
    const tax = (net * taxPct) / 100
    const total = net + tax

    return { gross, discount, net, tax, total }
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
        description: p?.name || (isAr ? 'بند مبيعات' : isTr ? 'Satış Kalemi' : 'Sales Item'),
        warehouseId: warehouses[0]?.id || '',
        quantity: 1,
        unitPrice: p?.salePrice || 0,
        discountPercent: 0,
        taxRatePercent: 15,
      },
    ])
  }

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) {
      toast.error(isAr ? 'يجب أن تحتوي الفاتورة على بند واحد على الأقل' : isTr ? 'Fatura en az bir kalem içermelidir' : 'Invoice must have at least one line item')
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
        next[index].unitPrice = p.salePrice
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (invoiceType === 'credit' && !customerId) {
      toast.error(isAr ? 'يرجى تحديد العميل للفاتورة الآجلة' : isTr ? 'Lütfen vadeli fatura için bir müşteri seçin' : 'Please select a customer for credit invoice')
      return
    }

    if (invoiceType === 'cash' && treasuryAccounts.length > 0 && !selectedTreasuryId) {
      toast.error(isAr ? 'يرجى تحديد حساب الخزينة أو البنك لتحصيل المبلغ' : isTr ? 'Lütfen tahsilat için kasa veya banka hesabı seçin' : 'Please select a cash or bank account for settlement')
      return
    }

    if (!invoiceNumber.trim()) {
      toast.error(isAr ? 'رقم الفاتورة مطلوب' : isTr ? 'Fatura numarası zorunludur' : 'Invoice number is required')
      return
    }

    setLoading(true)

    try {
      const selectedTreasury = treasuryAccounts.find((t) => t.id === selectedTreasuryId)
      const isCashSale = invoiceType === 'cash'

      const payload = {
        customerId: customerId || undefined,
        isCash: isCashSale,
        cashAccountId: isCashSale && selectedTreasury?.type === 'cash' ? selectedTreasury.id : undefined,
        bankAccountId: isCashSale && selectedTreasury?.type === 'bank' ? selectedTreasury.id : undefined,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: isCashSale ? undefined : (dueDate ? new Date(dueDate) : undefined),
        currencyCode,
        exchangeRate: Number(exchangeRate) || 1,
        notes: notes || undefined,
        terms: terms || undefined,
        lines: lines.map((l) => ({
          productId: l.productId || undefined,
          warehouseId: l.warehouseId || undefined,
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountPercent: Number(l.discountPercent) || 0,
          taxRatePercent: Number(l.taxRatePercent) || 0,
        })),
      }

      const res = await postSalesInvoiceAction(businessId, payload)

      if (res.success) {
        toast.success(
          isAr
            ? isCashSale
              ? `تم إصدار الفاتورة النقدية ${invoiceNumber} وقبض المبلغ في الخزينة بنجاح!`
              : `تم إصدار وترحيل فاتورة المبيعات ${invoiceNumber} بنجاح!`
            : isTr
            ? `Satış Faturası ${invoiceNumber} başarıyla kaydedildi!`
            : `Sales Invoice ${invoiceNumber} posted successfully!`
        )
        router.push(`/b/${businessId}/sales`)
      } else {
        toast.error(res.error || (isAr ? 'فشل ترحيل الفاتورة' : isTr ? 'Fatura kaydedilemedi' : 'Failed to post invoice'))
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
          <Link href={`/b/${businessId}/sales`} className="btn btn-secondary btn-sm" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={16} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
          </Link>
          <div>
            <h1 className="page-title">
              {isAr ? 'إنشاء فاتورة مبيعات جديدة' : isTr ? 'Satış Faturası Oluştur' : 'Create Sales Invoice'}
            </h1>
            <p className="page-subtitle">
              {isAr ? 'إصدار فاتورة عميل مع ترحيل الإيرادات وقيود الأستاذ العام والمخزون آلياً' : isTr ? 'Otomatik gelir, stok ve büyük defter kaydıyla müşteri faturası kesin' : 'Post a customer invoice with automatic revenue and GL posting'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} id="post-invoice-btn">
            {invoiceType === 'cash' ? <Coins size={16} /> : <CheckCircle size={16} />}
            {loading
              ? (isAr ? 'جاري الترحيل...' : isTr ? 'Kaydediliyor...' : 'Posting...')
              : invoiceType === 'cash'
              ? (isAr ? 'ترحيل وقبض الفاتورة نقدياً' : isTr ? 'Nakit Faturayı Kes' : 'Post Cash Invoice')
              : (isAr ? 'ترحيل الفاتورة' : isTr ? 'Faturayı Kes' : 'Post Invoice')}
          </button>
        </div>
      </div>

      {/* Invoice Type Selection Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isAr ? 'نوع الفاتورة وطريقة السداد:' : isTr ? 'Fatura Türü ve Ödeme:' : 'Invoice Type & Settlement:'}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  background: invoiceType === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: invoiceType === 'cash' ? '#059669' : '#2563eb',
                }}
              >
                {invoiceType === 'cash'
                  ? (isAr ? 'فاتورة نقدية مسددة فوراً' : isTr ? 'Peşin / Nakit' : 'Cash (Paid)')
                  : (isAr ? 'فاتورة آجلة على الحساب' : isTr ? 'Vadeli / Açık Hesap' : 'Credit (AR)')}
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {invoiceType === 'cash'
                ? (isAr ? 'تُسجل الفاتورة كمدفوعة فوراً مع توريد المبلغ إلى الصندوق أو البنك، ولا يُحمّل العميل أي ذمم دائنة أو ديون.' : isTr ? 'Fatura anında ödenmiş olarak kaydedilir ve tutar kasaya/bankaya aktarılır.' : 'Invoice is settled immediately, depositing funds to cash/bank with zero receivable debt.')
                : (isAr ? 'تُسجل الفاتورة كذمة مدينة مستحقة على حساب العميل حتى يتم تحصيلها وسدادها لاحقاً.' : isTr ? 'Fatura müşteri carisine borç olarak kaydedilir ve daha sonra tahsil edilir.' : 'Invoice is recorded as accounts receivable debt against customer balance.')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-page)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => {
                setInvoiceType('credit')
                if (!customerId && customers.length > 0) setCustomerId(customers[0].id)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                background: invoiceType === 'credit' ? 'var(--color-brand-500)' : 'transparent',
                color: invoiceType === 'credit' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              <Landmark size={16} />
              {isAr ? 'فاتورة آجلة (على الحساب)' : isTr ? 'Vadeli (Açık Hesap)' : 'Credit Invoice'}
            </button>

            <button
              type="button"
              onClick={() => setInvoiceType('cash')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                background: invoiceType === 'cash' ? '#10b981' : 'transparent',
                color: invoiceType === 'cash' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              <Coins size={16} />
              {isAr ? 'فاتورة نقدية (مسددة فوراً)' : isTr ? 'Nakit / Peşin' : 'Cash Invoice'}
            </button>
          </div>
        </div>
      </div>

      {/* Form Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Basic Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isAr ? 'بيانات الفاتورة والعميل' : isTr ? 'Fatura ve Müşteri Bilgileri' : 'Invoice Details'}
            </span>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className={`form-label ${invoiceType === 'credit' ? 'required' : ''}`}>
                {isAr ? 'العميل' : isTr ? 'Müşteri' : 'Customer'}
                {invoiceType === 'cash' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginInlineStart: '0.375rem', fontWeight: 'normal' }}>
                    {isAr ? '(اختياري في الفاتورة النقدية)' : isTr ? '(Nakit faturada isteğe bağlı)' : '(Optional for cash)'}
                  </span>
                )}
              </label>
              <select
                className="form-control"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required={invoiceType === 'credit'}
              >
                {invoiceType === 'cash' ? (
                  <option value="">{isAr ? '-- عميل نقدي عام (زبون صالة) --' : isTr ? '-- Perakende Müşteri --' : '-- Walk-in Cash Customer --'}</option>
                ) : (
                  <option value="">{isAr ? '-- اختر العميل --' : isTr ? '-- Müşteri Seçin --' : '-- Select Customer --'}</option>
                )}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
              {(() => {
                const sel = customers.find((c) => c.id === customerId)
                if (!sel) return null
                const bal = Number(sel.balance || 0)
                const lim = sel.creditLimit ? Number(sel.creditLimit) : null
                const isOver = invoiceType === 'credit' && lim !== null && (bal + grandTotal > lim)
                return (
                  <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: isOver ? '#ef4444' : '#64748b', fontWeight: isOver ? 600 : 400 }}>
                    {isAr ? 'الرصيد الحالي: ' : isTr ? 'Mevcut Bakiye: ' : 'Current Bal: '}{formatCurrency(bal, sel.currency)} {lim !== null ? `| ${isAr ? 'الحد الائتماني: ' : isTr ? 'Kredi Limiti: ' : 'Limit: '}${formatCurrency(lim, sel.currency)}` : ''}
                    {isOver && (isAr ? ' ⚠️ تحذير: الفاتورة تتجاوز الحد الائتماني للعميل' : isTr ? ' ⚠️ Uyarı: Fatura müşteri kredi limitini aşıyor' : ' ⚠️ Warning: Invoice exceeds customer credit limit')}
                  </div>
                )
              })()}
            </div>

            {/* Treasury Selector when Cash, or Due Date when Credit */}
            {invoiceType === 'cash' ? (
              <div>
                <label className="form-label required">
                  {isAr ? 'الصندوق / الحساب البنكي المستلم' : isTr ? 'Tahsilat Kasası / Banka' : 'Destination Treasury / Account'}
                </label>
                {treasuryAccounts.length > 0 ? (
                  <select
                    className="form-control"
                    value={selectedTreasuryId}
                    onChange={(e) => setSelectedTreasuryId(e.target.value)}
                    required
                  >
                    {treasuryAccounts.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.type === 'cash' ? '💵 ' : '🏦 '}
                        {t.name} ({t.currencyCode})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '0.5rem', background: 'var(--bg-page)', borderRadius: '6px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {isAr ? 'صندوق النقدية العام (النظام)' : 'General System Cash Account'}
                  </div>
                )}
                <span style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                  {isAr ? '✓ سيتم توريد وقبض إجمالي الفاتورة في هذا الحساب فوراً' : '✓ Total amount will be deposited into this account immediately'}
                </span>
              </div>
            ) : (
              <div>
                <label className="form-label">
                  {isAr ? 'تاريخ الاستحقاق' : isTr ? 'Vade Tarihi' : 'Due Date'}
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="form-label required">
                {isAr ? 'رقم الفاتورة' : isTr ? 'Fatura Numarası' : 'Invoice Number'}
              </label>
              <input
                type="text"
                className="form-control"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label required">
                {isAr ? 'تاريخ الفاتورة' : isTr ? 'Fatura Tarihi' : 'Invoice Date'}
              </label>
              <input
                type="date"
                className="form-control"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Currency & Exchange */}
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
                <option value="AED">AED (د.إ)</option>
                <option value="SAR">SAR (ر.س)</option>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                1 {currencyCode} = {exchangeRate} {isAr ? 'العملة الأساسية' : isTr ? 'Ana Para Birimi' : 'Base Currency'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">
            {isAr ? 'بنود وأصناف الفاتورة' : isTr ? 'Fatura Kalemleri' : 'Line Items'}
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
                  {isAr ? 'المنتج / الخدمة' : isTr ? 'Ürün / Hizmet' : 'Product / Service'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '20%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'الوصف / البيان' : isTr ? 'Açıklama' : 'Description'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '18%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'المستودع' : isTr ? 'Depo' : 'Warehouse'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '10%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'الكمية' : isTr ? 'Miktar' : 'Qty'}
                </th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '12%', textAlign: isAr ? 'right' : 'left' }}>
                  {isAr ? 'سعر الوحدة' : isTr ? 'Birim Fiyat' : 'Unit Price'}
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

        {/* Calculation Summary Footer */}
        <div style={{ padding: '1.25rem', background: 'var(--bg-page)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: isAr ? 'flex-start' : 'flex-end' }}>
          <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
              <span>{isAr ? 'المبلغ الإجمالي:' : isTr ? 'Genel Toplam:' : 'Total Amount:'}</span>
              <span style={{ color: 'var(--color-brand-500)' }}>{formatCurrency(grandTotal, currencyCode)}</span>
            </div>

            {invoiceType === 'cash' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#10b981', fontWeight: 600, borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span>{isAr ? 'المسدد نقداً فوراً:' : isTr ? 'Peşin Ödenen:' : 'Paid in Cash:'}</span>
                  <span>{formatCurrency(grandTotal, currencyCode)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                  <span>{isAr ? 'المتبقي على العميل:' : isTr ? 'Kalan Bakiye:' : 'Balance Due:'}</span>
                  <span>{formatCurrency(0, currencyCode)}</span>
                </div>
                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#065f46', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={15} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>{isAr ? 'فاتورة نقدية مسددة بالكامل - سيتم توريد المبلغ للخزينة مباشرة' : 'Fully paid cash invoice - will be deposited to treasury immediately'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {isAr ? 'الملاحظات وشروط السداد' : isTr ? 'Notlar ve Ödeme Şartları' : 'Notes & Terms'}
          </span>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="form-label">
              {isAr ? 'ملاحظات (تظهر في الفاتورة المطبوعة)' : isTr ? 'Notlar (faturada görünür)' : 'Notes (visible on invoice)'}
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? 'شكراً لتعاملكم معنا!' : isTr ? 'Bizi tercih ettiğiniz için teşekkür ederiz!' : 'Thank you for your business!'}
            />
          </div>
          <div>
            <label className="form-label">
              {isAr ? 'شروط السداد والدفع' : isTr ? 'Ödeme Şartları' : 'Payment Terms'}
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder={isAr ? 'السداد مستحق خلال 30 يوماً من تاريخ الفاتورة.' : isTr ? 'Fatura tarihinden itibaren 30 gün içinde ödenmelidir.' : 'Net 30 days. Late payments subject to interest.'}
            />
          </div>
        </div>
      </div>
    </form>
  )
}
