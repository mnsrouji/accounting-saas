// =============================================================
// Tenant Manager Client Component — Interactive Tenant Operations
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

'use client'

import { useState, useTransition } from 'react'
import { updateTenantStatusAction } from '@/actions/saas/platform-admin-actions'
import {
  Building,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Archive,
  Users,
  Layers,
} from 'lucide-react'

export interface TenantRow {
  id: string
  name: string
  legalName?: string | null
  status: 'active' | 'suspended' | 'closed'
  country?: string | null
  currency: string
  owner: { id: string; name: string; email: string } | null
  plan: { name: string; code: string; status: string; currentPeriodEnd: Date } | null
  userCount: number
  warehouseCount: number
  salesCount: number
  productCount: number
  createdAt: Date
}

export default function TenantManagerClient({ initialTenants }: { initialTenants: TenantRow[] }) {
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'closed'>('all')
  const [isPending, startTransition] = useTransition()
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null)
  const [actionReason, setActionReason] = useState('')

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.owner?.email.toLowerCase().includes(search.toLowerCase()) ||
      t.owner?.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function handleStatusChange(businessId: string, newStatus: 'active' | 'suspended' | 'closed') {
    if (!confirm(`Are you sure you want to change status of this business to "${newStatus}"?`)) {
      return
    }

    startTransition(async () => {
      const res = await updateTenantStatusAction(businessId, newStatus, actionReason || 'Admin console action')
      if (res.success) {
        setTenants((prev) =>
          prev.map((t) => (t.id === businessId ? { ...t, status: newStatus } : t))
        )
        setSelectedTenant(null)
        setActionReason('')
      } else {
        alert(res.error || 'Failed to update tenant status')
      }
    })
  }

  return (
    <div>
      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: 260, maxWidth: 400 }}>
          <Search
            size={16}
            color="#64748b"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search businesses, owners, emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem 0.625rem 2.25rem',
              background: '#0d1322',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#f8fafc',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'active', 'suspended', 'closed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              style={{
                padding: '0.5rem 0.875rem',
                borderRadius: 8,
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === filter ? '#4f46e5' : 'rgba(255,255,255,0.06)',
                color: statusFilter === filter ? '#ffffff' : '#94a3b8',
                textTransform: 'capitalize',
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
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
              <th style={{ padding: '0.875rem 1rem' }}>Business Name</th>
              <th style={{ padding: '0.875rem 1rem' }}>Owner</th>
              <th style={{ padding: '0.875rem 1rem' }}>Plan Tier</th>
              <th style={{ padding: '0.875rem 1rem' }}>Usage Metrics</th>
              <th style={{ padding: '0.875rem 1rem' }}>Status</th>
              <th style={{ padding: '0.875rem 1rem' }}>Created</th>
              <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Lifecycle Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No tenants matching criteria.
                </td>
              </tr>
            ) : (
              filteredTenants.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Building size={16} color="#38bdf8" />
                      <div>
                        <div>{t.name}</div>
                        {t.legalName && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.legalName}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#94a3b8' }}>
                    <div>{t.owner?.name || 'Unassigned'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.owner?.email}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: 'rgba(99,102,241,0.1)',
                        color: '#818cf8',
                      }}
                    >
                      {t.plan?.name || 'Free Trial'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                      <span>👥 {t.userCount} users</span>
                      <span>🏢 {t.warehouseCount} WH</span>
                      <span>📄 {t.salesCount} sales</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background:
                          t.status === 'active'
                            ? 'rgba(52,211,153,0.1)'
                            : t.status === 'suspended'
                            ? 'rgba(245,158,11,0.1)'
                            : 'rgba(239,68,68,0.1)',
                        color:
                          t.status === 'active'
                            ? '#34d399'
                            : t.status === 'suspended'
                            ? '#f59e0b'
                            : '#f87171',
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#64748b' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      {t.status !== 'active' && (
                        <button
                          disabled={isPending}
                          onClick={() => handleStatusChange(t.id, 'active')}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: 6,
                            background: 'rgba(52,211,153,0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.3)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Activate
                        </button>
                      )}
                      {t.status === 'active' && (
                        <button
                          disabled={isPending}
                          onClick={() => handleStatusChange(t.id, 'suspended')}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: 6,
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Suspend
                        </button>
                      )}
                      {t.status !== 'closed' && (
                        <button
                          disabled={isPending}
                          onClick={() => handleStatusChange(t.id, 'closed')}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: 6,
                            background: 'rgba(239,68,68,0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.3)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Archive
                        </button>
                      )}
                    </div>
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
