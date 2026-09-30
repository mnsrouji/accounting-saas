// =============================================================
// Feature Flags & Controlled Rollouts — Platform Admin
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise Operations
// =============================================================

import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import { FeatureFlagService } from '@/lib/services/feature-flag-service'
import {
  ToggleLeft,
  Sliders,
  ShieldAlert,
  Percent,
  Layers,
  CheckCircle,
} from 'lucide-react'

export const metadata = {
  title: 'Feature Flags — Platform Admin',
}

export default async function AdminFlagsPage() {
  await requirePlatformAdmin()

  const flags = await FeatureFlagService.listFlags()

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Feature Flags & Controlled Rollouts
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Deterministic server-side rollout evaluation across platform tiers, plans, and percentage cohorts
        </p>
      </div>

      <div
        style={{
          background: '#131b2e',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Registered Feature Flags</h2>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Flag Key</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Name / Description</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>State</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Rollout %</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {flags.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  No feature flags configured yet.
                </td>
              </tr>
            ) : (
              flags.map((flag) => (
                <tr key={flag.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem 1rem', color: '#818cf8', fontWeight: 600, fontFamily: 'monospace' }}>
                    {flag.key}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{flag.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{flag.description}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {flag.isEnabled ? (
                      <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        ACTIVE
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        DISABLED
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                    {(flag.rules as Record<string, any>)?.rolloutPercentage ?? 100}%
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                    {new Date(flag.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
