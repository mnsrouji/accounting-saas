import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { JournalEntriesClient } from './JournalEntriesClient'

export const metadata: Metadata = {
  title: 'Journal Entries | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function JournalEntriesPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [entries, accounts, currencies, exchangeRates] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { businessId },
      include: {
        lines: {
          include: { account: true },
          orderBy: { lineOrder: 'asc' },
        },
      },
      orderBy: { entryDate: 'desc' },
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.exchangeRate.findMany({
      where: { businessId },
      orderBy: { rateDate: 'desc' },
      take: 100,
    }),
  ])

  const formattedEntries = entries.map((e) => ({
    id: e.id,
    entryNumber: e.entryNumber,
    entryDate: e.entryDate.toISOString(),
    description: e.description || undefined,
    sourceType: e.sourceType,
    sourceId: e.sourceId || undefined,
    reversedEntryId: e.reversedEntryId || undefined,
    status: e.status,
    currencyCode: e.currencyCode,
    exchangeRate: Number(e.exchangeRate) || 1,
    lines: e.lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      accountCode: l.account?.code || '',
      accountName: l.account?.name || '',
      description: l.description || undefined,
      currencyCode: l.currencyCode || e.currencyCode,
      exchangeRate: Number(l.exchangeRate) || Number(e.exchangeRate) || 1,
      debitAmount: Number(l.debitAmount),
      creditAmount: Number(l.creditAmount),
      baseDebit: Number(l.baseDebit) || Number(l.debitAmount) * (Number(l.exchangeRate) || 1),
      baseCredit: Number(l.baseCredit) || Number(l.creditAmount) * (Number(l.exchangeRate) || 1),
    })),
  }))

  return (
    <JournalEntriesClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      entries={formattedEntries}
      accounts={accounts}
      currencies={currencies.map((c) => ({ code: c.code, name: c.name, symbol: c.symbol }))}
      exchangeRates={exchangeRates.map((r) => ({
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: Number(r.rate),
      }))}
    />
  )
}
