import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SettingsService } from '@/lib/services/settings-service'
import { CurrencyService } from '@/lib/services/currency-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { CurrenciesForm } from '@/components/settings/currencies-form'
import { CurrencyRevaluationModal } from '@/components/accounting/CurrencyRevaluationModal'
import { getLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Currencies & Rates | Settings | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function CurrenciesSettingsPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const settings = await SettingsService.getBusinessSettings(businessId)
  const currencies = await CurrencyService.getCurrencies()
  const exchangeRates = await CurrencyService.getExchangeRates(businessId)

  const t = {
    title: isAr ? 'العملات وأسعار الصرف الأجنبية' : isTr ? 'Para Birimleri ve Döviz Kurları' : 'Currencies & Exchange Rates',
    subtitle: isAr
      ? 'إدارة العملات المدعومة في النظام، التحويل للعملة الأساسية، وأسعار الصرف التاريخية والتشغيلية'
      : isTr
      ? 'Desteklenen işlem para birimlerini, temel para birimine dönüşümü ve döviz kurlarını yönetin'
      : 'Manage supported transaction currencies, base currency conversion, and foreign exchange rates',
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <div>
          <CurrencyRevaluationModal businessId={businessId} />
        </div>
      </div>

      <SettingsNav businessId={businessId} />

      <CurrenciesForm
        businessId={businessId}
        baseCurrency={settings.financial.baseCurrency}
        currencies={currencies}
        exchangeRates={exchangeRates.map((r) => ({
          id: r.id,
          fromCurrency: r.fromCurrency,
          toCurrency: r.toCurrency,
          rate: Number(r.rate),
          rateDate: r.rateDate.toISOString(),
          source: r.source,
        }))}
      />
    </div>
  )
}
