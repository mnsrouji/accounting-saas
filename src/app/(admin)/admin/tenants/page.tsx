// =============================================================
// Platform Admin Tenants Page — Business/Tenant Operations
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { PlatformDashboardService } from '@/lib/services/platform-dashboard-service'
import TenantManagerClient from './TenantManagerClient'
import { Building, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlatformTenantsPage() {
  const { tenants } = await PlatformDashboardService.listTenants({ limit: 100 })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Building size={24} color="#38bdf8" />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              Tenant & Business Management
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Inspect, activate, suspend, and monitor all multi-tenant ERP organizations
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(56,189,248,0.1)', padding: '0.5rem 0.875rem', borderRadius: 8, border: '1px solid rgba(56,189,248,0.2)' }}>
          <ShieldCheck size={16} color="#38bdf8" />
          <span style={{ fontSize: '0.8125rem', color: '#38bdf8', fontWeight: 600 }}>
            {tenants.length} Registered Organizations
          </span>
        </div>
      </div>

      <TenantManagerClient initialTenants={tenants as any} />
    </div>
  )
}
