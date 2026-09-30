import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { TreasuryReportingService } from '@/lib/services/treasury-reporting-service'
import { prisma } from '@/lib/db/prisma'
import { TreasuryReportsClient } from './TreasuryReportsClient'

export const metadata: Metadata = {
  title: 'Treasury Reports | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ reportType?: string; startDate?: string; endDate?: string; accountId?: string; currency?: string }>
}

export default async function TreasuryReportsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const { reportType, startDate, endDate, accountId, currency } = await searchParams
  const { business } = await requireBusinessAccess(businessId)

  const activeReportType = reportType || 'cash_position'
  const selectedCurrency = currency || business.defaultCurrency

  const sDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const eDate = endDate ? new Date(endDate) : new Date()

  // Fetch accounts for report filters
  const [cashAccounts, bankAccounts] = await Promise.all([
    prisma.cashAccount.findMany({ where: { businessId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.bankAccount.findMany({ where: { businessId, isActive: true }, orderBy: { accountName: 'asc' } }),
  ])

  // Fetch initial report data using the actual TreasuryReportingService methods
  let reportData: any = null
  try {
    if (activeReportType === 'cash_position') {
      reportData = await TreasuryReportingService.getCashPositionReport(businessId)
    } else if (activeReportType === 'bank_balance') {
      reportData = await TreasuryReportingService.getBankBalanceReport(businessId)
    } else if (activeReportType === 'cash_movement') {
      reportData = await TreasuryReportingService.getCashMovementReport(businessId, sDate, eDate)
    } else if (activeReportType === 'bank_reconciliation') {
      reportData = await TreasuryReportingService.getBankReconciliationReport(
        businessId,
        accountId || bankAccounts[0]?.id
      )
    } else if (activeReportType === 'unmatched_transactions') {
      reportData = await TreasuryReportingService.getUnmatchedTransactionsReport(
        businessId,
        accountId || bankAccounts[0]?.id
      )
    } else if (activeReportType === 'petty_cash') {
      reportData = await TreasuryReportingService.getPettyCashReport(
        businessId,
        accountId || cashAccounts.find((c) => c.isPettyCash)?.id
      )
    } else if (activeReportType === 'bank_fees') {
      reportData = await TreasuryReportingService.getBankFeesReport(businessId, sDate, eDate)
    }
  } catch (err) {
    console.error('Report fetch error:', err)
  }

  return (
    <TreasuryReportsClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      activeReportType={activeReportType}
      reportData={reportData}
      cashAccounts={cashAccounts.map((c) => ({ id: c.id, name: c.name, currency: c.currencyCode }))}
      bankAccounts={bankAccounts.map((b) => ({ id: b.id, name: b.accountName, bankName: b.bankName, currency: b.currencyCode }))}
    />
  )
}
