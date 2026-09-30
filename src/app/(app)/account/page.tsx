import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import Link from 'next/link'
import { User, Lock, Globe, Bell, Shield, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Account Settings | AccountFlow',
}

export default async function AccountSettingsPage() {
  const user = await requireUser()

  const userName =
    (user.user_metadata?.full_name as string) ??
    user.email?.split('@')[0] ??
    'User'

  return (
    <div className="animate-fade-in" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/profile" className="btn-back" title="Back to Profile">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">Account Settings</h1>
            <p className="page-subtitle">Configure your personal preferences and login credentials</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Personal Details */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} style={{ color: 'var(--color-brand-600)' }} />
              <span className="card-title">Personal Information</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label required">Display Name</label>
                <input
                  type="text"
                  className="form-control"
                  defaultValue={userName}
                  readOnly
                />
              </div>

              <div>
                <label className="form-label required">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  defaultValue={user.email || ''}
                  disabled
                />
                <span className="form-hint">Email is linked to your authentication provider.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Password */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={16} style={{ color: 'var(--color-brand-600)' }} />
              <span className="card-title">Security & Password</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Manage your login password and two-factor authentication.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Password Management</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Secure password credentials managed by Supabase Auth</div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled>
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={16} style={{ color: 'var(--color-brand-600)' }} />
              <span className="card-title">Regional & Display Preferences</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Language / اللغة</label>
              <select className="form-control" defaultValue="en">
                <option value="en">English (US)</option>
                <option value="ar">العربية (Arabic)</option>
              </select>
            </div>

            <div>
              <label className="form-label">Timezone</label>
              <select className="form-control" defaultValue="UTC">
                <option value="UTC">UTC (Universal Time)</option>
                <option value="Asia/Riyadh">Asia / Riyadh (GMT+3)</option>
                <option value="Asia/Dubai">Asia / Dubai (GMT+4)</option>
                <option value="Europe/London">Europe / London (GMT+0)</option>
                <option value="America/New_York">America / New York (GMT-5)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
