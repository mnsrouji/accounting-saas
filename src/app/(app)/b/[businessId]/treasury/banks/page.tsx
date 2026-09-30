import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { BankAccountsClient } from './BankAccountsClient'

export const metadata: Metadata = {
  title: 'Bank Accounts | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function BankAccountsPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [bankAccounts, assetGlAccounts] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { businessId },
      include: {
        account: {
          include: {
            journalLines: {
              where: { businessId, journalEntry: { status: 'posted' } },
            },
          },
        },
        statements: { orderBy: { endDate: 'desc' }, take: 1 },
        reconciliations: { orderBy: { periodEnd: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true, type: 'asset' },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <BankAccountsClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      bankAccounts={bankAccounts.map((b) => {
        const liveBalance = b.account?.journalLines && b.account.journalLines.length > 0
          ? b.account.journalLines.reduce((acc, l) => acc + Number(l.debitAmount) - Number(l.creditAmount), 0)
          : Number(b.balance)

        return {
          id: b.id,
          name: b.accountName,
          bankName: b.bankName,
          accountNumber: b.accountNumber || '',
          iban: b.iban,
          swiftCode: b.swift,
          branch: b.branch,
          currency: b.currencyCode,
          balance: liveBalance,
          isActive: b.isActive,
          glAccount: {
            id: b.account?.id || '',
            code: b.account?.code || '—',
            name: b.account?.name || 'Unassigned GL',
          },
          lastStatementDate: b.statements[0]?.endDate ? b.statements[0].endDate.toISOString() : null,
          lastReconciliationStatus: b.reconciliations[0]?.status || null,
          createdAt: b.createdAt.toISOString(),
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
