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

  // Get all businesses user has access to
  const memberships = await prisma.businessUser.findMany({
    where: {
      userId: user.id,
      status: 'active',
    },
    include: {
      business: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // If user has no businesses, redirect to onboarding
  if (memberships.length === 0) {
    redirect('/onboarding')
  }

  return (
    <AppShell>
      <Sidebar memberships={memberships} userId={user.id} />
      <div className="main-content">
        <Header user={user} memberships={memberships} />
        <main className="page-content">
          {children}
        </main>
      </div>
    </AppShell>
  )
}
