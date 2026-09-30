import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import { BookOpen, ScrollText, Scale, Landmark, Database, ArrowRight } from 'lucide-react'
import { AccountingHealthModal } from '@/components/accounting/AccountingHealthModal'
import { CurrencyRevaluationModal } from '@/components/accounting/CurrencyRevaluationModal'

export const metadata: Metadata = {
  title: 'Accounting Hub | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function AccountingHubPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  await requireBusinessAccess(businessId)

  const t = {
    title:
      locale === 'ar' ? 'المحاسبة العامة والأستاذ' : locale === 'tr' ? 'Genel Muhasebe ve Defterler' : 'Accounting & General Ledger',
    subtitle:
      locale === 'ar'
        ? 'نظام القيد المزدوج، شجرة الحسابات، القيود اليومية، وميزان المراجعة والأستاذ العام'
        : locale === 'tr'
        ? 'Çift taraflı kayıt sistemi, Tekdüzen Hesap Planı, Yevmiye Fişleri ve Mizan'
        : 'Double-entry accounting, Chart of Accounts, Journal Entries & Trial Balance',
    openModule:
      locale === 'ar' ? 'فتح الوحدة' : locale === 'tr' ? 'Modüle Git' : 'Open Module',
    coa: {
      title: locale === 'ar' ? 'دليل وشجرة الحسابات' : locale === 'tr' ? 'Hesap Planı' : 'Chart of Accounts',
      desc:
        locale === 'ar'
          ? 'إدارة الحسابات الرئيسية والفرعية، تصنيفات الأصول، الخصوم، حقوق الملكية، الإيرادات والمصروفات.'
          : locale === 'tr'
          ? 'Ana ve alt hesap yönetimi; dönen/duran varlıklar, kaynaklar, gelir ve gider yapısı.'
          : 'Manage master ledger accounts, parent headers, asset/liability/equity/revenue/expense structure.',
    },
    journals: {
      title: locale === 'ar' ? 'قيود اليومية العامة' : locale === 'tr' ? 'Yevmiye Fişleri' : 'Journal Entries',
      desc:
        locale === 'ar'
          ? 'إنشاء، ترحيل، تعديل، وحذف القيود المحاسبية المزدوجة اليدوية والآلية مع المرفقات.'
          : locale === 'tr'
          ? 'Manuel veya otomatik çift taraflı yevmiye maddelerini görüntüleyin, düzenleyin ve onaylayın.'
          : 'View, post, edit & delete double-entry manual or automated accounting journal transactions.',
    },
    gl: {
      title: locale === 'ar' ? 'دفتر الأستاذ العام' : locale === 'tr' ? 'Büyük Defter (Kebir)' : 'General Ledger',
      desc:
        locale === 'ar'
          ? 'استعراض كشوفات الحسابات وحركات المدين والدائن والأرصدة المتراكمة لحظياً.'
          : locale === 'tr'
          ? 'Hesap bazında borç/alacak hareketlerini ve anlık yürüyen bakiyeleri detaylı inceleyin.'
          : 'Query detailed account ledgers with chronologically updated running balances.',
    },
    tb: {
      title: locale === 'ar' ? 'ميزان المراجعة' : locale === 'tr' ? 'Mizan Raporu' : 'Trial Balance',
      desc:
        locale === 'ar'
          ? 'التحقق من توازن الحسابات وصحة القيود المزدوجة بين إجمالي المدين والدائن.'
          : locale === 'tr'
          ? 'Tüm hesapların borç/alacak bakiye eşitliğini ve mizan denkliğini canlı olarak denetleyin.'
          : 'Verify double-entry balance integrity with live Debit vs Credit ledger reconciliation.',
    },
    backup: {
      title: locale === 'ar' ? 'النسخ الاحتياطي والبيانات' : locale === 'tr' ? 'Yedekleme ve Veri Yönetimi' : 'Backup & Data Management',
      desc:
        locale === 'ar'
          ? 'تصدير النسخ الاحتياطية بصيغة JSON، استعادة اللقطات السابقة، وإدارة البيانات بأمان.'
          : locale === 'tr'
          ? 'Tam JSON yedekleri indirin, sistem anlık görüntülerini geri yükleyin ve verileri güvenle yönetin.'
          : 'Export full JSON backups, restore snapshots, or safely manage system data.',
    },
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <CurrencyRevaluationModal businessId={businessId} />
          <AccountingHealthModal businessId={businessId} />
        </div>
      </div>

      <div className="dashboard-grid-2" style={{ marginBottom: '2rem' }}>
        <ModuleCard
          title={t.coa.title}
          description={t.coa.desc}
          href={`/b/${businessId}/accounting/chart-of-accounts`}
          icon={<BookOpen size={24} />}
          color="var(--color-brand-500)"
          actionLabel={t.openModule}
        />

        <ModuleCard
          title={t.journals.title}
          description={t.journals.desc}
          href={`/b/${businessId}/accounting/journal-entries`}
          icon={<ScrollText size={24} />}
          color="var(--color-info)"
          actionLabel={t.openModule}
        />

        <ModuleCard
          title={t.gl.title}
          description={t.gl.desc}
          href={`/b/${businessId}/accounting/general-ledger`}
          icon={<Landmark size={24} />}
          color="#8b5cf6"
          actionLabel={t.openModule}
        />

        <ModuleCard
          title={t.tb.title}
          description={t.tb.desc}
          href={`/b/${businessId}/accounting/trial-balance`}
          icon={<Scale size={24} />}
          color="var(--color-success)"
          actionLabel={t.openModule}
        />

        <ModuleCard
          title={t.backup.title}
          description={t.backup.desc}
          href={`/b/${businessId}/settings/backup`}
          icon={<Database size={24} />}
          color="#ec4899"
          actionLabel={t.openModule}
        />
      </div>
    </div>
  )
}

function ModuleCard({
  title,
  description,
  href,
  icon,
  color,
  actionLabel,
}: {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  color: string
  actionLabel: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div className="module-card">
        <div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            {icon}
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            {title}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color, marginTop: '1.5rem' }}>
          <span>{actionLabel}</span>
          <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  )
}
