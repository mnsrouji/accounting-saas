'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ChevronRight, Home } from 'lucide-react'

export function Breadcrumbs() {
  const pathname = usePathname()
  const locale = useLocale()
  
  // Format pathname into segments: /b/123/sales/new -> ['b', '123', 'sales', 'new']
  const segments = pathname.split('/').filter(Boolean)
  
  // Find where /b/[businessId] ends
  const bIndex = segments.indexOf('b')
  const businessId = bIndex !== -1 && segments.length > bIndex + 1 ? segments[bIndex + 1] : null
  
  const appSegments = businessId ? segments.slice(bIndex + 2) : segments

  const dashboardLabel =
    locale === 'ar' ? 'لوحة التحكم' : locale === 'tr' ? 'Kontrol Paneli' : 'Dashboard'

  if (appSegments.length === 0) {
    return (
      <div className="breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <Home size={14} />
        <span>{dashboardLabel}</span>
      </div>
    )
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const SEGMENT_NAMES: Record<string, { ar: string; tr: string; en: string }> = {
    inventory: { ar: 'المخزون', tr: 'Stok', en: 'Inventory' },
    warehouses: { ar: 'المستودعات', tr: 'Depolar', en: 'Warehouses' },
    items: { ar: 'الأصناف', tr: 'Ürünler', en: 'Items' },
    categories: { ar: 'التصنيفات', tr: 'Kategoriler', en: 'Categories' },
    adjustments: { ar: 'تسويات المخزون', tr: 'Stok Düzeltmeleri', en: 'Adjustments' },
    'stock-count': { ar: 'جرد المخزون', tr: 'Stok Sayımı', en: 'Stock Count' },
    'opening-balances': { ar: 'الأرصدة الافتتاحية', tr: 'Açılış Bakiyeleri', en: 'Opening Balances' },
    accounting: { ar: 'المحاسبة', tr: 'Genel Muhasebe', en: 'Accounting' },
    'journal-entries': { ar: 'القيود اليومية', tr: 'Yevmiye Fişleri', en: 'Journal Entries' },
    'chart-of-accounts': { ar: 'دليل الحسابات', tr: 'Hesap Planı', en: 'Chart of Accounts' },
    'trial-balance': { ar: 'ميزان المراجعة', tr: 'Mizan', en: 'Trial Balance' },
    'general-ledger': { ar: 'دفتر الأستاذ', tr: 'Büyük Defter', en: 'General Ledger' },
    closing: { ar: 'إقفال الفترات', tr: 'Dönem Sonu Kapanışı', en: 'Period Closing' },
    sales: { ar: 'المبيعات', tr: 'Satış', en: 'Sales' },
    purchases: { ar: 'المشتريات', tr: 'Satın Alma', en: 'Purchases' },
    customers: { ar: 'العملاء', tr: 'Müşteriler', en: 'Customers' },
    suppliers: { ar: 'الموردين', tr: 'Tedarikçiler', en: 'Suppliers' },
    orders: { ar: 'أوامر العمليات', tr: 'Siparişler', en: 'Orders' },
    returns: { ar: 'المرتجعات', tr: 'İadeler', en: 'Returns' },
    expenses: { ar: 'المصروفات', tr: 'Giderler', en: 'Expenses' },
    payments: { ar: 'المدفوعات والسندات', tr: 'Ödemeler', en: 'Payments' },
    treasury: { ar: 'الخزينة والمصارف', tr: 'Kasa ve Banka', en: 'Treasury' },
    cash: { ar: 'الصناديق النقدية', tr: 'Kasa', en: 'Cash' },
    banks: { ar: 'الحسابات البنكية', tr: 'Bankalar', en: 'Banks' },
    reconciliation: { ar: 'المطابقة البنكية', tr: 'Banka Mutabakatı', en: 'Reconciliation' },
    transfers: { ar: 'التحويلات المالية', tr: 'Transferler', en: 'Transfers' },
    reports: { ar: 'التقارير المالية', tr: 'Mali Raporlar', en: 'Financial Reports' },
    pl: { ar: 'الأرباح والخسائر', tr: 'Gelir Tablosu', en: 'Profit & Loss' },
    'balance-sheet': { ar: 'الميزانية العمومية', tr: 'Bilanço', en: 'Balance Sheet' },
    'cash-flow': { ar: 'التدفقات النقدية', tr: 'Nakit Akışı', en: 'Cash Flow' },
    aging: { ar: 'أعمار الديون', tr: 'Yaşlandırma', en: 'Aging Analysis' },
    kpi: { ar: 'مؤشرات الأداء', tr: 'Yönetici KPI', en: 'Executive KPIs' },
    analytics: { ar: 'التحليلات', tr: 'Analitik', en: 'Analytics' },
    settings: { ar: 'الإعدادات', tr: 'Ayarlar', en: 'Settings' },
    company: { ar: 'ملف الشركة', tr: 'Şirket Profili', en: 'Company Profile' },
    taxes: { ar: 'الضرائب', tr: 'Vergiler', en: 'Taxes' },
    financial: { ar: 'الإعدادات المالية', tr: 'Mali Ayarlar', en: 'Financial Settings' },
    members: { ar: 'فريق العمل', tr: 'Ekip Üyeleri', en: 'Team Members' },
    security: { ar: 'مركز الأمان', tr: 'Güvenlik Merkezi', en: 'Security Center' },
    usage: { ar: 'الاستخدام والسعة', tr: 'Kullanım ve Kota', en: 'Usage & Quota' },
    billing: { ar: 'الاشتراك والفواتير', tr: 'Abonelik ve Faturalandırma', en: 'Billing' },
    subscription: { ar: 'الاشتراك', tr: 'Abonelik', en: 'Subscription' },
    roles: { ar: 'الأدوار والصلاحيات', tr: 'Roller ve Yetkiler', en: 'Roles & Permissions' },
    users: { ar: 'المستخدمين', tr: 'Kullanıcılar', en: 'Users' },
    audit: { ar: 'سجل التدقيق', tr: 'Denetim İzi', en: 'Audit Trail' },
    backup: { ar: 'النسخ الاحتياطي', tr: 'Yedekleme', en: 'Backup' },
    new: { ar: 'جديد', tr: 'Yeni', en: 'New' },
    edit: { ar: 'تعديل', tr: 'Düzenle', en: 'Edit' },
  }

  const breadcrumbItems = appSegments.map((seg, idx) => {
    const href = `/b/${businessId}/${appSegments.slice(0, idx + 1).join('/')}`
    const segKey = seg.toLowerCase()
    const match = SEGMENT_NAMES[segKey]

    let label = ''
    if (match) {
      label = locale === 'ar' ? match.ar : locale === 'tr' ? match.tr : match.en
    } else if (UUID_REGEX.test(seg)) {
      label = locale === 'ar' ? 'تفاصيل السجل' : locale === 'tr' ? 'Kayıt Detayları' : 'Details'
    } else {
      label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
    }

    const isLast = idx === appSegments.length - 1

    return { label, href, isLast }
  })

  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
      <Link href={businessId ? `/b/${businessId}/dashboard` : '/dashboard'} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', textDecoration: 'none' }}>
        <Home size={14} />
      </Link>
      {breadcrumbItems.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
          {item.isLast ? (
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
          ) : (
            <Link href={item.href} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
