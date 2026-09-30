// =============================================================
// Platform Admin Audit Trail — Immutable Platform Logs
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { PlatformDashboardService } from '@/lib/services/platform-dashboard-service'
import { FileText, Shield, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlatformAuditPage() {
  const logs = await PlatformDashboardService.getPlatformAuditLogs(100)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FileText size={24} color="#fbbf24" />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              Platform Audit Trail & Compliance
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Immutable event logs for tenant lifecycle, permissions, and administrative changes
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div
        style={{
          background: '#0d1322',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '0.875rem 1rem' }}>Timestamp</th>
              <th style={{ padding: '0.875rem 1rem' }}>Organization</th>
              <th style={{ padding: '0.875rem 1rem' }}>Actor</th>
              <th style={{ padding: '0.875rem 1rem' }}>Module</th>
              <th style={{ padding: '0.875rem 1rem' }}>Action</th>
              <th style={{ padding: '0.875rem 1rem' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.875rem 1rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={12} color="#64748b" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                    {log.business?.name || 'Platform Level'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#94a3b8' }}>
                    {log.user?.fullName || log.user?.email || 'System'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)',
                        color: '#94a3b8',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {log.module}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        background:
                          log.action === 'create'
                            ? 'rgba(52,211,153,0.1)'
                            : log.action === 'delete'
                            ? 'rgba(239,68,68,0.1)'
                            : 'rgba(56,189,248,0.1)',
                        color:
                          log.action === 'create'
                            ? '#34d399'
                            : log.action === 'delete'
                            ? '#f87171'
                            : '#38bdf8',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#64748b', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.newValues ? JSON.stringify(log.newValues) : '-'}
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
