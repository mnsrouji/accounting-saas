import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { ChartOfAccountsClient, AccountItem } from './ChartOfAccountsClient'

export const metadata: Metadata = {
  title: 'Chart of Accounts | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function ChartOfAccountsPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const accounts = await prisma.chartOfAccount.findMany({
    where: { businessId },
    orderBy: { code: 'asc' },
  })

  const formattedAccounts: AccountItem[] = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type as AccountItem['type'],
    normalBalance: a.normalBalance as 'debit' | 'credit',
    parentId: a.parentId,
    currency: a.currency,
    description: a.description,
    isHeader: a.isHeader,
    isSystem: a.isSystem,
    isActive: a.isActive,
    sortOrder: a.sortOrder,
  }))

  return (
    <ChartOfAccountsClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      accounts={formattedAccounts}
    />
  )
}

