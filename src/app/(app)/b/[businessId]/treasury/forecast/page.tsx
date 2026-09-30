import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { CashFlowForecastService, ForecastItem } from '@/lib/services/cash-flow-forecast-service'
import { CashForecastClient } from './CashForecastClient'

export const metadata: Metadata = {
  title: 'Cash Flow Forecast | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ horizonDays?: string; currency?: string }>
}

export default async function CashForecastPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const { horizonDays, currency } = await searchParams
  const { business } = await requireBusinessAccess(businessId)

  const selectedDays = parseInt(horizonDays || '30')
  const selectedCurrency = currency || business.defaultCurrency

  const forecastData = await CashFlowForecastService.getForecast({
    businessId,
    horizonDays: selectedDays,
    currency: selectedCurrency,
  })

  return (
    <CashForecastClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      selectedCurrency={selectedCurrency}
      horizonDays={selectedDays}
      data={{
        currentLiquidity: forecastData.startingLiquidity,
        projectedInflows: forecastData.totalProjectedInflow,
        projectedOutflows: forecastData.totalProjectedOutflow,
        netProjectedMovement: forecastData.netCashFlow,
        projectedClosingLiquidity: forecastData.projectedEndingLiquidity,
        inflowItems: forecastData.inflowItems.map((item: ForecastItem) => ({
          id: item.id,
          type: (item.sourceType.includes('promise') ? 'promise' : 'receivable') as any,
          sourceDocument: item.reference || item.id,
          entityName: item.partyName,
          expectedDate: item.date.toISOString(),
          amount: item.amount,
          currency: item.currencyCode,
          confidence: item.confidence === 'high' ? 95 : item.confidence === 'medium' ? 75 : 50,
          status: item.status,
        })),
        outflowItems: forecastData.outflowItems.map((item: ForecastItem) => ({
          id: item.id,
          type: (item.sourceType.includes('order') ? 'purchase_order' : 'payable') as any,
          sourceDocument: item.reference || item.id,
          entityName: item.partyName,
          expectedDate: item.date.toISOString(),
          amount: item.amount,
          currency: item.currencyCode,
          confidence: item.confidence === 'high' ? 95 : item.confidence === 'medium' ? 75 : 50,
          status: item.status,
        })),
      }}
    />
  )
}
