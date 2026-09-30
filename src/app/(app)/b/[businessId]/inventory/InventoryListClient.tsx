'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Warehouse, Package, ArrowRightLeft, SlidersHorizontal, Plus, Eye, FileSpreadsheet } from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { OpeningInventoryModal } from '@/components/inventory/OpeningInventoryModal'
import { SearchableAccountItem } from '@/components/accounting/AccountSearchSelect'
import { createProductAction } from '@/actions/inventory/inventory-actions'
import { toast } from 'sonner'

export interface ProductRow {
  id: string
  sku: string
  name: string
  productType: string
  unitOfMeasure?: string
  salePrice: number
  costPrice: number
  totalQuantity: number
  totalValue: number
  trackInventory: boolean
  currencyCode: string
}

export interface WarehouseRow {
  id: string
  code: string
  name: string
  totalValue: number
  lineItemCount: number
}

interface InventoryListClientProps {
  businessId: string
  defaultCurrency: string
  products: ProductRow[]
  warehouses: WarehouseRow[]
  glAccounts: SearchableAccountItem[]
}

export function InventoryListClient({
  businessId,
  defaultCurrency,
  products,
  warehouses,
  glAccounts,
}: InventoryListClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOpeningStockModalOpen, setIsOpeningStockModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [type, setType] = useState('goods')
  const [unitOfMeasure, setUnitOfMeasure] = useState(isAr ? 'قطعة' : isTr ? 'Adet' : 'Piece')
  const [salePrice, setSalePrice] = useState('0')
  const [costPrice, setCostPrice] = useState('0')
  const [trackInventory, setTrackInventory] = useState(true)

  const t = {
    title: isAr ? 'إدارة المخزون والمستودعات' : isTr ? 'Stok ve Depo Yönetimi' : 'Inventory & Stock Control',
    subtitle: isAr
      ? 'دليل المنتجات، التكلفة المرجحة (WAC)، وأرصدة المستودعات'
      : isTr
      ? 'Ürün kataloğu, Ağırlıklı Ortalama Maliyet (WAC) ve depo bakiyeleri'
      : 'Product catalog, Weighted Average Costing (WAC) & warehouse balances',
    importOpening: isAr ? 'استيراد بضاعة أول المدة' : isTr ? 'Açılış Stoklarını İçe Aktar' : 'Import Opening Stock',
    newProduct: isAr ? 'إضافة منتج جديد' : isTr ? 'Yeni Ürün Ekle' : 'New Product',
    manageWarehouses: isAr ? 'إدارة المستودعات' : isTr ? 'Depoları Yönet' : 'Manage Warehouses',
    stockTransfer: isAr ? 'التحويلات المخزنية' : isTr ? 'Stok Transferi' : 'Stock Transfer',
    adjustStock: isAr ? 'تسويات الجرد' : isTr ? 'Stok Düzeltmesi' : 'Adjust Stock',
    activeWarehousesTitle: (count: number) =>
      isAr ? `المستودعات والفروع النشطة (${count})` : isTr ? `Aktif Depolar ve Şubeler (${count})` : `Active Warehouses (${count})`,
    viewAllWarehouses: isAr ? 'عرض وإدارة كافة المستودعات ←' : isTr ? 'Tüm Depoları Görüntüle ve Yönet →' : 'View & Manage All Warehouses →',
    sku: isAr ? 'رمز الصنف (SKU)' : isTr ? 'Stok Kodu (SKU)' : 'SKU',
    productName: isAr ? 'اسم المنتج' : isTr ? 'Ürün Adı' : 'Product Name',
    typeLabel: isAr ? 'النوع' : isTr ? 'Tür' : 'Type',
    unitLabel: isAr ? 'الوحدة' : isTr ? 'Birim' : 'Unit',
    stockOnHand: isAr ? 'الرصيد المتاح' : isTr ? 'Mevcut Stok' : 'Stock On Hand',
    unitCost: isAr ? 'تكلفة الوحدة (WAC)' : isTr ? 'Birim Maliyet (WAC)' : 'Unit Cost (WAC)',
    salePriceLabel: isAr ? 'سعر البيع' : isTr ? 'Satış Fiyatı' : 'Sale Price',
    totalStockValue: isAr ? 'إجمالي القيمة المخزنية' : isTr ? 'Toplam Stok Değeri' : 'Total Stock Value',
    actions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    details: isAr ? 'تفاصيل' : isTr ? 'Detaylar' : 'Details',
    searchPlaceholder: isAr ? 'بحث برمز الصنف أو الاسم...' : isTr ? 'Stok kodu veya ürün adı ara...' : 'Search products by SKU or name...',
    emptyTitle: isAr ? 'لا توجد أصناف مسجلة' : isTr ? 'Kayıtlı Ürün Bulunamadı' : 'No Products Registered',
    emptySubtext: isAr
      ? 'أضف أول منتج أو صنف للبدء في إدارة المخزون وحركات البيع والشراء.'
      : isTr
      ? 'Stok ve satış yönetimini başlatmak için ilk ürününüzü ekleyin.'
      : 'Add your first product or item to start managing inventory and sales.',
    createModalTitle: isAr ? 'إضافة منتج جديد' : isTr ? 'Yeni Ürün Oluştur' : 'Create New Product',
    prodNameLabel: isAr ? 'اسم المنتج / الصنف' : isTr ? 'Ürün / Kalem Adı' : 'Product Name',
    prodSkuLabel: isAr ? 'رمز الصنف / الباركود' : isTr ? 'Stok Kodu (SKU) / Barkod' : 'SKU / Item Code',
    prodTypeLabel: isAr ? 'نوع المنتج' : isTr ? 'Ürün Türü' : 'Product Type',
    physicalType: isAr ? 'بضاعة مادية (تتبع المخزون)' : isTr ? 'Fiziksel Ürün (Stok Takibi Yapılır)' : 'Physical Goods (Tracked)',
    serviceType: isAr ? 'خدمة (بدون تتبع مخزون)' : isTr ? 'Hizmet (Stok Takibi Yok)' : 'Service (Non-tracked)',
    unitMeasureLabel: isAr ? 'وحدة القياس' : isTr ? 'Ölçü Birimi' : 'Unit of Measure',
    sellingPriceLabel: isAr ? `سعر البيع (${defaultCurrency})` : isTr ? `Satış Fiyatı (${defaultCurrency})` : `Selling Price (${defaultCurrency})`,
    costPriceLabel: isAr ? `سعر التكلفة (${defaultCurrency})` : isTr ? `Maliyet Fiyatı (${defaultCurrency})` : `Initial Cost Price (${defaultCurrency})`,
    trackInventoryLabel: isAr
      ? 'تتبع رصيد وحركات المخزون وتكلفة هذا الصنف'
      : isTr
      ? 'Bu kalem için stok bakiyesi ve hareketlerini takip et'
      : 'Track inventory balance and movements for this item',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    createBtn: isAr ? 'حفظ الصنف' : isTr ? 'Ürünü Kaydet' : 'Create Product',
    creating: isAr ? 'جارٍ الحفظ...' : isTr ? 'Kaydediliyor...' : 'Creating...',
    activeStockLines: isAr ? 'أصناف مخزنة' : isTr ? 'kayıtlı stok kalemi' : 'active stock lines',
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(isAr ? 'اسم المنتج مطلوب' : isTr ? 'Ürün adı zorunludur' : 'Product name is required')
      return
    }

    setLoading(true)
    try {
      const res = await createProductAction(businessId, {
        name,
        sku: sku || name.slice(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-4),
        type,
        price: parseFloat(salePrice) || 0,
        cost: parseFloat(costPrice) || 0,
        trackInventory,
      })

      if (res.success) {
        toast.success(isAr ? `تم إنشاء المنتج "${name}" بنجاح!` : isTr ? `"${name}" ürünü başarıyla oluşturuldu!` : `Product "${name}" created successfully!`)
        setIsModalOpen(false)
        setName('')
        setSku('')
        setUnitOfMeasure(isAr ? 'قطعة' : isTr ? 'Adet' : 'Piece')
        setSalePrice('0')
        setCostPrice('0')
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل في إنشاء المنتج' : isTr ? 'Ürün oluşturulamadı' : 'Failed to create product'))
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'sku',
      header: t.sku,
      sortable: true,
      sortValue: (r) => r.sku,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/inventory/${r.id}`}
          style={{ fontWeight: 600, color: 'var(--color-brand-500)', textDecoration: 'none' }}
        >
          {r.sku}
        </Link>
      ),
    },
    {
      key: 'name',
      header: t.productName,
      sortable: true,
      sortValue: (r) => r.name,
      accessor: (r) => (
        <div>
          <Link
            href={`/b/${businessId}/inventory/${r.id}`}
            style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
          >
            {r.name}
          </Link>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', marginTop: '0.15rem' }}>
            <span style={{ textTransform: 'capitalize' }}>{t.typeLabel}: {r.productType}</span>
            {r.unitOfMeasure && <span>• {t.unitLabel}: {r.unitOfMeasure}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'totalQuantity',
      header: t.stockOnHand,
      sortable: true,
      sortValue: (r) => r.totalQuantity,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: r.totalQuantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {r.trackInventory ? `${r.totalQuantity.toLocaleString()} ${r.unitOfMeasure || (isAr ? 'وحدة' : isTr ? 'Birim' : 'Unit')}` : (isAr ? 'خدمة' : isTr ? 'Hizmet' : 'Service')}
        </span>
      ),
    },
    {
      key: 'costPrice',
      header: t.unitCost,
      sortable: true,
      sortValue: (r) => r.costPrice,
      accessor: (r) => formatCurrency(r.costPrice, r.currencyCode),
    },
    {
      key: 'salePrice',
      header: t.salePriceLabel,
      sortable: true,
      sortValue: (r) => r.salePrice,
      accessor: (r) => formatCurrency(r.salePrice, r.currencyCode),
    },
    {
      key: 'totalValue',
      header: t.totalStockValue,
      sortable: true,
      sortValue: (r) => r.totalValue,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--color-brand-500)' }}>
          {formatCurrency(r.totalValue, r.currencyCode)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t.actions,
      hideable: false,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/inventory/${r.id}`}
          className="btn btn-secondary btn-sm"
          style={{ height: 30, padding: '0 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <Eye size={13} />
          {t.details}
        </Link>
      ),
    },
  ]

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderColor: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
            }}
            onClick={() => setIsOpeningStockModalOpen(true)}
            id="opening-stock-import-btn"
          >
            <FileSpreadsheet size={16} />
            {t.importOpening}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsModalOpen(true)}
            id="new-product-btn"
          >
            <Plus size={16} />
            {t.newProduct}
          </button>
          <Link
            href={`/b/${businessId}/inventory/warehouses`}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Warehouse size={16} />
            {t.manageWarehouses}
          </Link>
          <Link href={`/b/${businessId}/inventory/transfer`} className="btn btn-secondary">
            <ArrowRightLeft size={16} />
            {t.stockTransfer}
          </Link>
          <Link href={`/b/${businessId}/inventory/adjustment`} className="btn btn-secondary">
            <SlidersHorizontal size={16} />
            {t.adjustStock}
          </Link>
        </div>
      </div>

      {/* Warehouse Overview Cards */}
      {warehouses.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {t.activeWarehousesTitle(warehouses.length)}
            </span>
            <Link
              href={`/b/${businessId}/inventory/warehouses`}
              style={{ fontSize: '0.8rem', color: 'var(--color-brand-500)', textDecoration: 'none', fontWeight: 600 }}
            >
              {t.viewAllWarehouses}
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {warehouses.map((wh) => (
              <Link
                key={wh.id}
                href={`/b/${businessId}/inventory/warehouses`}
                className="card"
                style={{ padding: '1.25rem', textDecoration: 'none', display: 'block', transition: 'all 0.15s ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{wh.name}</span>
                  <span className="badge badge-primary">{wh.code}</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-brand-500)', fontFamily: 'Outfit, sans-serif' }}>
                  {formatCurrency(wh.totalValue, defaultCurrency)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {wh.lineItemCount} {t.activeStockLines}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Products Table */}
      <DataTable
        data={products}
        columns={columns}
        searchKey={(r) => `${r.sku} ${r.name}`}
        searchPlaceholder={t.searchPlaceholder}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            {t.newProduct}
          </button>
        }
      />

      {/* Add Product Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t.createModalTitle}>
        <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label required">{t.prodNameLabel}</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Industrial Steel Widget"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">{t.prodSkuLabel}</label>
              <input
                type="text"
                className="form-control"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. WIDGET-001"
              />
            </div>
            <div>
              <label className="form-label">{t.prodTypeLabel}</label>
              <select
                className="form-control"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="goods">{t.physicalType}</option>
                <option value="service">{t.serviceType}</option>
              </select>
            </div>
            <div>
              <label className="form-label">{t.unitMeasureLabel}</label>
              <input
                type="text"
                className="form-control"
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
                placeholder={isAr ? 'مثال: قطعة، غرام، علبة' : isTr ? 'Örn: Adet, Gram, Koli' : 'e.g. Piece, Box, Kg'}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">{t.sellingPriceLabel}</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">{t.costPriceLabel}</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              id="trackInventoryCheck"
              checked={trackInventory}
              onChange={(e) => setTrackInventory(e.target.checked)}
            />
            <label htmlFor="trackInventoryCheck" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              {t.trackInventoryLabel}
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.creating : t.createBtn}
            </button>
          </div>
        </form>
      </Modal>

      {/* Opening Inventory Import Modal */}
      <OpeningInventoryModal
        businessId={businessId}
        defaultCurrency={defaultCurrency}
        glAccounts={glAccounts}
        isOpen={isOpeningStockModalOpen}
        onClose={() => setIsOpeningStockModalOpen(false)}
        onImportSuccess={() => {
          router.refresh()
        }}
      />
    </div>
  )
}
