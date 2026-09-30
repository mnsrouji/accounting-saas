'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { adjustStockAction } from '@/actions/inventory/inventory-actions'

export default function InventoryAdjustmentPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const [loading, setLoading] = useState(false)

  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'adjustment_increase' | 'adjustment_decrease'>('adjustment_increase')
  const [quantity, setQuantity] = useState<number>(1)
  const [reason, setReason] = useState('')

  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([])

  const t = {
    back: isAr ? 'العودة للمخزون' : isTr ? 'Stoka Dön' : 'Back to Inventory',
    title: isAr ? 'تسويات الجرد المخزني' : isTr ? 'Stok Sayım ve Düzeltme' : 'Stock Count Adjustment',
    subtitle: isAr
      ? 'تعديل كميات المخزون ومطابقة الجرد الفعلي مع إنشاء قيود اليومية المحاسبية آلياً'
      : isTr
      ? 'Fiziksel sayım farklarını düzeltin ve otomatik yevmiye kayıtları oluşturun'
      : 'Adjust inventory stock quantities and reconcile physical inventory with GL entries',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    postBtn: isAr ? 'ترحيل التسوية' : isTr ? 'Düzeltmeyi Kaydet' : 'Post Adjustment',
    posting: isAr ? 'جاري الترحيل...' : isTr ? 'Kaydediliyor...' : 'Posting...',
    cardTitle: isAr ? 'تفاصيل ومعايير التسوية' : isTr ? 'Düzeltme Ayrıntıları' : 'Adjustment Details & Parameters',
    cardSubtitle: isAr
      ? 'اختر الصنف والمستودع المعني وحدد نوع التسوية (زيادة أو عجز)'
      : isTr
      ? 'Ürün, ilgili depo ve düzeltme yönünü (fazlalık veya fire) seçin'
      : 'Select item, target warehouse, and specify adjustment direction',
    stockInBadge: isAr ? '+ تسوية زيادة' : isTr ? '+ Stok Fazlası' : '+ Stock In',
    stockOutBadge: isAr ? '- تسوية عجز/تالف' : isTr ? '- Stok Firesi/Eksik' : '- Stock Out',
    prodLabel: isAr ? 'الصنف / المنتج *' : isTr ? 'Ürün / Stok Kalemi *' : 'Product / Inventory Item *',
    selectProd: isAr ? '-- اختر الصنف --' : isTr ? '-- Ürün Seçin --' : '-- Select Product --',
    whLabel: isAr ? 'المستودع المعني *' : isTr ? 'İlgili Depo *' : 'Fulfillment Warehouse *',
    selectWh: isAr ? '-- اختر المستودع --' : isTr ? '-- Depo Seçin --' : '-- Select Warehouse --',
    actionLabel: isAr ? 'نوع حركة التسوية *' : isTr ? 'Düzeltme Türü *' : 'Adjustment Action *',
    increaseOpt: isAr ? 'زيادة مخزون (+) — فائض جرد / بضاعة معثور عليها' : isTr ? 'Stok Artışı (+) — Sayım Fazlası / Bulunan Mal' : 'Stock Increase (+) — Found / Surplus',
    decreaseOpt: isAr ? 'عجز مخزون (-) — تالف / مفقود / انتهاء صلاحية' : isTr ? 'Stok Azalışı (-) — Hasar / Fire / Son Kullanma' : 'Stock Decrease (-) — Damaged / Loss / Expired',
    qtyLabel: isAr ? 'كمية التسوية (بالوحدات) *' : isTr ? 'Düzeltme Miktarı (Adet) *' : 'Adjustment Quantity (Units) *',
    qtyPlaceholder: isAr ? 'أدخل الكمية...' : isTr ? 'Miktarı girin...' : 'Enter quantity...',
    reasonLabel: isAr ? 'سبب ومبرر التسوية المحاسبي *' : isTr ? 'Düzeltme Nedeni ve Gerekçe *' : 'Audit Reason & Justification *',
    reasonPlaceholder: isAr
      ? 'مثال: تسوية جرد دوري ربع سنوي / إتلاف بضاعة منتهية الصلاحية'
      : isTr
      ? 'Örn: Dönemsel sayım farkı / Hasarlı ürünün kayıttan düşülmesi'
      : 'e.g. Periodic physical stock count reconciliation / Damaged items write-off',
    hint: isAr
      ? 'سيتم تسجيل هذا المبرر بشكل دائم في سجل حركات المخزون وقيد اليومية المحاسبي.'
      : isTr
      ? 'Bu açıklama stok hareket geçmişinde ve muhasebe yevmiye maddesinde kalıcı olarak saklanacaktır.'
      : 'This explanation will be permanently recorded in the Inventory Movement log and Journal Entry.',
    errRequired: isAr ? 'الصنف، المستودع، وسبب التسوية حقول مطلوبة!' : isTr ? 'Ürün, depo ve düzeltme nedeni zorunludur!' : 'Product, Warehouse, and Adjustment Reason are required!',
    errQty: isAr ? 'يجب أن تكون الكمية أكبر من الصفر' : isTr ? 'Miktar sıfırdan büyük olmalıdır' : 'Quantity must be greater than zero',
    successMsg: isAr ? 'تم ترحيل تسوية المخزون وإنشاء قيد اليومية بنجاح!' : isTr ? 'Stok düzeltmesi ve yevmiye kaydı başarıyla oluşturuldu!' : 'Inventory adjustment posted & GL entry created!',
  }

  useEffect(() => {
    fetch(`/api/inventory/options?businessId=${businessId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.products) setProducts(data.products)
        if (data.warehouses) setWarehouses(data.warehouses)
      })
      .catch(() => {})
  }, [businessId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!productId || !warehouseId || !reason.trim()) {
      toast.error(t.errRequired)
      return
    }

    if (quantity <= 0) {
      toast.error(t.errQty)
      return
    }

    setLoading(true)

    try {
      const res = await adjustStockAction(businessId, {
        productId,
        warehouseId,
        adjustmentType,
        quantity: Number(quantity),
        reason,
      })

      if (res.success) {
        toast.success(t.successMsg)
        router.push(`/b/${businessId}/inventory`)
      } else {
        toast.error(res.error || 'Inventory adjustment failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href={`/b/${businessId}/inventory`}
            className="btn btn-secondary"
            style={{ width: 40, height: 40, padding: 0, borderRadius: '10px' }}
            title={t.back}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="page-subtitle">{t.subtitle}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/b/${businessId}/inventory`} className="btn btn-secondary">
            {t.cancel}
          </Link>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 160 }}>
            <CheckCircle size={16} />
            {loading ? t.posting : t.postBtn}
          </button>
        </div>
      </div>

      {/* Main Form Layout */}
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="card-header" style={{ padding: '1.25rem 1.75rem' }}>
            <div>
              <span className="card-title" style={{ fontSize: '1.0625rem' }}>{t.cardTitle}</span>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                {t.cardSubtitle}
              </p>
            </div>
            <span className={`badge ${adjustmentType === 'adjustment_increase' ? 'badge-success' : 'badge-danger'}`}>
              {adjustmentType === 'adjustment_increase' ? t.stockInBadge : t.stockOutBadge}
            </span>
          </div>

          <div className="card-body" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Product Field */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">{t.prodLabel}</label>
              <select
                className="form-control"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
                style={{ fontSize: '0.9375rem', padding: '0.6875rem 0.875rem' }}
              >
                <option value="">{t.selectProd}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse & Type Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">{t.whLabel}</label>
                <select
                  className="form-control"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="">{t.selectWh}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">{t.actionLabel}</label>
                <select
                  className="form-control"
                  value={adjustmentType}
                  onChange={(e: any) => setAdjustmentType(e.target.value)}
                  required
                >
                  <option value="adjustment_increase">{t.increaseOpt}</option>
                  <option value="adjustment_decrease">{t.decreaseOpt}</option>
                </select>
              </div>
            </div>

            {/* Quantity */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">{t.qtyLabel}</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                placeholder={t.qtyPlaceholder}
              />
            </div>

            {/* Reason */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">{t.reasonLabel}</label>
              <textarea
                className="form-control"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.reasonPlaceholder}
                required
              />
              <span className="form-hint">{t.hint}</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

