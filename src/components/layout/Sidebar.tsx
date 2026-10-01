'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import type { BusinessUser, Business } from '@prisma/client'
import {
  LayoutDashboard,
  Users,
  Truck,
  ShoppingCart,
  Package,
  CreditCard,
  Receipt,
  Warehouse,
  Landmark,
  PiggyBank,
  BookOpen,
  BarChart3,
  Settings,
  UserCog,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowLeftRight,
  FileSpreadsheet,
  CheckCheck,
  Coins,
  TrendingUp,
  WalletCards,
  Layers,
  Scale,
  DollarSign,
  Search,
  SlidersHorizontal,
  Clock,
  Activity,
  FileText,
  Building2,
  Database,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/utils'
import { useSidebar } from '@/components/layout/AppShell'

type MembershipWithBusiness = BusinessUser & { business: Business }

interface SidebarProps {
  memberships: MembershipWithBusiness[]
  userId: string
}

interface NavSubItem {
  label: string
  labelAr?: string
  labelTr?: string
  href: string
  id: string
  badge?: string
}

interface NavItem {
  id: string
  label: string
  labelAr?: string
  labelTr?: string
  icon: any
  href?: string
  quickAction?: {
    href: string
    title: string
  }
  children?: NavSubItem[]
}

interface NavSection {
  title: string
  titleAr: string
  titleTr: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Core Operations',
    titleAr: 'العمليات التشغيلية',
    titleTr: 'Operasyonel İşlemler',
    items: [
      {
        id: 'nav-dashboard',
        label: 'Dashboard',
        labelAr: 'لوحة القيادة',
        labelTr: 'Kontrol Paneli',
        icon: LayoutDashboard,
        href: '',
      },
      {
        id: 'nav-sales-group',
        label: 'Sales & CRM',
        labelAr: 'المبيعات والعملاء',
        labelTr: 'Satış ve Müşteriler',
        icon: ShoppingCart,
        quickAction: { href: '/sales/new', title: 'New Invoice' },
        children: [
          { label: 'Sales Invoices', labelAr: 'فواتير المبيعات', labelTr: 'Satış Faturaları', href: '/sales', id: 'nav-sales-list' },
          { label: 'Customers', labelAr: 'العملاء', labelTr: 'Müşteriler', href: '/customers', id: 'nav-customers' },
          { label: 'Receive Payments', labelAr: 'مقبوضات العملاء', labelTr: 'Tahsilatlar', href: '/payments/incoming', id: 'nav-payments-in' },
        ],
      },
      {
        id: 'nav-purchases-group',
        label: 'Purchases & Vendors',
        labelAr: 'المشتريات والموردين',
        labelTr: 'Satın Alma ve Tedarikçiler',
        icon: Package,
        quickAction: { href: '/purchases/new', title: 'New Bill' },
        children: [
          { label: 'Purchase Bills', labelAr: 'فواتير الشراء', labelTr: 'Alış Faturaları', href: '/purchases', id: 'nav-purchases-list' },
          { label: 'Suppliers', labelAr: 'الموردين', labelTr: 'Tedarikçiler', href: '/suppliers', id: 'nav-suppliers' },
          { label: 'Pay Bills', labelAr: 'مدفوعات الموردين', labelTr: 'Ödemeler', href: '/payments/outgoing', id: 'nav-payments-out' },
          { label: 'Operating Expenses', labelAr: 'المصروفات التشغيلية', labelTr: 'Giderler', href: '/expenses', id: 'nav-expenses' },
        ],
      },
      {
        id: 'nav-inventory-group',
        label: 'Inventory & Stock',
        labelAr: 'المخزون والمستودعات',
        labelTr: 'Stok ve Depolar',
        icon: Warehouse,
        children: [
          { label: 'Products & WAC', labelAr: 'المنتجات والتكلفة', labelTr: 'Ürünler ve Maliyet', href: '/inventory', id: 'nav-inventory-list' },
          { label: 'Warehouses', labelAr: 'إدارة المستودعات', labelTr: 'Depo Yönetimi', href: '/inventory/warehouses', id: 'nav-inventory-warehouses' },
          { label: 'Stock Transfers', labelAr: 'التحويلات المخزنية', labelTr: 'Stok Transferleri', href: '/inventory/transfer', id: 'nav-inventory-transfers' },
          { label: 'Stock Adjustments', labelAr: 'تسويات الجرد', labelTr: 'Stok Düzeltmeleri', href: '/inventory/adjustment', id: 'nav-inventory-adjustments' },
        ],
      },
    ],
  },
  {
    title: 'Treasury & Cash',
    titleAr: 'الخزينة والمصارف',
    titleTr: 'Kasa ve Bankalar',
    items: [
      {
        id: 'nav-treasury-group',
        label: 'Treasury & Banking',
        labelAr: 'الخزينة والحسابات البنكية',
        labelTr: 'Banka ve Kasa',
        icon: PiggyBank,
        quickAction: { href: '/treasury/transfers', title: 'Internal Transfer' },
        children: [
          { label: 'Treasury Overview', labelAr: 'نظرة عامة على الخزينة', labelTr: 'Finansal Genel Bakış', href: '/treasury', id: 'nav-treasury-overview' },
          { label: 'Cash Accounts', labelAr: 'الصناديق النقدية', labelTr: 'Kasa Hesapları', href: '/treasury/cash', id: 'nav-treasury-cash' },
          { label: 'Bank Accounts', labelAr: 'الحسابات البنكية', labelTr: 'Banka Hesapları', href: '/treasury/banks', id: 'nav-treasury-banks' },
          { label: 'Transactions Log', labelAr: 'حركة المعاملات', labelTr: 'Hareket Kayıtları', href: '/treasury/transactions', id: 'nav-treasury-transactions' },
          { label: 'Internal Transfers', labelAr: 'التحويلات البنكية', labelTr: 'Virman Transferleri', href: '/treasury/transfers', id: 'nav-treasury-transfers' },
          { label: 'Bank Reconciliation', labelAr: 'التسوية البنكية', labelTr: 'Banka Mutabakatı', href: '/treasury/reconciliation', id: 'nav-treasury-reconciliation' },
          { label: 'Bank Statements', labelAr: 'كشوفات الحساب', labelTr: 'Hesap Ekstreleri', href: '/treasury/statements', id: 'nav-treasury-statements' },
          { label: 'Petty Cash', labelAr: 'العهدة النثرية', labelTr: 'Küçük Kasa / Avans', href: '/treasury/petty-cash', id: 'nav-treasury-petty-cash' },
          { label: 'Cash Forecast', labelAr: 'التوقعات النقدية', labelTr: 'Nakit Tahmini', href: '/treasury/forecast', id: 'nav-treasury-forecast' },
        ],
      },
    ],
  },
  {
    title: 'Accounting & Analytics',
    titleAr: 'المحاسبة والتقارير',
    titleTr: 'Muhasebe ve Raporlar',
    items: [
      {
        id: 'nav-accounting-group',
        label: 'General Accounting',
        labelAr: 'المحاسبة العامة',
        labelTr: 'Genel Muhasebe',
        icon: BookOpen,
        quickAction: { href: '/accounting/journal-entries', title: 'New Journal' },
        children: [
          { label: 'Accounting Hub', labelAr: 'مركز المحاسبة', labelTr: 'Muhasebe Merkezi', href: '/accounting', id: 'nav-accounting-hub' },
          { label: 'Chart of Accounts', labelAr: 'دليل الحسابات', labelTr: 'Hesap Planı', href: '/accounting/chart-of-accounts', id: 'nav-chart-of-accounts' },
          { label: 'Journal Entries', labelAr: 'قيود اليومية', labelTr: 'Yevmiye Fişleri', href: '/accounting/journal-entries', id: 'nav-journal-entries' },
          { label: 'General Ledger', labelAr: 'دفتر الأستاذ العام', labelTr: 'Büyük Defter (Kebir)', href: '/accounting/general-ledger', id: 'nav-general-ledger' },
          { label: 'Trial Balance', labelAr: 'ميزان المراجعة', labelTr: 'Mizan Raporu', href: '/accounting/trial-balance', id: 'nav-trial-balance' },
        ],
      },
      {
        id: 'nav-reports-group',
        label: 'Financial Statements',
        labelAr: 'التقارير المالية',
        labelTr: 'Mali Tablolar',
        icon: BarChart3,
        children: [
          { label: 'Reports Hub', labelAr: 'مركز التقارير', labelTr: 'Raporlar Merkezi', href: '/reports', id: 'nav-reports-hub' },
          { label: 'Profit & Loss (P&L)', labelAr: 'الأرباح والخسائر', labelTr: 'Gelir Tablosu', href: '/reports/pl', id: 'nav-reports-pl' },
          { label: 'Balance Sheet', labelAr: 'الميزانية العمومية', labelTr: 'Bilanço', href: '/reports/balance-sheet', id: 'nav-reports-bs' },
          { label: 'Cash Flow Statement', labelAr: 'التدفقات النقدية', labelTr: 'Nakit Akış Tablosu', href: '/reports/cash-flow', id: 'nav-reports-cf' },
          { label: 'Aging Analysis (AR/AP)', labelAr: 'أعمار الديون', labelTr: 'Borç/Alacak Yaşlandırma', href: '/reports/aging', id: 'nav-reports-aging' },
          { label: 'Executive KPIs', labelAr: 'مؤشرات الأداء (KPIs)', labelTr: 'Yönetici KPI Paneli', href: '/reports/kpi', id: 'nav-reports-kpi' },
        ],
      },
    ],
  },
  {
    title: 'Administration',
    titleAr: 'الإدارة والتحكم',
    titleTr: 'Yönetim ve Ayarlar',
    items: [
      {
        id: 'nav-users',
        label: 'Users & Roles',
        labelAr: 'المستخدمين والأدوار',
        labelTr: 'Kullanıcılar ve Roller',
        icon: UserCog,
        href: '/users',
      },
      {
        id: 'nav-audit',
        label: 'Audit Trail',
        labelAr: 'سجل التدقيق الأمني',
        labelTr: 'Denetim İzi (Audit)',
        icon: ScrollText,
        href: '/audit',
      },
      {
        id: 'nav-backup',
        label: 'Backup & Data',
        labelAr: 'النسخ الاحتياطي والبيانات',
        labelTr: 'Yedekleme ve Veri',
        icon: Database,
        href: '/settings/backup',
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        labelAr: 'إعدادات النظام',
        labelTr: 'Sistem Ayarları',
        icon: Settings,
        href: '/settings',
      },
    ],
  },
]

