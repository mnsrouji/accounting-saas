import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { TaxService } from '@/lib/services/tax-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { TaxesForm } from '@/components/settings/taxes-form'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Tax Configuration | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function TaxesSettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const taxes = await TaxService.getTaxes(businessId, true)
  const accounts = await prisma.chartOfAccount.findMany({
    where: { businessId, isActive: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: 'asc' },
  })

  const t = {
    title: isAr ? 'إعدادات الضرائب وضريبة القيمة المضافة' : isTr ? 'Vergi Yapılandırması ve KDV Oranları' : 'Tax Configuration',
    subtitle: isAr
      ? 'تهيئة معدلات ضريبة القيمة المضافة، ضرائب المبيعات والمشتريات، وربطها بحسابات الدليل المحاسبي'
      : isTr
      ? 'KDV, satış ve alış vergi oranlarını yapılandırın ve Genel Muhasebe hesaplarıyla eşleştirin'
      : 'Configure VAT, sales tax, purchase tax rates, and associate with General Ledger accounts',
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

      <TaxesForm
        businessId={businessId}
        initialTaxes={taxes.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          rate: Number(t.rate),
          taxType: t.taxType,
          salesAccountId: t.salesAccountId,
          purchaseAccountId: t.purchaseAccountId,
          isDefault: t.isDefault,
          isActive: t.isActive,
          salesAccount: t.salesAccount,
          purchaseAccount: t.purchaseAccount,
        }))}
        accounts={accounts}
      />
    </div>
  )
}
