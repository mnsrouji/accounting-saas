import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { SupplierListClient } from './SupplierListClient'

export const metadata: Metadata = {
  title: 'Suppliers | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function SuppliersPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const suppliers = await prisma.supplier.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
  })

  const formattedSuppliers = suppliers.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    companyName: s.companyName,
    email: s.email,
    phone: s.phone,
    currency: s.currency,
    balance: Number(s.balance),
    isActive: s.isActive,
  }))

  return (
    <SupplierListClient
      businessId={businessId}
      defaultCurrency={business.defaultCurrency}
      suppliers={formattedSuppliers}
    />
  )
}
