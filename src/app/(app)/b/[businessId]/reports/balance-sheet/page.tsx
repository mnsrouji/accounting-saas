import type { Metadata } from 'next'
import { requireBusinessAccess, requireUser } from '@/lib/auth/require-auth'
import { ReportingService } from '@/lib/services/reporting-service'
import { BalanceSheetReportClient } from './BalanceSheetReportClient'

export const metadata: Metadata = {
  title: 'Balance Sheet (Statement of Financial Position) | AccountFlow',
  description: 'Balance Sheet — Assets, Liabilities and Equity with analytical KPIs and composition chart',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ asOfDate?: string }>
}

export default async function BalanceSheetPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sp = (await searchParams) || {}
  const [{ business }, user] = await Promise.all([
    requireBusinessAccess(businessId),
    requireUser(),
  ])

  const asOfDate = sp.asOfDate ? new Date(sp.asOfDate) : new Date()

  // Previous year date for period-over-period comparative analysis
  const prevPeriodDate = new Date(asOfDate.getFullYear() - 1, asOfDate.getMonth(), asOfDate.getDate())
  const ytdFrom = new Date(asOfDate.getFullYear(), 0, 1)

  const [bs, prevBs, plYTD] = await Promise.all([
    ReportingService.getBalanceSheet(businessId, asOfDate),
    ReportingService.getBalanceSheet(businessId, prevPeriodDate).catch(() => null),
    ReportingService.getProfitAndLoss(businessId, ytdFrom, asOfDate).catch(() => null),
  ])

  return (
    <BalanceSheetReportClient
      businessId={businessId}
      businessName={business.name}
      businessCode={business.id.slice(0, 8).toUpperCase()}
      data={bs}
      prevData={prevBs}
      netProfitYTD={plYTD?.netProfit || 0}
      userName={user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Admin User'}
    />
  )
}
