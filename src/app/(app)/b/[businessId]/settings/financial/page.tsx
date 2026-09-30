import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SettingsService } from '@/lib/services/settings-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { FinancialSettingsForm } from '@/components/settings/financial-form'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Financial Settings | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function FinancialSettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const settings = await SettingsService.getBusinessSettings(businessId)

  const t = {
    title: isAr ? 'الإعدادات المالية والسنة المالية' : isTr ? 'Mali ve Hesap Dönemi Yapılandırması' : 'Financial & Fiscal Configuration',
    subtitle: isAr
      ? 'تهيئة العملة الأساسية، تواريخ بداية السنة المالية، دقة الفواصل العشرية، وقواعد التنسيق'
      : isTr
      ? 'Temel para birimi, mali yıl başlangıcı, kuruş hassasiyeti ve biçimlendirme kurallarını yapılandırın'
      : 'Configure base currency, fiscal year dates, decimal precision, and formatting rules',
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

      <FinancialSettingsForm businessId={businessId} initialData={settings.financial} />
    </div>
  )
}
