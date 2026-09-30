import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { TreasuryDashboardService } from '@/lib/services/treasury-dashboard-service'
import { prisma } from '@/lib/db/prisma'
import { TreasuryDashboardClient } from './TreasuryDashboardClient'

export const metadata: Metadata = {
  title: 'Treasury & Cash Management | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ currency?: string }>
}

export default async function TreasuryPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const { currency } = await searchParams
  const { business } = await requireBusinessAccess(businessId)

  const selectedCurrency = currency || business.defaultCurrency

  // Fetch live dashboard metrics from database service
  const dashboardMetrics = await TreasuryDashboardService.getDashboardMetrics(businessId)

  // Fetch cash accounts & bank accounts with live posted GL journal lines
  const [cashAccounts, bankAccounts] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { businessId, isActive: true },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
      },
      orderBy: { accountName: 'asc' },
    }),
  ])

  return (
    <TreasuryDashboardClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      selectedCurrency={selectedCurrency}
      data={{
        totalCash: dashboardMetrics.totalCashOnHand,
        totalBankBalance: dashboardMetrics.totalBankBalances,
        pettyCashTotal: dashboardMetrics.totalPettyCash,
        availableLiquidity: dashboardMetrics.totalAvailableLiquidity,
        restrictedFunds: 0,
        unreconciledTransactionsCount: dashboardMetrics.unreconciledBankTransactionsCount,
        upcoming30DayInflows: dashboardMetrics.upcomingInflows30Days,
        upcoming30DayOutflows: dashboardMetrics.upcomingOutflows30Days,
        projectedNetCashChange: dashboardMetrics.netProjectedCashMovement30Days,
        accountsRequiringAttention: dashboardMetrics.accountsRequiringAttention,
      }}
      cashAccounts={cashAccounts.map((c) => {
        const liveBalance = c.account?.journalLines && c.account.journalLines.length > 0
          ? c.account.journalLines.reduce((acc, l) => acc + Number(l.debitAmount) - Number(l.creditAmount), 0)
          : Number(c.balance)

        return {
          id: c.id,
          name: c.name,
          currency: c.currencyCode,
          balance: liveBalance,
          isPettyCash: c.isPettyCash,
          glAccountCode: c.account?.code || '',
          glAccountName: c.account?.name || '',
        }
      })}
      bankAccounts={bankAccounts.map((b) => {
        const liveBalance = b.account?.journalLines && b.account.journalLines.length > 0
          ? b.account.journalLines.reduce((acc, l) => acc + Number(l.debitAmount) - Number(l.creditAmount), 0)
          : Number(b.balance)

        return {
          id: b.id,
          name: b.accountName,
          bankName: b.bankName,
          accountNumber: b.accountNumber || '',
          currency: b.currencyCode,
          balance: liveBalance,
          glAccountCode: b.account?.code || '',
          glAccountName: b.account?.name || '',
        }
      })}
    />
  )
}
