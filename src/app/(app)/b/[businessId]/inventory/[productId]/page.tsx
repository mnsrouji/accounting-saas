import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
  ArrowLeft,
  Package,
  History,
  AlertTriangle,
  Layers,
  DollarSign,
  Boxes,
  TrendingUp,
  Warehouse as WarehouseIcon,
  Tag,
  Barcode,
  Calendar,
  ArrowRightLeft,
  SlidersHorizontal,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/decimal'

const MOVEMENT_TYPE_LABELS: Record<string, { labelEn: string; labelAr: string; labelTr: string; color: string; bg: string }> = {
  opening_balance: { labelEn: 'Opening Balance', labelAr: 'بضاعة أول المدة', labelTr: 'Açılış Bakiyesi', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  purchase: { labelEn: 'Purchase Receipt', labelAr: 'وارد مشتريات', labelTr: 'Alış Girişi', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  sale: { labelEn: 'Sales Issue', labelAr: 'منصرف مبيعات', labelTr: 'Satış Çıkışı', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  transfer_in: { labelEn: 'Transfer In', labelAr: 'تحويل وارد', labelTr: 'Transfer Girişi', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  transfer_out: { labelEn: 'Transfer Out', labelAr: 'تحويل صادر', labelTr: 'Transfer Çıkışı', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  adjustment_in: { labelEn: 'Adjustment (+)', labelAr: 'تسوية جرد زيادة', labelTr: 'Sayım Fazlası (+)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  adjustment_out: { labelEn: 'Adjustment (-)', labelAr: 'تسوية جرد عجز', labelTr: 'Sayım Eksiği (-)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  return_in: { labelEn: 'Sales Return', labelAr: 'مرتجع مبيعات', labelTr: 'Satış İadesi', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  return_out: { labelEn: 'Purchase Return', labelAr: 'مرتجع مشتريات', labelTr: 'Alış İadesi', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; productId: string }>
}) {
  const { businessId, productId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const { business } = await requireBusinessAccess(businessId)

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(productId)) {
    notFound()
  }

  const [product, inventoryBalances, inventoryMovements] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, businessId },
    }),
    prisma.inventoryBalance.findMany({
      where: { productId, businessId },
      include: { warehouse: true },
      orderBy: { warehouse: { name: 'asc' } },
    }),
    prisma.inventoryMovement.findMany({
      where: { productId, businessId },
      include: { warehouse: true },
      orderBy: { movementDate: 'desc' },
      take: 50,
    }),
  ])

  if (!product) notFound()

  const defaultCurrency = business.defaultCurrency
  const totalQuantity = inventoryBalances.reduce((acc, l) => acc + Number(l.quantity), 0)
  const costPrice = Number(product.costPrice)
  const salePrice = Number(product.salePrice)
  const totalValuation = totalQuantity * costPrice

  const minStockLevel = product.minStock ? Number(product.minStock) : product.reorderLevel ? Number(product.reorderLevel) : 5
  const isLowStock = product.trackInventory && totalQuantity <= minStockLevel

  const t = {
    back: isAr ? 'العودة للمخزون' : isTr ? 'Stoka Dön' : 'Back to Inventory',
    lowStockAlert: isAr ? 'تنبيه: رصيد منخفض' : isTr ? 'Uyarı: Düşük Stok' : 'Low Stock Warning',
    skuLabel: isAr ? 'كود الصنف (SKU):' : isTr ? 'Stok Kodu (SKU):' : 'SKU:',
    barcodeLabel: isAr ? 'الباركود:' : isTr ? 'Barkod:' : 'Barcode:',
    typeLabel: isAr ? 'نوع الصنف:' : isTr ? 'Ürün Türü:' : 'Product Type:',
    transferBtn: isAr ? 'تحويل مخزني' : isTr ? 'Stok Transferi' : 'Transfer Stock',
    adjustBtn: isAr ? 'تسوية جرد' : isTr ? 'Sayım Düzeltmesi' : 'Adjust Stock',
    availableStockCard: isAr ? 'إجمالي الرصيد المتوفر' : isTr ? 'Toplam Mevcut Stok' : 'Total Available Stock',
    units: isAr ? 'وحدة' : isTr ? 'adet' : 'units',
    nonTracked: isAr ? 'غير متتبع (خدمة)' : isTr ? 'Takipsiz (Hizmet)' : 'Non-tracked (Service)',
    distributedAcross: (count: number) =>
      isAr ? `موزعة على ${count} مستودع / فرع` : isTr ? `${count} depoya dağıtılmış` : `Distributed across ${count} warehouses`,
    wacCard: isAr ? 'متوسط التكلفة المرجحة (WAC)' : isTr ? 'Ağırlıklı Ortalama Maliyet (WAC)' : 'Weighted Avg Cost (WAC)',
    wacSubtext: isAr ? 'تكلفة الوحدة المحسوبة دفترياً' : isTr ? 'Kayıtlı birim maliyet' : 'Book calculated unit cost',
    salePriceCard: isAr ? 'سعر البيع الافتراضي' : isTr ? 'Varsayılan Satış Fiyatı' : 'Default Sale Price',
    marginLabel: (m: string) =>
      isAr ? `هامش الربح التقديري: ${m}` : isTr ? `Tahmini Kâr Marjı: ${m}` : `Estimated Margin: ${m}`,
    totalValCard: isAr ? 'إجمالي قيمة المخزون' : isTr ? 'Toplam Stok Değeri' : 'Total Inventory Valuation',
    totalValSubtext: isAr ? 'التقييم المالي الإجمالي للصنف' : isTr ? 'Bu kalem için toplam değer' : 'Financial valuation of on-hand inventory',
    whBreakdownTitle: isAr ? 'توزيع المخزون حسب المستودعات' : isTr ? 'Depo Bazında Stok Dağılımı' : 'Warehouse Stock Distribution',
    manageWhLink: isAr ? 'إدارة المستودعات ←' : isTr ? 'Depoları Yönet ←' : 'Manage Warehouses →',
    noBalances: isAr ? 'لا توجد أرصدة مسجلة في أي مستودع لهذا الصنف.' : isTr ? 'Bu ürün için herhangi bir depoda stok kaydı bulunmuyor.' : 'No stock recorded in any warehouse for this product.',
    whCode: isAr ? 'الكود:' : isTr ? 'Kod:' : 'Code:',
    valueLabel: isAr ? 'القيمة:' : isTr ? 'Değer:' : 'Value:',
    movementHistoryTitle: (count: number) =>
      isAr ? `سجل الحركات المخزنية للصنف (${count} حركة)` : isTr ? `Stok Hareket Geçmişi (${count} hareket)` : `Inventory Movement Log (${count} movements)`,
    colDate: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    colType: isAr ? 'نوع الحركة' : isTr ? 'Hareket Türü' : 'Movement Type',
    colWarehouse: isAr ? 'المستودع' : isTr ? 'Depo' : 'Warehouse',
    colQty: isAr ? 'الكمية' : isTr ? 'Miktar' : 'Quantity',
    colUnitCost: isAr ? 'سعر التكلفة' : isTr ? 'Birim Maliyet' : 'Unit Cost',
    colTotalVal: isAr ? 'إجمالي القيمة' : isTr ? 'Toplam Değer' : 'Total Value',
    noMovements: isAr ? 'لا توجد حركات مخزنية مسجلة لهذا الصنف حتى الآن.' : isTr ? 'Bu ürün için henüz kayıtlı stok hareketi bulunmuyor.' : 'No inventory movements recorded for this item yet.',
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Header & Breadcrumb */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href={`/b/${businessId}/inventory`}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            title={t.back}
          >
            <ArrowLeft size={15} />
            <span>{t.back}</span>
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.35rem' }}>
                {product.name}
              </h1>
              {isLowStock && (
                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={11} /> {t.lowStockAlert}
                </span>
              )}
            </div>
            <p className="page-subtitle" style={{ margin: '0.15rem 0 0', fontSize: '0.8rem' }}>
              {t.skuLabel} <strong style={{ fontFamily: 'monospace', color: 'var(--primary-color)' }}>{product.code || '—'}</strong>
              {product.barcode && <> • {t.barcodeLabel} <span style={{ fontFamily: 'monospace' }}>{product.barcode}</span></>}
              {' • '}{t.typeLabel} <span style={{ textTransform: 'capitalize' }}>{product.productType}</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href={`/b/${businessId}/inventory/transfer`} className="btn btn-secondary">
            <ArrowRightLeft size={15} />
            {t.transferBtn}
          </Link>
          <Link href={`/b/${businessId}/inventory/adjustment`} className="btn btn-secondary">
            <SlidersHorizontal size={15} />
            {t.adjustBtn}
          </Link>
        </div>
      </div>

      {/* Main KPI Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Total Stock */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.availableStockCard}</span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Boxes size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalQuantity > 0 ? '#10b981' : '#ef4444' }}>
            {product.trackInventory ? `${totalQuantity.toLocaleString()} ${t.units}` : t.nonTracked}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.distributedAcross(inventoryBalances.length)}
          </div>
        </div>

        {/* Cost Price WAC */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.wacCard}</span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-color)',
              }}
            >
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)', fontFamily: 'Outfit, sans-serif' }}>
            {formatCurrency(costPrice, defaultCurrency)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.wacSubtext}
          </div>
        </div>

        {/* Sale Price */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.salePriceCard}</span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
              }}
            >
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6', fontFamily: 'Outfit, sans-serif' }}>
            {formatCurrency(salePrice, defaultCurrency)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.marginLabel(costPrice > 0 ? `${(((salePrice - costPrice) / costPrice) * 100).toFixed(1)}%` : '—')}
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.totalValCard}</span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>
            {formatCurrency(totalValuation, defaultCurrency)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.totalValSubtext}
          </div>
        </div>
      </div>

      {/* Grid: Warehouse Allocations & Movement History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Warehouse Stock Breakdown Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                {t.whBreakdownTitle}
              </h3>
            </div>
            <Link
              href={`/b/${businessId}/inventory/warehouses`}
              style={{ fontSize: '0.75rem', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}
            >
              {t.manageWhLink}
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {inventoryBalances.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t.noBalances}
              </div>
            ) : (
              inventoryBalances.map((lvl) => {
                const qty = Number(lvl.quantity)
                const val = qty * costPrice
                return (
                  <div
                    key={lvl.id}
                    style={{
                      padding: '0.875rem 1rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {lvl.warehouse.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {t.whCode} <span style={{ fontFamily: 'monospace' }}>{lvl.warehouse.code}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: qty > 0 ? '#10b981' : '#ef4444' }}>
                        {qty.toLocaleString()} {t.units}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {t.valueLabel} {formatCurrency(val, defaultCurrency)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Movement History Log Table */}
        <div className="card" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                {t.movementHistoryTitle(inventoryMovements.length)}
              </h3>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, fontSize: '0.8125rem', textAlign: isAr ? 'right' : 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th>{t.colDate}</th>
                  <th>{t.colType}</th>
                  <th>{t.colWarehouse}</th>
                  <th style={{ textAlign: 'right' }}>{t.colQty}</th>
                  <th style={{ textAlign: 'right' }}>{t.colUnitCost}</th>
                  <th style={{ textAlign: 'right' }}>{t.colTotalVal}</th>
                </tr>
              </thead>
              <tbody>
                {inventoryMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      {t.noMovements}
                    </td>
                  </tr>
                ) : (
                  inventoryMovements.map((m) => {
                    const typeConfig = MOVEMENT_TYPE_LABELS[m.movementType] || {
                      labelEn: m.movementType,
                      labelAr: m.movementType,
                      labelTr: m.movementType,
                      color: 'var(--text-secondary)',
                      bg: 'rgba(100, 116, 139, 0.1)',
                    }
                    const label = isAr ? typeConfig.labelAr : isTr ? typeConfig.labelTr : typeConfig.labelEn
                    const qty = Number(m.quantity)
                    const unitCost = Number(m.unitCost)
                    const totalCost = Number(m.totalCost || qty * unitCost)

                    return (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {formatDate(m.movementDate)}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 600,
                              color: typeConfig.color,
                              backgroundColor: typeConfig.bg,
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {label}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {m.warehouse?.name || '—'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: qty > 0 ? '#10b981' : '#ef4444',
                            direction: 'ltr',
                          }}
                        >
                          {qty > 0 ? `+${qty.toLocaleString()}` : qty.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatCurrency(unitCost, defaultCurrency)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {formatCurrency(totalCost, defaultCurrency)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

