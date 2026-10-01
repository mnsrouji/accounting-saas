// =============================================================
// Super Admins Management Page — Server Component
// =============================================================

import { requireSuperAdmin } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { redirect } from 'next/navigation'
import SuperAdminClient from './SuperAdminClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Super Admins — Platform Control',
  description: 'Manage Super Admin accounts with absolute platform-wide authority',
}

export default async function SuperAdminsPage() {
  // Only super admins can access this page
  let currentUser: Awaited<ReturnType<typeof requireSuperAdmin>>
  try {
    currentUser = await requireSuperAdmin()
  } catch {
    redirect('/admin')
  }

  // Fetch all current super admins
  const superAdmins = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      status: true,
      isSuperAdmin: true,
      superAdminNote: true,
      createdAt: true,
      _count: { select: { businessMemberships: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <SuperAdminClient
      superAdmins={superAdmins as any}
      currentUserId={currentUser.id}
    />
  )
}
