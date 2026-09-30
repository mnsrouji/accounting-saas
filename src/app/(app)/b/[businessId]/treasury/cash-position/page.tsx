import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { CashPositionService } from '@/lib/services/cash-position-service'
import { CashPositionClient } from './CashPositionClient'

export const metadata: Metadata = {
  title: 'Cash Position & Liquidity | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function CashPositionPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const summary = await CashPositionService.getCashPosition({ businessId })

  const formattedPositions = Object.values(summary.positionsByCurrency).map((pos) => ({
    currency: pos.currencyCode,
    totalCash: pos.cashOnHand,
    totalBank: pos.bankBalances,
    pettyCash: pos.pettyCash,
    restrictedFunds: 0,
    availableLiquidity: pos.totalLiquidFunds,
    totalLiquidFunds: pos.totalLiquidFunds,
    accounts: pos.accountBreakdown.map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: (acc.type === 'bank' ? 'bank' : 'cash') as 'cash' | 'bank',
      currency: acc.currencyCode,
      balance: acc.balance,
      availableBalance: acc.balance,
      restrictedAmount: 0,
      glAccountCode: acc.glAccountCode || '—',
      glAccountName: acc.glAccountName || '',
      accountNumber: acc.accountNumber,
      isPettyCash: acc.type === 'petty_cash',
    })),
  }))

  return (
    <CashPositionClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      data={{
        positions: formattedPositions,
        asOfDate: summary.asOfDate.toISOString(),
      }}
    />
  )
}
