import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SettingsService } from '@/lib/services/settings-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { TemplatesForm } from '@/components/settings/templates-form'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Document Templates | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function TemplatesSettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const settings = await SettingsService.getBusinessSettings(businessId)

  const t = {
    title: isAr ? 'قوالب المستندات والهوية التجارية' : isTr ? 'Belge Şablonları ve Marka Kimliği' : 'Document Templates & Branding',
    subtitle: isAr
      ? 'تهيئة مظهر وتصميم الفواتير، الألوان المميزة، بيانات الحسابات البنكية، والشروط والأحكام القياسية'
      : isTr
      ? 'Fatura görünümü, kurumsal renkler, banka hesap bilgileri ve standart ödeme koşullarını yapılandırın'
      : 'Configure invoice styling, accent colors, payment remittance details, and standard terms',
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

      <TemplatesForm businessId={businessId} initialData={settings.templates} />
    </div>
  )
}
