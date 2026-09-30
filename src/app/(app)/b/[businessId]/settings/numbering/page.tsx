import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SettingsService } from '@/lib/services/settings-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { NumberingForm } from '@/components/settings/numbering-form'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Document Numbering | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function NumberingSettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const settings = await SettingsService.getBusinessSettings(businessId)

  const t = {
    title: isAr ? 'ترقيم وتسلسل المستندات' : isTr ? 'Belge Numaralandırma ve Seri Ayarları' : 'Document Numbering & Sequences',
    subtitle: isAr
      ? 'تهيئة البادئات، عدد الخانات، تضمين السنة، وأنماط الترقيم التلقائي للفواتير والسندات الصادرة'
      : isTr
      ? 'Gelecekte oluşturulacak belgeler için önekleri, basamak sayısını, yıl ekini ve biçimlendirme kurallarını yapılandırın'
      : 'Configure prefixes, sequence padding, year inclusion, and formatting for future generated documents',
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

      <NumberingForm businessId={businessId} initialNumbering={settings.numbering} />
    </div>
  )
}
