import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'

export default async function DashboardPage() {
  const user = await requireUser()

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: { equals: user.email ?? '', mode: 'insensitive' } },
      ],
    },
  })

  // Find first active business
  const firstMembership = await prisma.businessUser.findFirst({
    where: { userId: dbUser?.id ?? user.id, status: 'active' },
    include: { business: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!firstMembership) {
    if (dbUser?.isSuperAdmin) {
      redirect('/admin/super-admins')
    }
    redirect('/onboarding')
  }

  redirect(`/b/${firstMembership.businessId}/dashboard`)
}
