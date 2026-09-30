import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { CustomerListClient } from './CustomerListClient'

export const metadata: Metadata = {
  title: 'Customers | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function CustomersPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const customers = await prisma.customer.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
  })

  const formattedCustomers = customers.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    companyName: c.companyName,
    email: c.email,
    phone: c.phone,
    currency: c.currency,
    balance: Number(c.balance),
    isActive: c.isActive,
  }))

  return (
    <CustomerListClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      customers={formattedCustomers}
    />
  )
}
