import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { CashAccountsClient } from './CashAccountsClient'

export const metadata: Metadata = {
  title: 'Cash Accounts | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function CashAccountsPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [cashAccounts, assetGlAccounts] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { businessId },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
        custodian: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true, type: 'asset' },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <CashAccountsClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
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
          custodianName: c.custodian?.fullName || null,
          targetFloat: c.targetFloat ? Number(c.targetFloat) : null,
          description: null,
          isActive: c.isActive,
          glAccount: {
            id: c.account?.id || '',
            code: c.account?.code || '—',
            name: c.account?.name || 'Unassigned GL',
          },
          createdAt: c.createdAt.toISOString(),
        }
      })}
      glAccounts={assetGlAccounts.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
      }))}
    />
  )
}
