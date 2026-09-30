// =============================================================
// Platform Admin Layout — SaaS Administration Portal
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import Link from 'next/link'
import {
  ShieldAlert,
  LayoutDashboard,
  Building,
  CreditCard,
  Activity,
  FileText,
  Layers,
  ArrowLeft,
  TrendingUp,
} from 'lucide-react'

export const metadata = {
  title: 'Platform Admin — AccountFlow SaaS',
  description: 'Multi-tenant ERP platform management and infrastructure control center',
}

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#090d16', color: '#f1f5f9' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          borderRight: '1px solid rgba(255,255,255,0.08)',
          background: '#0d1322',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 1rem',
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', padding: '0 0.5rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
            }}
          >
            <ShieldAlert size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
              Platform Admin
            </div>
            <div style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 600 }}>
              SaaS Control Center
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1 }}>
          <Link
            href="/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <LayoutDashboard size={18} color="#818cf8" />
            Platform Dashboard
          </Link>

          <Link
            href="/admin/tenants"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <Building size={18} color="#38bdf8" />
            Tenants & Businesses
          </Link>

          <Link
            href="/admin/plans"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <CreditCard size={18} color="#34d399" />
            Plans & Subscriptions
          </Link>

          <Link
            href="/admin/health"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <Activity size={18} color="#f43f5e" />
            System Health & API
          </Link>

          <Link
            href="/admin/audit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <FileText size={18} color="#fbbf24" />
            Platform Audit Trail
          </Link>

          <Link
            href="/admin/analytics"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <TrendingUp size={18} color="#22d3ee" />
            SaaS Analytics
          </Link>

          <Link
            href="/admin/support"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <ShieldAlert size={18} color="#f472b6" />
            Support Operations
          </Link>

          <Link
            href="/admin/recovery"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <Layers size={18} color="#4ade80" />
            Disaster Recovery
          </Link>

          <Link
            href="/admin/flags"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <Activity size={18} color="#fb7185" />
            Feature Flags
          </Link>

          <Link
            href="/admin/billing"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 8,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <Layers size={18} color="#a78bfa" />
            Billing Events
          </Link>
        </nav>

        {/* Back to App */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.875rem',
              borderRadius: 8,
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '0.8125rem',
            }}
          >
            <ArrowLeft size={16} />
            Back to ERP Workspace
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
