'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  Building,
  DollarSign,
  Coins,
  Percent,
  BookOpen,
  Hash,
  FileText,
  Globe,
  Sliders,
  Users,
  CreditCard,
  Database,
} from 'lucide-react'

interface Props {
  businessId: string
}

export function SettingsNav({ businessId }: Props) {
  const pathname = usePathname()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const tabs = [
    { label: isAr ? 'نظرة عامة' : isTr ? 'Genel Bakış' : 'Overview', href: `/b/${businessId}/settings`, icon: Sliders, exact: true },
    { label: isAr ? 'النسخ والاستعادة' : isTr ? 'Yedekleme ve Geri Yükleme' : 'Backup & Restore', href: `/b/${businessId}/settings/backup`, icon: Database },
    { label: isAr ? 'الاستخدام والسعة' : isTr ? 'Kullanım ve Kapasite' : 'Usage & Capacity', href: `/b/${businessId}/settings/usage`, icon: Sliders },
    { label: isAr ? 'مركز الأمان' : isTr ? 'Güvenlik Merkezi' : 'Security Center', href: `/b/${businessId}/settings/security`, icon: Sliders },
    { label: isAr ? 'فريق العمل' : isTr ? 'Ekip Üyeleri' : 'Team Members', href: `/b/${businessId}/settings/members`, icon: Users },
    { label: isAr ? 'الاشتراك' : isTr ? 'Abonelik' : 'Subscription & Usage', href: `/b/${businessId}/settings/subscription`, icon: CreditCard },
    { label: isAr ? 'الفواتير والمدفوعات' : isTr ? 'Faturalandırma' : 'Billing & Payments', href: `/b/${businessId}/settings/billing`, icon: CreditCard },
    { label: isAr ? 'ملف الشركة' : isTr ? 'Şirket Profili' : 'Company Profile', href: `/b/${businessId}/settings/company`, icon: Building },
    { label: isAr ? 'السنة المالية' : isTr ? 'Mali Dönem' : 'Financial & Fiscal', href: `/b/${businessId}/settings/financial`, icon: DollarSign },
    { label: isAr ? 'العملات والصرف' : isTr ? 'Para Birimleri' : 'Currencies & Rates', href: `/b/${businessId}/settings/currencies`, icon: Coins },
    { label: isAr ? 'الضرائب و VAT' : isTr ? 'Vergiler' : 'Tax Configuration', href: `/b/${businessId}/settings/taxes`, icon: Percent },
    { label: isAr ? 'الحسابات الافتراضية' : isTr ? 'Varsayılan Hesaplar' : 'Default Accounts', href: `/b/${businessId}/settings/accounting`, icon: BookOpen },
    { label: isAr ? 'ترقيم المستندات' : isTr ? 'Numaralandırma' : 'Document Numbering', href: `/b/${businessId}/settings/numbering`, icon: Hash },
    { label: isAr ? 'قوالب الطباعة' : isTr ? 'Belge Şablonları' : 'Document Templates', href: `/b/${businessId}/settings/templates`, icon: FileText },
    { label: isAr ? 'اللغة والتعريب' : isTr ? 'Yerelleştirme' : 'Localization & Language', href: `/b/${businessId}/settings/localization`, icon: Globe },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.5rem',
        marginBottom: '1.5rem',
        direction: isAr ? 'rtl' : 'ltr',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        const Icon = tab.icon

        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.875rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              color: isActive ? 'var(--color-brand-500, #4f46e5)' : 'var(--text-secondary, #64748b)',
              background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
              border: isActive ? '1px solid rgba(79, 70, 229, 0.2)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
