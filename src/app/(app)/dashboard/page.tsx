import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'

export default async function DashboardPage() {
  const user = await requireUser()

  // Find first active business
  const firstMembership = await prisma.businessUser.findFirst({
    where: { userId: user.id, status: 'active' },
    include: { business: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!firstMembership) {
    redirect('/onboarding')
  }

  redirect(`/b/${firstMembership.businessId}/dashboard`)
}
