'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { transferStockAction } from '@/actions/inventory/inventory-actions'

export default function StockTransferPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const [loading, setLoading] = useState(false)

  const [productId, setProductId] = useState('')
  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [notes, setNotes] = useState('')

  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([])

  const t = {
    back: isAr ? 'العودة للمخزون' : isTr ? 'Stoka Dön' : 'Back to Inventory',
    title: isAr ? 'التحويل المخزني بين المستودعات' : isTr ? 'Depolar Arası Stok Transferi' : 'Inter-Warehouse Stock Transfer',
    subtitle: isAr
      ? 'نقل كميات البضائع بين المستودعات والفروع مع توثيق الحركات وحساب التكلفة تلقائياً'
      : isTr
      ? 'Depolar arasında fiziksel stok transferi yapın ve hareket kayıtlarını tutun'
      : 'Transfer physical inventory between fulfillment centers with movement logging',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    executeBtn: isAr ? 'تنفيذ التحويل' : isTr ? 'Transferi Gerçekleştir' : 'Execute Transfer',
    transferring: isAr ? 'جاري التحويل...' : isTr ? 'Aktarılıyor...' : 'Transferring...',
    cardTitle: isAr ? 'بيانات ومعايير التحويل' : isTr ? 'Transfer Parametreleri' : 'Transfer Parameters',
    cardSubtitle: isAr
      ? 'اختر الصنف والمستودع المصدر والمستودع المستلم'
      : isTr
      ? 'Ürün, kaynak depo ve hedef depoyu seçin'
      : 'Select item and source/destination fulfillment facilities',
    badge: isAr ? 'تحويل مستودعات' : isTr ? 'Depo Transferi' : 'Inter-Warehouse',
    prodLabel: isAr ? 'الصنف / المنتج *' : isTr ? 'Ürün / Stok Kalemi *' : 'Product / Stock Item *',
    selectProd: isAr ? '-- اختر الصنف --' : isTr ? '-- Ürün Seçin --' : '-- Select Product --',
    sourceLabel: isAr ? 'المستودع المصدر (من) *' : isTr ? 'Kaynak Depo (Çıkış) *' : 'Source Warehouse (From) *',
    selectSource: isAr ? '-- اختر المستودع المصدر --' : isTr ? '-- Kaynak Depo Seçin --' : '-- Select Source --',
    destLabel: isAr ? 'المستودع المستلم (إلى) *' : isTr ? 'Hedef Depo (Giriş) *' : 'Destination Warehouse (To) *',
    selectDest: isAr ? '-- اختر المستودع المستلم --' : isTr ? '-- Hedef Depo Seçin --' : '-- Select Destination --',
    qtyLabel: isAr ? 'الكمية المحولة (بالوحدات) *' : isTr ? 'Transfer Miktarı (Adet) *' : 'Transfer Quantity (Units) *',
    qtyPlaceholder: isAr ? 'أدخل الكمية المراد نقلها...' : isTr ? 'Taşınacak adet miktarını girin...' : 'Enter units to move...',
    notesLabel: isAr ? 'ملاحظات التحويل ورقم المرجع' : isTr ? 'Transfer Açıklaması ve Referans' : 'Transfer Notes & Reference',
    notesPlaceholder: isAr
      ? 'مثال: إعادة توزيع المخزون لتغطية الطلب في الفرع الغربي'
      : isTr
      ? 'Örn: Şube talebi karşılamak için stok dengelemesi'
      : 'e.g. Regional rebalancing for peak Q4 demand / replenishment',
    errRequired: isAr ? 'الصنف، المستودع المصدر، والمستودع المستلم حقول إلزامية!' : isTr ? 'Ürün, kaynak depo ve hedef depo zorunludur!' : 'Product, Source Warehouse, and Destination Warehouse are required!',
    errIdentical: isAr ? 'لا يمكن أن يكون المستودع المصدر والمستلم نفس المستودع!' : isTr ? 'Kaynak ve hedef depo aynı olamaz!' : 'Source and Destination warehouses cannot be identical!',
    errQty: isAr ? 'يجب أن تكون الكمية أكبر من الصفر' : isTr ? 'Miktar sıfırdan büyük olmalıdır' : 'Quantity must be greater than zero',
    successMsg: isAr ? 'تم تنفيذ التحويل المخزني بنجاح!' : isTr ? 'Stok transferi başarıyla gerçekleştirildi!' : 'Stock transfer executed successfully!',
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

    if (!productId || !fromWarehouseId || !toWarehouseId) {
      toast.error(t.errRequired)
      return
    }

    if (fromWarehouseId === toWarehouseId) {
      toast.error(t.errIdentical)
      return
    }

    if (quantity <= 0) {
      toast.error(t.errQty)
      return
    }

    setLoading(true)

    try {
      const res = await transferStockAction(businessId, {
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity: Number(quantity),
        notes: notes || undefined,
      })

      if (res.success) {
        toast.success(t.successMsg)
        router.push(`/b/${businessId}/inventory`)
      } else {
        toast.error(res.error || 'Stock transfer failed')
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
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 170 }}>
            <CheckCircle size={16} />
            {loading ? t.transferring : t.executeBtn}
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
            <span className="badge badge-primary">
              <ArrowRightLeft size={13} /> {t.badge}
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

            {/* Source and Destination Warehouses */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">{t.sourceLabel}</label>
                <select
                  className="form-control"
                  value={fromWarehouseId}
                  onChange={(e) => setFromWarehouseId(e.target.value)}
                  required
                >
                  <option value="">{t.selectSource}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">{t.destLabel}</label>
                <select
                  className="form-control"
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  required
                >
                  <option value="">{t.selectDest}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
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

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t.notesLabel}</label>
              <textarea
                className="form-control"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

