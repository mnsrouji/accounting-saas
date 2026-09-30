import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { SettingsService } from '@/lib/services/settings-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { AccountingDefaultsForm } from '@/components/settings/accounting-defaults-form'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Default Accounts | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function AccountingDefaultsSettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const settings = await SettingsService.getBusinessSettings(businessId)
  const accounts = await prisma.chartOfAccount.findMany({
    where: { businessId, isActive: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: 'asc' },
  })

  const t = {
    title: isAr ? 'ربط الحسابات الافتراضية' : isTr ? 'Varsayılan Muhasebe Hesapları' : 'Default Accounts Mapping',
    subtitle: isAr
      ? 'تهيئة الحسابات الدفترية القياسية للقيود التلقائية لعمليات المبيعات، المشتريات، المدفوعات، وحركات المخزون'
      : isTr
      ? 'Otomatik satış, alış, ödeme ve stok hareketleri için standart genel muhasebe hesaplarını yapılandırın'
      : 'Configure standard accounts for automated sales, purchases, payments, and inventory transactions',
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </div>

      <SettingsNav businessId={businessId} />

      <AccountingDefaultsForm
        businessId={businessId}
        initialData={settings.accountingDefaults}
        accounts={accounts}
      />
    </div>
  )
}
