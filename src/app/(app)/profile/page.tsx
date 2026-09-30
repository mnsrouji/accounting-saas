import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import Link from 'next/link'
import { User, Mail, Shield, Building2, Calendar, CheckCircle2, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'My Profile | AccountFlow',
}

export default async function ProfilePage() {
  const user = await requireUser()

  const memberships = await prisma.businessUser.findMany({
    where: { userId: user.id, status: 'active' },
    include: { business: true },
    orderBy: { createdAt: 'asc' },
  })

  const userName =
    (user.user_metadata?.full_name as string) ??
    user.email?.split('@')[0] ??
    'User'

  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const defaultBusiness = memberships[0]?.business

  return (
    <div className="animate-fade-in" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">User Profile</h1>
          <p className="page-subtitle">Manage your personal account credentials and organization access</p>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="card" style={{ marginBottom: '1.75rem', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-brand-500) 0%, var(--color-brand-700) 100%)',
              color: '#ffffff',
              fontSize: '1.75rem',
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
            }}
          >
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0f172a' }}>{userName}</h2>
              <span className="badge badge-success">Active Account</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              <Mail size={14} />
              <span>{user.email}</span>
            </div>
          </div>

          <Link href="/account" className="btn btn-secondary">
            Edit Account
          </Link>
        </div>
      </div>

      {/* Grid: Account Details & Organizations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Account Details */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Security & Account Details</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>User ID</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', background: '#f8fafc', padding: '0.375rem 0.625rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                {user.id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Email Verification</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-success)', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                <span>Verified ({user.email})</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Authentication Provider</div>
              <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                {user.app_metadata?.provider || 'Email / Password'}
              </div>
            </div>
          </div>
        </div>

        {/* Organizations & Businesses Access */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Associated Organizations ({memberships.length})</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {memberships.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--color-brand-50)', color: 'var(--color-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{m.business.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Role: <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--color-brand-600)' }}>{m.role}</span> · Currency: {m.business.defaultCurrency}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/b/${m.businessId}/dashboard`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <span>Open</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
