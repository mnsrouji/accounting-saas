import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { TreasuryTransfersClient } from './TreasuryTransfersClient'

export const metadata: Metadata = {
  title: 'Internal Transfers | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function TreasuryTransfersPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [transfers, cashAccounts, bankAccounts] = await Promise.all([
    prisma.treasuryTransfer.findMany({
      where: { businessId },
      orderBy: { transferDate: 'desc' },
      take: 100,
    }),
    prisma.cashAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { accountName: 'asc' },
    }),
  ])

  // Map account names
  const accountMap = new Map<string, string>()
  cashAccounts.forEach((c) => accountMap.set(c.id, `${c.name} (${c.currencyCode})`))
  bankAccounts.forEach((b) => accountMap.set(b.id, `${b.accountName} - ${b.bankName} (${b.currencyCode})`))

  return (
    <TreasuryTransfersClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      transfers={transfers.map((tr) => ({
        id: tr.id,
        transferNumber: tr.transferNumber,
        sourceAccountType: tr.sourceAccountType,
        sourceAccountId: tr.sourceAccountId,
        sourceAccountName: accountMap.get(tr.sourceAccountId) || tr.sourceAccountType,
        destinationAccountType: tr.destinationAccountType,
        destinationAccountId: tr.destinationAccountId,
        destinationAccountName: accountMap.get(tr.destinationAccountId) || tr.destinationAccountType,
        amount: Number(tr.amount),
        currency: tr.currencyCode,
        destinationAmount: tr.destinationAmount ? Number(tr.destinationAmount) : null,
        destinationCurrency: tr.destinationCurrencyCode,
        exchangeRate: tr.exchangeRate ? Number(tr.exchangeRate) : null,
        status: tr.status,
        transferDate: tr.transferDate.toISOString(),
        reference: tr.reference,
        notes: tr.notes,
        postedAt: tr.postedAt ? tr.postedAt.toISOString() : null,
      }))}
      cashAccounts={cashAccounts.map((c) => ({ id: c.id, name: c.name, currency: c.currencyCode, balance: Number(c.balance) }))}
      bankAccounts={bankAccounts.map((b) => ({ id: b.id, name: b.accountName, bankName: b.bankName, currency: b.currencyCode, balance: Number(b.balance) }))}
    />
  )
}
