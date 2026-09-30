import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SettingsService } from '@/lib/services/settings-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { CompanyProfileForm } from '@/components/settings/company-form'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Company Profile | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function CompanySettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const settings = await SettingsService.getBusinessSettings(businessId)

  const t = {
    title: isAr ? 'الملف التعريفي للمنشأة' : isTr ? 'Şirket Profili' : 'Company Profile',
    subtitle: isAr
      ? 'إعداد بيانات المنشأة، السجل التجاري، الأرقام الضريبية، ومعلومات الاتصال الرسمية'
      : isTr
      ? 'Kuruluş bilgileri, ticaret sicil, vergi kimlik numaraları ve resmi iletişim bilgilerini yapılandırın'
      : 'Configure organization information, registration, tax identifiers, and official contacts',
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

      <CompanyProfileForm businessId={businessId} initialData={settings.company} />
    </div>
  )
}
