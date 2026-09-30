import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SettingsService } from '@/lib/services/settings-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { LocalizationForm } from '@/components/settings/localization-form'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Localization | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function LocalizationSettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const settings = await SettingsService.getBusinessSettings(businessId)

  const t = {
    title: isAr ? 'التفضيلات الإقليمية واللغة والاتجاه' : isTr ? 'Bölgesel Tercihler ve Dil Ayarları' : 'Regional & Localization Preferences',
    subtitle: isAr
      ? 'تهيئة لغة واجهة النظام المفضلة (العربية، التركية، الإنجليزية)، اتجاه العرض (RTL/LTR)، والمنطقة الزمنية'
      : isTr
      ? 'Tercih edilen arayüz dilini (Türkçe, Arapça, İngilizce), metin yönünü (RTL/LTR) ve bölgesel formatları yapılandırın'
      : 'Configure preferred UI language (English, Arabic, Turkish), RTL direction, and regional formatting',
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

      <LocalizationForm businessId={businessId} initialData={settings.localization} />
    </div>
  )
}
