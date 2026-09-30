// =============================================================
// Platform SaaS Analytics — Platform Metrics Dashboard
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise Operations
// =============================================================

import { PlatformAnalyticsService } from '@/lib/services/platform-analytics-service'
import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import {
  TrendingUp,
  Users,
  Building,
  CreditCard,
  Layers,
  Activity,
  Calendar,
  DollarSign,
} from 'lucide-react'

export const metadata = {
  title: 'SaaS Analytics — Platform Admin',
}

export default async function AdminAnalyticsPage() {
  await requirePlatformAdmin()

  const [overview, planDist, cohortGrowth] = await Promise.all([
    PlatformAnalyticsService.getPlatformMetricsOverview(),
    PlatformAnalyticsService.getSubscriptionPlanDistribution(),
    PlatformAnalyticsService.getTenantCohortGrowth(),
  ])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
          SaaS Operational Analytics
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Real-time tenant distribution, estimated MRR, subscription health, and cohort growth trends
        </p>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            background: '#131b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Building size={20} color="#818cf8" />
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Total Tenants</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
            {overview.totalTenants.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: '#131b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <CreditCard size={20} color="#34d399" />
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Subscribed Tenants</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>
            {overview.subscribedTenants.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: '#131b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <DollarSign size={20} color="#fbbf24" />
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Estimated MRR</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24' }}>
            ${overview.estimatedMrr.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: '#131b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Users size={20} color="#38bdf8" />
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Active Users</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
            {overview.activeUsers.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Plan Distribution and Cohorts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Plan Distribution */}
        <div
          style={{
            background: '#131b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem' }}>
            Subscription Plan Distribution
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {planDist.map((item) => (
              <div key={item.planCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{item.planName}</span>
                  <span style={{ color: '#94a3b8' }}>
                    {item.count} tenants ({item.percentage}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #4f46e5, #818cf8)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cohort Growth */}
        <div
          style={{
            background: '#131b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem' }}>
            Tenant Growth (Last 6 Months)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cohortGrowth.map((cohort) => (
              <div
                key={cohort.month}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1' }}>
                  <Calendar size={16} color="#64748b" />
                  <span style={{ fontWeight: 500 }}>{cohort.month}</span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: '#38bdf8' }}>+{cohort.newTenants} new</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{cohort.cumulativeTenants} total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
