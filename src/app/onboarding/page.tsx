import { requireUser } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { redirect } from 'next/navigation'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const user = await requireUser()

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: { equals: user.email ?? '', mode: 'insensitive' } },
      ],
    },
  })

  // Check if user already has an active business membership
  const firstMembership = await prisma.businessUser.findFirst({
    where: {
      userId: dbUser?.id ?? user.id,
      status: 'active',
    },
    include: { business: true },
    orderBy: { createdAt: 'asc' },
  })

  // If user already has a business, redirect to dashboard
  if (firstMembership) {
    redirect(`/b/${firstMembership.businessId}/dashboard`)
  }

  // If super admin with no business, redirect to super admin panel
  if (dbUser?.isSuperAdmin) {
    redirect('/admin/super-admins')
  }

  return <OnboardingClient userEmail={user.email ?? ''} />
}
