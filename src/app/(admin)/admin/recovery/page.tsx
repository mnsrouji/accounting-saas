// =============================================================
// Platform Recovery Operations — Backups & Snapshots
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise Operations
// =============================================================

import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import {
  Database,
  ShieldCheck,
  DownloadCloud,
  FileArchive,
  Clock,
  HardDrive,
  CheckCircle,
} from 'lucide-react'

export const metadata = {
  title: 'Recovery Operations — Platform Admin',
}

export default async function AdminRecoveryPage() {
  await requirePlatformAdmin()

  const mockSnapshots = [
    {
      id: 'snap-20260924-prod-daily',
      type: 'Automated Daily Snapshot',
      size: '42.8 MB',
      checksum: 'sha256:8f4c28a87b99c7d4e5f1...',
      status: 'VERIFIED',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'snap-20260923-prod-daily',
      type: 'Automated Daily Snapshot',
      size: '41.2 MB',
      checksum: 'sha256:1a9d47c23e88a1b9f0d3...',
      status: 'VERIFIED',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Disaster Recovery & Snapshots
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Platform-level point-in-time recovery, tenant snapshot archives, and backup integrity verification
        </p>
      </div>

      {/* RTO / RPO Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Clock size={20} color="#34d399" />
            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Recovery Time Objective (RTO)</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>&lt; 15 Minutes</div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Automated container failover & replication</p>
        </div>

        <div
          style={{
            background: '#131b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Database size={20} color="#38bdf8" />
            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Recovery Point Objective (RPO)</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>&lt; 5 Minutes</div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Continuous WAL archiving & Supabase PITR</p>
        </div>
      </div>

      {/* Snapshots Table */}
      <div
        style={{
          background: '#131b2e',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Recent Platform Backup Snapshots</h2>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Snapshot ID</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Type</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Archive Size</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Integrity Checksum</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {mockSnapshots.map((snap) => (
              <tr key={snap.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontFamily: 'monospace' }}>{snap.id}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{snap.type}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{snap.size}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontFamily: 'monospace' }}>{snap.checksum}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                    {snap.status}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                  {new Date(snap.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