export function Sidebar({ memberships, userId }: SidebarProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Determine active business from URL
  const businessIdFromUrl = pathname.match(/\/b\/([^/]+)/)?.[1]
  const activeMembership =
    memberships.find((m) => m.businessId === businessIdFromUrl) ?? memberships[0]
  const activeBusiness = activeMembership?.business
  const businessBase = `/b/${activeBusiness?.id}`

  const getSectionTitle = (sec: NavSection) => {
    if (locale === 'ar') return sec.titleAr || sec.title
    if (locale === 'tr') return sec.titleTr || sec.title
    return sec.title
  }

  const getItemLabel = (item: NavItem | NavSubItem) => {
    if (locale === 'ar') return item.labelAr || item.label
    if (locale === 'tr') return item.labelTr || item.label
    return item.label
  }

  // Expanded accordion groups state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Automatically expand group containing current active path
  useEffect(() => {
    const updated: Record<string, boolean> = {}
    navSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children) {
          const hasActiveChild = item.children.some((child) => {
            const fullHref = `${businessBase}${child.href}`
            return pathname === fullHref || pathname.startsWith(`${fullHref}/`)
          })
          if (hasActiveChild) {
            updated[item.id] = true
          }
        }
      })
    })
    setExpandedGroups((prev) => ({ ...prev, ...updated }))
  }, [pathname, businessBase])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  // Filter sections by search query if present
  const isFiltering = searchQuery.trim().length > 0
  const filteredSections = navSections.map((sec) => {
    if (!isFiltering) return sec
    const q = searchQuery.toLowerCase()
    const matchingItems = sec.items
      .map((item) => {
        const itemMatches =
          item.label.toLowerCase().includes(q) ||
          (item.labelAr && item.labelAr.toLowerCase().includes(q)) ||
          (item.labelTr && item.labelTr.toLowerCase().includes(q))
        const matchingChildren = item.children?.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            (c.labelAr && c.labelAr.toLowerCase().includes(q)) ||
            (c.labelTr && c.labelTr.toLowerCase().includes(q))
        )
        if (itemMatches || (matchingChildren && matchingChildren.length > 0)) {
          return {
            ...item,
            children: matchingChildren && matchingChildren.length > 0 ? matchingChildren : item.children,
          }
        }
        return null
      })
      .filter(Boolean) as NavItem[]

    return { ...sec, items: matchingItems }
  }).filter((sec) => sec.items.length > 0)

  const enterpriseBadge =
    locale === 'ar' ? 'نظام المؤسسات ERP' : locale === 'tr' ? 'Kurumsal ERP' : 'Enterprise ERP'
  const searchPlaceholder =
    locale === 'ar' ? 'بحث في القوائم...' : locale === 'tr' ? 'Menüde ara...' : 'Search menu...'

  const { setMobileOpen } = useSidebar()

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-logo" style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 800,
              fontSize: '1.125rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              AccountFlow
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#818cf8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Enterprise ERP
            </div>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          className="mobile-sidebar-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Business Switcher */}
      <div style={{ padding: '0.75rem 0.75rem 0.5rem', flexShrink: 0 }}>
        <div
          className="business-switcher"
          onClick={() => setSwitcherOpen((o) => !o)}
          role="button"
          tabIndex={0}
          id="business-switcher-btn"
          aria-expanded={switcherOpen}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '0.625rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <div
            className="business-avatar"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.875rem',
              flexShrink: 0,
            }}
          >
            {activeBusiness?.name?.[0]?.toUpperCase() ?? 'B'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeBusiness?.name ?? 'My Business'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'capitalize' }}>
              {activeMembership?.role ?? 'Owner'} · {activeBusiness?.defaultCurrency || 'USD'}
            </div>
          </div>
          <ChevronDown
            size={14}
            style={{
              color: '#64748b',
              flexShrink: 0,
              transform: switcherOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 200ms ease',
            }}
          />
        </div>
      </div>

      {/* Business Dropdown Modal */}
      {switcherOpen && (
        <div
          style={{
            margin: '0 0.75rem 0.5rem',
            background: '#1e293b',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            zIndex: 40,
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Switch Organization
          </div>
          {memberships.map((m) => (
            <Link
              key={m.businessId}
              href={`/b/${m.businessId}/dashboard`}
              onClick={() => setSwitcherOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.75rem',
                textDecoration: 'none',
                transition: 'background 150ms',
                background: m.businessId === activeBusiness?.id ? 'rgba(99,102,241,0.18)' : 'transparent',
                borderLeft: m.businessId === activeBusiness?.id ? '3px solid #6366f1' : '3px solid transparent',
              }}
              className="business-switcher-item"
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: '#334155',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {m.business.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.business.name}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{m.role}</div>
              </div>
            </Link>
          ))}
          <Link
            href="/onboarding"
            onClick={() => setSwitcherOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              textDecoration: 'none',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              color: '#818cf8',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            <Plus size={15} />
            Add New Business
          </Link>
        </div>
      )}

      {/* Quick Search Filter */}
      <div style={{ padding: '0.25rem 0.75rem 0.5rem', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.375rem 0.625rem',
          }}
        >
          <Search size={14} style={{ color: '#64748b' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e2e8f0',
              fontSize: '0.75rem',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.5rem 0.625rem' }}>
        {filteredSections.map((section) => (
          <div key={section.title} style={{ marginBottom: '1.25rem' }}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#64748b',
                padding: '0.5rem 0.75rem 0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{getSectionTitle(section)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              {section.items.map((item) => {
                const isGroup = Boolean(item.children && item.children.length > 0)
                const isExpanded = expandedGroups[item.id] || isFiltering

                // Determine active status for parent item or direct item
                const directHref = item.href !== undefined ? `${businessBase}${item.href}` : ''
                const isDirectActive =
                  item.href === ''
                    ? pathname === directHref || pathname === `${businessBase}/dashboard`
                    : directHref !== '' && (pathname === directHref || pathname.startsWith(`${directHref}/`))

                const isChildActive = item.children?.some((c) => {
                  const cHref = `${businessBase}${c.href}`
                  return pathname === cHref || pathname.startsWith(`${cHref}/`)
                })

                if (!isGroup) {
                  return (
                    <Link
                      key={item.id}
                      href={directHref === `${businessBase}` ? `${businessBase}/dashboard` : directHref}
                      id={item.id}
                      className={cn('sidebar-nav-item', isDirectActive && 'active')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        color: isDirectActive ? '#ffffff' : '#94a3b8',
                        textDecoration: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: isDirectActive ? 600 : 500,
                        transition: 'all 150ms ease',
                      }}
                    >
                      <item.icon size={17} className="nav-icon" style={{ opacity: isDirectActive ? 1 : 0.8 }} />
                      <span style={{ flex: 1 }}>{getItemLabel(item)}</span>
                    </Link>
                  )
                }

                return (
                  <div key={item.id} style={{ marginBottom: '0.125rem' }}>
                    {/* Collapsible Parent Row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleGroup(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        color: isChildActive ? '#ffffff' : '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: isChildActive ? 700 : 500,
                        background: isChildActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        transition: 'all 150ms ease',
                      }}
                      className="sidebar-group-header"
                    >
                      <item.icon
                        size={17}
                        className="nav-icon"
                        style={{ color: isChildActive ? '#818cf8' : '#94a3b8' }}
                      />
                      <span style={{ flex: 1 }}>{getItemLabel(item)}</span>

                      {/* Quick Action Button */}
                      {item.quickAction && (
                        <Link
                          href={`${businessBase}${item.quickAction.href}`}
                          title={item.quickAction.title}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: 'rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                            textDecoration: 'none',
                            transition: 'all 150ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#6366f1'
                            e.currentTarget.style.color = '#ffffff'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.color = '#94a3b8'
                          }}
                        >
                          <Plus size={12} />
                        </Link>
                      )}

                      <ChevronRight
                        size={14}
                        style={{
                          color: '#64748b',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 180ms ease',
                        }}
                      />
                    </div>

                    {/* Sub Menu Links */}
                    {isExpanded && (
                      <div
                        style={{
                          paddingInlineStart: '1.25rem',
                          marginTop: '0.125rem',
                          marginBottom: '0.25rem',
                          borderInlineStart: '1px solid rgba(255,255,255,0.08)',
                          marginInlineStart: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.125rem',
                        }}
                      >
                        {item.children?.map((sub) => {
                          const subHref = `${businessBase}${sub.href}`
                          const isSubActive = pathname === subHref || (sub.href !== '' && pathname.startsWith(`${subHref}/`))

                          return (
                            <Link
                              key={sub.id}
                              href={subHref}
                              id={sub.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.45rem 0.625rem',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontSize: '0.78125rem',
                                color: isSubActive ? '#ffffff' : '#94a3b8',
                                background: isSubActive ? '#6366f1' : 'transparent',
                                fontWeight: isSubActive ? 600 : 400,
                                transition: 'all 120ms ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSubActive) {
                                  e.currentTarget.style.color = '#ffffff'
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSubActive) {
                                  e.currentTarget.style.color = '#94a3b8'
                                  e.currentTarget.style.background = 'transparent'
                                }
                              }}
                            >
                              <span>{getItemLabel(sub)}</span>
                              {sub.badge && (
                                <span style={{ fontSize: '0.625rem', padding: '0.1rem 0.375rem', borderRadius: 4, background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                                  {sub.badge}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Footer Info */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '0.75rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: '#0a0f1d',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Building2 size={13} color="#818cf8" />
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>{activeBusiness?.country || 'US'}</span>
        </div>
        <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: 4, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 700 }}>
          {activeBusiness?.defaultCurrency || 'USD'}
        </span>
      </div>
    </aside>
  )
}

