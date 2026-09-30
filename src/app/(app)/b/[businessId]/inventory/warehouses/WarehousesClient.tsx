'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Package,
  ArrowRightLeft,
  SlidersHorizontal,
  MapPin,
  Building,
  Layers,
  Star,
  Eye,
  ShieldAlert,
  ArrowLeft,
  DollarSign,
  Boxes,
} from 'lucide-react'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import {
  createWarehouseAction,
  updateWarehouseAction,
  deleteWarehouseAction,
  toggleWarehouseStatusAction,
} from '@/actions/inventory/warehouse-actions'

export interface WarehouseItemDetail {
  productId: string
  productName: string
  productSku: string
  quantity: number
  averageCost: number
  totalValue: number
}

export interface WarehouseDetailRow {
  id: string
  code: string
  name: string
  location: string
  address: string
  isDefault: boolean
  isActive: boolean
  totalQuantity: number
  totalValuation: number
  uniqueItemCount: number
  movementCount: number
  locationCount: number
  createdAt: string
  items: WarehouseItemDetail[]
}

interface WarehousesClientProps {
  businessId: string
  defaultCurrency: string
  warehouses: WarehouseDetailRow[]
}

export function WarehousesClient({
  businessId,
  defaultCurrency,
  warehouses: initialWarehouses,
}: WarehousesClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const [warehouses, setWarehouses] = useState<WarehouseDetailRow[]>(initialWarehouses)

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseDetailRow | null>(null)
  const [inspectingWarehouse, setInspectingWarehouse] = useState<WarehouseDetailRow | null>(null)
  const [deletingWarehouse, setDeletingWarehouse] = useState<WarehouseDetailRow | null>(null)
  const [inspectSearch, setInspectSearch] = useState('')

  // Form State
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [formIsActive, setFormIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const t = {
    title: isAr
      ? 'إدارة المستودعات والفروع'
      : isTr
      ? 'Depo ve Şube Yönetimi'
      : 'Warehouse & Branch Management',
    subtitle: isAr
      ? 'تعريف المستودعات، متابعة أرصدة الأصناف، تعيين المستودعات الافتراضية والتحكم في حالتها'
      : isTr
      ? 'Depoları tanımlayın, stok bakiyelerini izleyin, varsayılan depoları belirleyin'
      : 'Define fulfillment centers, monitor stock valuation, and manage warehouse statuses',
    back: isAr ? 'العودة للمخزون' : isTr ? 'Stoka Dön' : 'Back to Inventory',
    newWarehouse: isAr ? 'مستودع جديد' : isTr ? 'Yeni Depo' : 'New Warehouse',
    stockTransfers: isAr ? 'التحويلات المخزنية' : isTr ? 'Stok Transferleri' : 'Stock Transfers',
    stockAdjustments: isAr ? 'تسويات الجرد' : isTr ? 'Sayım Düzeltmeleri' : 'Stock Adjustments',
    productsList: isAr ? 'المنتجات والأصناف' : isTr ? 'Ürünler ve Kalemler' : 'Products & Catalog',
    totalWhCard: isAr ? 'إجمالي المستودعات' : isTr ? 'Toplam Depo' : 'Total Warehouses',
    whUnit: isAr ? 'مستودع' : isTr ? 'depo' : 'warehouses',
    activeCount: (n: number) =>
      isAr ? `${n} مستودع نشط حالياً` : isTr ? `${n} aktif depo` : `${n} currently active`,
    totalValuationCard: isAr ? 'إجمالي قيمة المخزون الكلي' : isTr ? 'Toplam Stok Değeri' : 'Total Inventory Valuation',
    wacLabel: isAr ? 'تقييم التكلفة المرجحة (WAC)' : isTr ? 'Ağırlıklı Ortalama Maliyet (WAC)' : 'Weighted Average Cost (WAC)',
    totalUnitsCard: isAr ? 'إجمالي الكميات والقطع' : isTr ? 'Toplam Miktar ve Adet' : 'Total Units on Hand',
    unitsLabel: isAr ? 'وحدة' : isTr ? 'adet' : 'units',
    distributedLabel: isAr ? 'موزعة على كافة الفروع' : isTr ? 'Tüm şubelere dağıtılmış' : 'Distributed across branches',
    tabAll: (n: number) => isAr ? `كافة المستودعات (${n})` : isTr ? `Tüm Depolar (${n})` : `All Warehouses (${n})`,
    tabActive: (n: number) => isAr ? `المستودعات النشطة (${n})` : isTr ? `Aktif Depolar (${n})` : `Active (${n})`,
    tabInactive: (n: number) => isAr ? `المعطلة (${n})` : isTr ? `Pasif Depolar (${n})` : `Inactive (${n})`,
    colCode: isAr ? 'كود المستودع' : isTr ? 'Depo Kodu' : 'Warehouse Code',
    colName: isAr ? 'اسم المستودع' : isTr ? 'Depo Adı' : 'Warehouse Name',
    colItems: isAr ? 'الأصناف المخزنة' : isTr ? 'Stoklu Ürünler' : 'Unique Items',
    colUnits: isAr ? 'إجمالي الوحدات' : isTr ? 'Toplam Adet' : 'Total Units',
    colValuation: isAr ? 'قيمة المخزون (WAC)' : isTr ? 'Stok Değeri (WAC)' : 'Inventory Value (WAC)',
    colMovements: isAr ? 'الحركات' : isTr ? 'Hareketler' : 'Movements',
    colStatus: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    colActions: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
    defaultBadge: isAr ? 'الافتراضي' : isTr ? 'Varsayılan' : 'Default',
    activeBadge: isAr ? 'نشط' : isTr ? 'Aktif' : 'Active',
    inactiveBadge: isAr ? 'معطل' : isTr ? 'Pasif' : 'Inactive',
    viewContents: isAr ? 'المحتويات' : isTr ? 'İçerik' : 'Contents',
    itemSuffix: isAr ? 'صنف' : isTr ? 'ürün' : 'items',
    movementSuffix: isAr ? 'حركة' : isTr ? 'hareket' : 'moves',
    searchPlaceholder: isAr
      ? 'ابحث باسم المستودع أو الكود أو الموقع...'
      : isTr
      ? 'Depo adı, kodu veya konumuna göre ara...'
      : 'Search warehouse by name, code, or location...',
    emptyTitle: isAr ? 'لا توجد مستودعات مطابقة' : isTr ? 'Eşleşen Depo Bulunamadı' : 'No matching warehouses',
    emptySubtext: isAr
      ? 'قم بإنشاء أول مستودع لتنظيم المنتجات وتتبع المخزون والتحويلات بدقة.'
      : isTr
      ? 'Ürünleri organize etmek ve stok hareketlerini izlemek için ilk deponuzu ekleyin.'
      : 'Create your first warehouse location to track inventory balances and movements.',
    addWhBtn: isAr ? 'إضافة مستودع جديد' : isTr ? 'Yeni Depo Ekle' : 'Add New Warehouse',
    modalAddTitle: isAr ? 'إضافة مستودع جديد' : isTr ? 'Yeni Depo Oluştur' : 'Add New Warehouse',
    modalEditTitle: (name: string) =>
      isAr ? `تعديل المستودع: ${name}` : isTr ? `Depoyu Düzenle: ${name}` : `Edit Warehouse: ${name}`,
    formName: isAr ? 'اسم المستودع' : isTr ? 'Depo Adı' : 'Warehouse Name',
    formNamePlaceholder: isAr ? 'مثال: المستودع المركزي، فرع الرياض' : isTr ? 'Örn: Merkez Depo, Kadıköy Şube' : 'e.g. Central Warehouse, North Branch',
    formCode: isAr ? 'كود المستودع (الكود الفريد)' : isTr ? 'Depo Kodu' : 'Warehouse Code',
    formLocation: isAr ? 'المدينة / المنطقة (الموقع)' : isTr ? 'Şehir / Bölge' : 'City / Location',
    formAddress: isAr ? 'العنوان التفصيلي / ملاحظات الموقع' : isTr ? 'Ayrıntılı Adres' : 'Address Details',
    formDefault: isAr ? 'تعيين كمستودع افتراضي رئيسي للنظام' : isTr ? 'Sistem için varsayılan ana depo yap' : 'Set as primary default system warehouse',
    formDefaultHint: isAr
      ? 'يتم اختياره تلقائياً في فواتير المبيعات، فواتير الشراء، وحركات المخزون في حال عدم تحديد مستودع.'
      : isTr
      ? 'Depo seçilmediğinde satış, alış ve stok hareketlerinde otomatik kullanılır.'
      : 'Auto-selected in sales invoices, purchases, and stock movements when unspecified.',
    formActive: isAr ? 'المستودع مفعّل ونشط للعمليات والحركات' : isTr ? 'Depo işlemlere açık ve aktif' : 'Warehouse active and available for operations',
    cancel: isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel',
    saveChanges: isAr ? 'حفظ التعديلات' : isTr ? 'Değişiklikleri Kaydet' : 'Save Changes',
    createWh: isAr ? 'إنشاء المستودع' : isTr ? 'Depo Oluştur' : 'Create Warehouse',
    saving: isAr ? 'جاري الحفظ...' : isTr ? 'Kaydediliyor...' : 'Saving...',
    inspectTitle: (name: string, code: string) =>
      isAr ? `محتويات ومخزون: ${name} (${code})` : isTr ? `Depo Stok İçeriği: ${name} (${code})` : `Inventory Contents: ${name} (${code})`,
    inspectItems: isAr ? 'إجمالي الأصناف' : isTr ? 'Toplam Çeşit' : 'Unique Items',
    inspectQty: isAr ? 'إجمالي الكمية' : isTr ? 'Toplam Adet' : 'Total Quantity',
    inspectValue: isAr ? 'إجمالي قيمة المخزون' : isTr ? 'Toplam Değer' : 'Total Stock Value',
    inspectLoc: isAr ? 'الموقع' : isTr ? 'Konum' : 'Location',
    unspecified: isAr ? 'غير محدد' : isTr ? 'Belirtilmemiş' : 'Unspecified',
    inspectSearchPlaceholder: isAr ? 'ابحث عن صنف داخل هذا المستودع...' : isTr ? 'Bu depo içinde ürün ara...' : 'Search items in this warehouse...',
    skuHeader: isAr ? 'كود الصنف (SKU)' : isTr ? 'Stok Kodu (SKU)' : 'SKU',
    prodHeader: isAr ? 'اسم الصنف' : isTr ? 'Ürün Adı' : 'Product Name',
    qtyHeader: isAr ? 'الكمية المتوفرة' : isTr ? 'Mevcut Miktar' : 'Available Qty',
    wacHeader: isAr ? 'متوسط التكلفة (WAC)' : isTr ? 'Ortalama Maliyet (WAC)' : 'Avg Cost (WAC)',
    valHeader: isAr ? 'إجمالي القيمة' : isTr ? 'Toplam Değer' : 'Total Value',
    actionHeader: isAr ? 'الإجراء' : isTr ? 'İşlem' : 'Action',
    cardBtn: isAr ? 'بطاقة الصنف' : isTr ? 'Ürün Kartı' : 'Product Card',
    noItemsInSearch: isAr ? 'لا توجد أصناف تطابق البحث' : isTr ? 'Aramayla eşleşen ürün bulunamadı' : 'No items match your search',
    emptyStockInWh: isAr ? 'لا يوجد مخزون حالياً في هذا المستودع' : isTr ? 'Bu depoda şu anda stok bulunmuyor' : 'No inventory currently in this warehouse',
    close: isAr ? 'إغلاق' : isTr ? 'Kapat' : 'Close',
    delTitle: isAr ? 'تأكيد حذف المستودع' : isTr ? 'Depoyu Silmeyi Onayla' : 'Confirm Warehouse Deletion',
    delConfirmMsg: (name: string, code: string) =>
      isAr
        ? `هل أنت متأكد من رغبتك في حذف مستودع "${name}" (الكود: ${code})؟`
        : isTr
        ? `"${name}" deposunu (Kod: ${code}) silmek istediğinizden emin misiniz?`
        : `Are you sure you want to delete warehouse "${name}" (Code: ${code})?`,
    delBullet1: isAr
      ? '• فحص الحركات: لن يسمح النظام بالحذف إذا كان المستودع يحتوي على حركات مخزنية، فواتير، أو رصيد بضاعة نشط.'
      : isTr
      ? '• Hareket Kontrolü: Depoda stok bakiyesi, fatura veya geçmiş hareket varsa silmeye izin verilmez.'
      : '• Movement Check: Deletion is blocked if the warehouse has transaction history, invoices, or active stock balances.',
    delBullet2: isAr
      ? '• إذا كان المستودع مستخدماً وتريد إيقاف التعامل به، يفضل تعطيله (إلغاء التفعيل) للحفاظ على سلامة شجرة الحسابات والتقارير المالية.'
      : isTr
      ? '• İşlemleri durdurmak için silmek yerine depoyu pasife alabilirsiniz.'
      : '• To halt operations on a used warehouse, deactivate it instead to maintain audit integrity.',
    confirmDeleteBtn: isAr ? 'تأكيد الحذف' : isTr ? 'Silmeyi Onayla' : 'Confirm Delete',
    deletingBtn: isAr ? 'جاري الفحص والحذف...' : isTr ? 'Siliniyor...' : 'Deleting...',
  }

  // Keep state synced with props on router refresh
  React.useEffect(() => {
    setWarehouses(initialWarehouses)
  }, [initialWarehouses])

  const openCreateModal = () => {
    setEditingWarehouse(null)
    setFormName('')
    setFormCode(`WH-00${warehouses.length + 1}`)
    setFormLocation('')
    setFormAddress('')
    setFormIsDefault(warehouses.length === 0)
    setFormIsActive(true)
    setIsCreateModalOpen(true)
  }

  const openEditModal = (wh: WarehouseDetailRow) => {
    setEditingWarehouse(wh)
    setFormName(wh.name)
    setFormCode(wh.code)
    setFormLocation(wh.location)
    setFormAddress(wh.address)
    setFormIsDefault(wh.isDefault)
    setFormIsActive(wh.isActive)
    setIsCreateModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error('اسم المستودع مطلوب')
      return
    }

    setSaving(true)
    try {
      if (editingWarehouse) {
        const res = await updateWarehouseAction(businessId, editingWarehouse.id, {
          name: formName,
          code: formCode,
          location: formLocation,
          address: formAddress,
          isDefault: formIsDefault,
          isActive: formIsActive,
        })
        if (res.success) {
          toast.success(`تم تحديث المستودع "${formName}" بنجاح`)
          setIsCreateModalOpen(false)
          router.refresh()
        } else {
          toast.error(res.error || 'فشل في تحديث المستودع')
        }
      } else {
        const res = await createWarehouseAction(businessId, {
          name: formName,
          code: formCode,
          location: formLocation,
          address: formAddress,
          isDefault: formIsDefault,
        })
        if (res.success) {
          toast.success(`تم إنشاء المستودع "${formName}" بنجاح`)
          setIsCreateModalOpen(false)
          router.refresh()
        } else {
          toast.error(res.error || 'فشل في إنشاء المستودع')
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء حفظ المستودع')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (wh: WarehouseDetailRow) => {
    const newStatus = !wh.isActive
    try {
      const res = await toggleWarehouseStatusAction(businessId, wh.id, newStatus)
      if (res.success) {
        toast.success(`تم ${newStatus ? 'تفعيل' : 'تعطيل'} مستودع "${wh.name}"`)
        router.refresh()
      } else {
        toast.error(res.error || 'فشل في تغيير الحالة')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingWarehouse) return
    setSaving(true)
    try {
      const res = await deleteWarehouseAction(businessId, deletingWarehouse.id)
      if (res.success) {
        toast.success(`تم حذف مستودع "${deletingWarehouse.name}" بنجاح`)
        setDeletingWarehouse(null)
        router.refresh()
      } else {
        toast.error(res.error || 'لا يمكن حذف المستودع')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  // Calculate high level metrics
  const totalWarehouses = warehouses.length
  const activeWarehouses = warehouses.filter((w) => w.isActive).length
  const totalValuation = warehouses.reduce((acc, w) => acc + w.totalValuation, 0)
  const totalUnits = warehouses.reduce((acc, w) => acc + w.totalQuantity, 0)

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((w) => {
      if (statusFilter === 'active') return w.isActive
      if (statusFilter === 'inactive') return !w.isActive
      return true
    })
  }, [warehouses, statusFilter])

  const columns: Column<WarehouseDetailRow>[] = [
    {
      key: 'code',
      header: t.colCode,
      sortable: true,
      sortValue: (r) => r.code,
      accessor: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.825rem',
              color: 'var(--primary-color)',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
            }}
          >
            {r.code || '—'}
          </span>
          {r.isDefault && (
            <span
              className="badge badge-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.675rem' }}
              title={t.defaultBadge}
            >
              <Star size={10} /> {t.defaultBadge}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: t.colName,
      sortable: true,
      sortValue: (r) => r.name,
      accessor: (r) => (
        <div>
          <button
            type="button"
            onClick={() => setInspectingWarehouse(r)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: isAr ? 'right' : 'left',
              fontSize: '0.875rem',
            }}
            className="hover:underline"
          >
            {r.name}
          </button>
          {r.location && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
              <MapPin size={11} /> {r.location}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'uniqueItemCount',
      header: t.colItems,
      sortable: true,
      sortValue: (r) => r.uniqueItemCount,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {r.uniqueItemCount} {t.itemSuffix}
        </span>
      ),
    },
    {
      key: 'totalQuantity',
      header: t.colUnits,
      sortable: true,
      sortValue: (r) => r.totalQuantity,
      accessor: (r) => (
        <span style={{ fontWeight: 600, color: r.totalQuantity > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
          {r.totalQuantity.toLocaleString()} {t.unitsLabel}
        </span>
      ),
    },
    {
      key: 'totalValuation',
      header: t.colValuation,
      sortable: true,
      sortValue: (r) => r.totalValuation,
      accessor: (r) => (
        <span style={{ fontWeight: 700, color: 'var(--color-brand-500)', fontFamily: 'Outfit, sans-serif' }}>
          {formatCurrency(r.totalValuation, defaultCurrency)}
        </span>
      ),
    },
    {
      key: 'movementCount',
      header: t.colMovements,
      sortable: true,
      sortValue: (r) => r.movementCount,
      accessor: (r) => (
        <span className="badge badge-secondary" style={{ fontSize: '0.725rem' }}>
          {r.movementCount} {t.movementSuffix}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: t.colStatus,
      sortable: true,
      sortValue: (r) => (r.isActive ? 1 : 0),
      accessor: (r) => (
        <button
          type="button"
          onClick={() => handleToggleStatus(r)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {r.isActive ? (
            <span className="badge badge-success" style={{ cursor: 'pointer' }}>{t.activeBadge}</span>
          ) : (
            <span className="badge badge-danger" style={{ cursor: 'pointer' }}>{t.inactiveBadge}</span>
          )}
        </button>
      ),
    },
    {
      key: 'actions',
      header: t.colActions,
      hideable: false,
      accessor: (r) => (
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setInspectingWarehouse(r)}
            style={{ height: 28, padding: '0 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
          >
            <Eye size={12} />
            {t.viewContents}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => openEditModal(r)}
            style={{ height: 28, width: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setDeletingWarehouse(r)}
            style={{ height: 28, width: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ]

  // Filter items in inspection modal
  const filteredInspectItems = useMemo(() => {
    if (!inspectingWarehouse) return []
    const q = inspectSearch.trim().toLowerCase()
    if (!q) return inspectingWarehouse.items
    return inspectingWarehouse.items.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) || item.productSku.toLowerCase().includes(q)
    )
  }, [inspectingWarehouse, inspectSearch])

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Header */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link
              href={`/b/${businessId}/inventory`}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.5rem', height: 28 }}
              title={t.back}
            >
              <ArrowLeft size={14} />
            </Link>
            <h1 className="page-title" style={{ margin: 0 }}>
              {t.title}
            </h1>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {t.subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreateModal}
            id="add-warehouse-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            {t.newWarehouse}
          </button>
          <Link href={`/b/${businessId}/inventory/transfer`} className="btn btn-secondary">
            <ArrowRightLeft size={16} />
            {t.stockTransfers}
          </Link>
          <Link href={`/b/${businessId}/inventory/adjustment`} className="btn btn-secondary">
            <SlidersHorizontal size={16} />
            {t.stockAdjustments}
          </Link>
          <Link href={`/b/${businessId}/inventory`} className="btn btn-secondary">
            <Package size={16} />
            {t.productsList}
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.totalWhCard}</span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-color)',
              }}
            >
              <WarehouseIcon size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {totalWarehouses} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>{t.whUnit}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
            {t.activeCount(activeWarehouses)}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.totalValuationCard}</span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>
            {formatCurrency(totalValuation, defaultCurrency)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.wacLabel}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.totalUnitsCard}</span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
              }}
            >
              <Boxes size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6' }}>
            {totalUnits.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>{t.unitsLabel}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t.distributedLabel}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('all')}
        >
          {t.tabAll(warehouses.length)}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('active')}
        >
          <CheckCircle2 size={13} style={{ marginInlineEnd: '0.25rem', color: '#10b981' }} />
          {t.tabActive(warehouses.filter((w) => w.isActive).length)}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'inactive' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('inactive')}
        >
          <XCircle size={13} style={{ marginInlineEnd: '0.25rem', color: '#ef4444' }} />
          {t.tabInactive(warehouses.filter((w) => !w.isActive).length)}
        </button>
      </div>

      {/* Main Warehouses Table */}
      <DataTable
        data={filteredWarehouses}
        columns={columns}
        searchKey={(r) => `${r.code} ${r.name} ${r.location} ${r.address}`}
        searchPlaceholder={t.searchPlaceholder}
        emptyTitle={t.emptyTitle}
        emptySubtext={t.emptySubtext}
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
            {t.addWhBtn}
          </button>
        }
      />

      {/* CREATE / EDIT WAREHOUSE MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingWarehouse ? t.modalEditTitle(editingWarehouse.name) : t.modalAddTitle}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label required">{t.formName}</label>
            <input
              type="text"
              className="form-control"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t.formNamePlaceholder}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">{t.formCode}</label>
              <input
                type="text"
                className="form-control"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. WH-MAIN, WH-01"
              />
            </div>
            <div>
              <label className="form-label">{t.formLocation}</label>
              <input
                type="text"
                className="form-control"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g. Riyadh, Istanbul, London"
              />
            </div>
          </div>

          <div>
            <label className="form-label">{t.formAddress}</label>
            <input
              type="text"
              className="form-control"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="e.g. Industrial Area, Gate 4"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>{t.formDefault}</span>
            </label>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginInlineStart: '1.5rem' }}>
              {t.formDefaultHint}
            </p>

            {editingWarehouse && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <span>{t.formActive}</span>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={saving}
            >
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t.saving : editingWarehouse ? t.saveChanges : t.createWh}
            </button>
          </div>
        </form>
      </Modal>

      {/* INSPECT WAREHOUSE STOCK MODAL */}
      <Modal
        isOpen={!!inspectingWarehouse}
        onClose={() => {
          setInspectingWarehouse(null)
          setInspectSearch('')
        }}
        title={inspectingWarehouse ? t.inspectTitle(inspectingWarehouse.name, inspectingWarehouse.code) : ''}
        maxWidth="850px"
      >
        {inspectingWarehouse && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Quick summary strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.875rem',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{t.inspectItems}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{inspectingWarehouse.uniqueItemCount} {t.itemSuffix}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{t.inspectQty}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3b82f6' }}>
                  {inspectingWarehouse.totalQuantity.toLocaleString()} {t.unitsLabel}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{t.inspectValue}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                  {formatCurrency(inspectingWarehouse.totalValuation, defaultCurrency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{t.inspectLoc}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{inspectingWarehouse.location || t.unspecified}</div>
              </div>
            </div>

            {/* Search inside warehouse items */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  insetInlineStart: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingInlineStart: '2rem' }}
                value={inspectSearch}
                onChange={(e) => setInspectSearch(e.target.value)}
                placeholder={t.inspectSearchPlaceholder}
              />
            </div>

            {/* Items Table */}
            <div
              style={{
                maxHeight: '340px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
              }}
            >
              <table className="table" style={{ margin: 0, fontSize: '0.825rem', textAlign: isAr ? 'right' : 'left' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2 }}>
                    <th>{t.skuHeader}</th>
                    <th>{t.prodHeader}</th>
                    <th>{t.qtyHeader}</th>
                    <th>{t.wacHeader}</th>
                    <th>{t.valHeader}</th>
                    <th>{t.actionHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInspectItems.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-color)' }}>
                          {item.productSku}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.productName}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: item.quantity > 0 ? '#10b981' : '#ef4444',
                          }}
                        >
                          {item.quantity} {t.unitsLabel}
                        </span>
                      </td>
                      <td>{formatCurrency(item.averageCost, defaultCurrency)}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>
                        {formatCurrency(item.totalValue, defaultCurrency)}
                      </td>
                      <td>
                        <Link
                          href={`/b/${businessId}/inventory/${item.productId}`}
                          className="btn btn-secondary btn-sm"
                          style={{ height: 26, padding: '0 0.5rem', fontSize: '0.725rem' }}
                        >
                          {t.cardBtn}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredInspectItems.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        {inspectSearch ? t.noItemsInSearch : t.emptyStockInWh}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setInspectingWarehouse(null)
                  setInspectSearch('')
                }}
              >
                {t.close}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL WITH SAFEGUARD */}
      <Modal
        isOpen={!!deletingWarehouse}
        onClose={() => setDeletingWarehouse(null)}
        title={t.delTitle}
      >
        {deletingWarehouse && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--border-radius)',
                color: '#ef4444',
              }}
            >
              <ShieldAlert size={28} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.85rem' }}>
                {t.delConfirmMsg(deletingWarehouse.name, deletingWarehouse.code)}
              </div>
            </div>

            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                {t.delBullet1}
              </p>
              <p style={{ margin: 0 }}>
                {t.delBullet2}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingWarehouse(null)}
                disabled={saving}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={saving}
              >
                {saving ? t.deletingBtn : t.confirmDeleteBtn}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

