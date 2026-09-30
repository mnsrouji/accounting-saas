// =============================================================
// SaaS Support & Administration Tools
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise Operations
// =============================================================

import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import {
  Wrench,
  ShieldCheck,
  Building,
  RefreshCw,
  Search,
  AlertOctagon,
  FileText,
} from 'lucide-react'

export const metadata = {
  title: 'Support Tools — Platform Admin',
}

export default async function AdminSupportPage() {
  await requirePlatformAdmin()

  const tenants = await prisma.business.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      legalName: true,
      country: true,
      defaultCurrency: true,
      onboardingCompleted: true,
      createdAt: true,
    },
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Platform Support Operations
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Strictly audited tenant troubleshooting, diagnostic inspections, and support workflows
        </p>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <ShieldCheck size={20} color="#f59e0b" />
        <span style={{ fontSize: '0.875rem', color: '#fcd34d' }}>
          All diagnostic actions create immutable platform audit records. Tenant financial entries remain isolated.
        </span>
      </div>

      {/* Tenants Table */}
      <div
        style={{
          background: '#131b2e',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Recent Tenants</h2>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Showing up to 20 tenants</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Tenant Name</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Tenant ID</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Region / Currency</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Onboarding</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                  {tenant.name}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontFamily: 'monospace' }}>
                  {tenant.id}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                  {tenant.country} • {tenant.defaultCurrency}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {tenant.onboardingCompleted ? (
                    <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                      Completed
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                      In Progress
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
