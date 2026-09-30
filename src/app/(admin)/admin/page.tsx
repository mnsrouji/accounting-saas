// =============================================================
// Platform Admin Dashboard — Overview & Real-time KPIs
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { PlatformDashboardService } from '@/lib/services/platform-dashboard-service'
import {
  Building,
  Users,
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PlatformAdminDashboardPage() {
  const kpis = await PlatformDashboardService.getPlatformOverview()

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
            Platform Overview
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Real-time multi-tenant operations, MRR metrics, and system status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link
            href="/admin/tenants"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Building size={16} /> Manage Tenants
          </Link>
          <Link
            href="/admin/health"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f8fafc',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Activity size={16} /> System Health
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Total Businesses */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8125rem' }}>
            <span>Total Businesses</span>
            <Building size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.5rem' }}>
            {kpis.totalBusinesses}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.375rem' }}>
            {kpis.activeBusinesses} active · {kpis.trialBusinesses} trialing
          </div>
        </div>

        {/* Total Platform Users */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8125rem' }}>
            <span>Total Users</span>
            <Users size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.5rem' }}>
            {kpis.totalUsers}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.375rem' }}>
            {kpis.activeUsers} active accounts
          </div>
        </div>

        {/* Estimated MRR */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8125rem' }}>
            <span>Estimated MRR</span>
            <DollarSign size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.5rem' }}>
            ${kpis.estimatedMrr.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.375rem' }}>
            Monthly Recurring Revenue
          </div>
        </div>

        {/* Suspended Tenants */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8125rem' }}>
            <span>Suspended / Closed</span>
            <AlertTriangle size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.5rem' }}>
            {kpis.suspendedBusinesses + kpis.closedBusinesses}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.375rem' }}>
            {kpis.suspendedBusinesses} suspended · {kpis.closedBusinesses} closed
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Subscription Plan Distribution */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Subscription Tier Distribution
            </h3>
            <Link href="/admin/plans" style={{ color: '#818cf8', fontSize: '0.8125rem', textDecoration: 'none' }}>
              View Plans →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {kpis.planDistribution.map((plan) => (
              <div key={plan.code}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{plan.planName}</span>
                  <span style={{ color: '#94a3b8' }}>
                    {plan.count} tenants ({plan.percentage}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${plan.percentage}%`,
                      height: '100%',
                      background: plan.code === 'enterprise' ? '#8b5cf6' : plan.code === 'professional' ? '#38bdf8' : '#34d399',
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health Status */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Platform Health & Reliability
            </h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '0.25rem 0.5rem', borderRadius: 6 }}>
              <CheckCircle size={12} /> Systems Normal
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: '0.8125rem' }}>
              <span style={{ color: '#94a3b8' }}>Database Engine</span>
              <span style={{ color: '#34d399', fontWeight: 600 }}>PostgreSQL (Connected)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: '0.8125rem' }}>
              <span style={{ color: '#94a3b8' }}>Connection Pool</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>PgBouncer / Transaction Mode</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: '0.8125rem' }}>
              <span style={{ color: '#94a3b8' }}>Uptime</span>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>{Math.floor(kpis.systemHealth.uptimeSeconds / 60)} minutes</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: '0.8125rem' }}>
              <span style={{ color: '#94a3b8' }}>Tenant Isolation</span>
              <span style={{ color: '#818cf8', fontWeight: 600 }}>RLS & Scoped Contexts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Business Registrations */}
      <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Recent Tenant Registrations
          </h3>
          <Link href="/admin/tenants" style={{ color: '#818cf8', fontSize: '0.8125rem', textDecoration: 'none' }}>
            View All Tenants →
          </Link>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem' }}>Business</th>
              <th style={{ padding: '0.75rem' }}>Owner</th>
              <th style={{ padding: '0.75rem' }}>Plan</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
              <th style={{ padding: '0.75rem' }}>Registered</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {kpis.recentRegistrations.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>
                  {b.name}
                </td>
                <td style={{ padding: '0.75rem', color: '#94a3b8' }}>
                  <div>{b.ownerName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.ownerEmail}</div>
                </td>
                <td style={{ padding: '0.75rem', color: '#38bdf8' }}>
                  {b.planName}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: b.status === 'active' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                      color: b.status === 'active' ? '#34d399' : '#f87171',
                    }}
                  >
                    {b.status}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', color: '#64748b' }}>
                  {new Date(b.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  <Link
                    href={`/admin/tenants?search=${encodeURIComponent(b.name)}`}
                    style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}
                  >
                    Inspect
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
