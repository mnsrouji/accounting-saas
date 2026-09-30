import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { PettyCashClient } from './PettyCashClient'

export const metadata: Metadata = {
  title: 'Petty Cash Management | Treasury | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function PettyCashPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const [pettyCashAccounts, cashCounts, glAccounts] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { businessId, isPettyCash: true },
      include: { account: true, custodian: true },
      orderBy: { name: 'asc' },
    }),
    prisma.pettyCashCount.findMany({
      where: { businessId },
      include: {
        cashAccount: true,
        denominations: true,
      },
      orderBy: { countDate: 'desc' },
      take: 50,
    }),
    prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <PettyCashClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      pettyCashAccounts={pettyCashAccounts.map((c) => ({
        id: c.id,
        name: c.name,
        currency: c.currencyCode,
        balance: Number(c.balance),
        custodianName: c.custodian?.fullName || null,
        targetFloat: c.targetFloat ? Number(c.targetFloat) : null,
        glAccountCode: c.account?.code || '',
        glAccountName: c.account?.name || '',
      }))}
      cashCounts={cashCounts.map((cc) => ({
        id: cc.id,
        countNumber: cc.countNumber,
        cashAccountId: cc.cashAccountId,
        cashAccountName: cc.cashAccount.name,
        currency: cc.cashAccount.currencyCode,
        countDate: cc.countDate.toISOString(),
        systemBalance: Number(cc.systemAmount),
        countedBalance: Number(cc.countedAmount),
        varianceAmount: Number(cc.varianceAmount),
        status: cc.status,
        notes: cc.notes,
        reviewedAt: cc.reviewedAt ? cc.reviewedAt.toISOString() : null,
        postedAt: cc.postedAt ? cc.postedAt.toISOString() : null,
        denominations: cc.denominations.map((d) => ({
          denomination: Number(d.denomination),
          count: d.quantity,
          amount: Number(d.totalAmount),
        })),
      }))}
      glAccounts={glAccounts.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        type: g.type,
      }))}
    />
  )
}
