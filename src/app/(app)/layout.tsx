import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { AppShell } from '@/components/layout/AppShell'

interface AppLayoutProps {
  children: React.ReactNode
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireUser()

  // Find DB user by ID or Email
  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: { equals: user.email ?? '', mode: 'insensitive' } },
      ],
    },
  })

  // Get all businesses user has access to
  const memberships = await prisma.businessUser.findMany({
    where: {
      userId: dbUser?.id ?? user.id,
      status: 'active',
    },
    include: {
      business: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // If user has no businesses, check if super admin before redirecting to onboarding
  if (memberships.length === 0) {
    if (dbUser?.isSuperAdmin) {
      redirect('/admin/super-admins')
    }
    redirect('/onboarding')
  }

  return (
    <AppShell>
      <Sidebar memberships={memberships} userId={dbUser?.id ?? user.id} />
      <div className="main-content">
        <Header user={user} memberships={memberships} />
        <main className="page-content">
          {children}
        </main>
      </div>
    </AppShell>
  )
}
