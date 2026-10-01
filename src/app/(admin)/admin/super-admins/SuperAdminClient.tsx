'use client'

// =============================================================
// Super Admin Management Client — Clean table layout
// =============================================================

import { useState, useTransition, useCallback } from 'react'
import {
  grantSuperAdminAction,
  revokeSuperAdminAction,
  searchUsersForSuperAdminAction,
} from '@/actions/saas/super-admin-actions'
import {
  Crown,
  Search,
  ShieldOff,
  X,
  AlertTriangle,
  Loader2,
  UserPlus,
  CheckCircle,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AdminUser = {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  status: string
  isSuperAdmin: boolean
  superAdminNote: string | null
  createdAt: Date
  _count: { businessMemberships: number }
}

type Props = {
  superAdmins: AdminUser[]
  currentUserId: string
}

// ─────────────────────────────────────────────────────────────
// Grant Modal
// ─────────────────────────────────────────────────────────────

function GrantModal({ onClose, onGranted }: { onClose: () => void; onGranted: (u: AdminUser) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState('')

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const res = await searchUsersForSuperAdminAction(q)
    setSearching(false)
    if (res.success) setResults(res.data as AdminUser[])
  }, [])

  const handleGrant = () => {
    if (!selected) return
    setErr('')
    startTransition(async () => {
      const res = await grantSuperAdminAction(selected.id, note)
      if (res.success) {
        onGranted({ ...selected, isSuperAdmin: true, superAdminNote: note || null })
        onClose()
      } else {
        setErr(res.error)
      }
    })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Crown size={18} color="#f59e0b" />
            <h2 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Grant Super Admin</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '0.875rem' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          {searching && <Loader2 size={14} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#6366f1', animation: 'spin 1s linear infinite' }} />}
          <input
            autoFocus
            type="text"
            placeholder="Search by email or name..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '2rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f8fafc', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Search results */}
        {results.length > 0 && !selected && (
          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' }}>
            {results.map((u, i) => (
              <button
                key={u.id}
                onClick={() => { setSelected(u); setResults([]) }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                  {u.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f8fafc', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {u.fullName}
                    {u.isSuperAdmin && <Crown size={11} color="#f59e0b" />}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
                <div style={{ color: '#374151', fontSize: '0.75rem', flexShrink: 0 }}>{u._count.businessMemberships} co.</div>
              </button>
            ))}
          </div>
        )}

        {/* Selected */}
        {selected && (
          <div style={{ marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, marginBottom: '0.75rem' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#312e81', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>
                {selected.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f8fafc', fontSize: '0.875rem', fontWeight: 600 }}>{selected.fullName}</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <input
              type="text"
              placeholder="Note / role (e.g. CTO, System Administrator)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', padding: '0.625rem 0.875rem', background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f8fafc', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* Warning */}
        <div style={{ display: 'flex', gap: '0.625rem', padding: '0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, marginBottom: '1.25rem' }}>
          <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: '#f87171', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
            Super Admins have <strong>absolute unrestricted access</strong> to all companies, users, and financial data. Grant with caution.
          </p>
        </div>

        {err && <p style={{ color: '#f87171', fontSize: '0.8125rem', marginBottom: '0.875rem' }}>{err}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleGrant}
            disabled={!selected || isPending}
            style={{ padding: '0.5rem 1.25rem', background: selected ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 8, color: selected ? '#000' : '#475569', fontSize: '0.8125rem', fontWeight: 700, cursor: selected ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Crown size={13} />}
            {isPending ? 'Granting...' : 'Grant Access'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function SuperAdminClient({ superAdmins: initial, currentUserId }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<AdminUser | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const handleGranted = (user: AdminUser) => {
    setAdmins((prev) => {
      if (prev.find((a) => a.id === user.id)) return prev.map((a) => (a.id === user.id ? user : a))
      return [...prev, user]
    })
    showToast(`${user.fullName} is now a Super Admin`, true)
  }

  const handleRevoke = async (user: AdminUser) => {
    setRevoking(user.id)
    const res = await revokeSuperAdminAction(user.id)
    setRevoking(null)
    setConfirmRevoke(null)
    if (res.success) {
      setAdmins((prev) => prev.filter((a) => a.id !== user.id))
      showToast(`${user.fullName}'s access has been revoked`, true)
    } else {
      showToast(res.error, false)
    }
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, padding: '0.75rem 1rem', borderRadius: 10, background: toast.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${toast.ok ? '#22c55e' : '#ef4444'}`, color: toast.ok ? '#4ade80' : '#f87171', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Grant Modal */}
      {showModal && <GrantModal onClose={() => setShowModal(false)} onGranted={handleGranted} />}

      {/* Confirm Revoke */}
      {confirmRevoke && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#0d1322', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: '1.75rem', maxWidth: 400, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Revoke Super Admin</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
              Remove Super Admin access from <strong style={{ color: '#f8fafc' }}>{confirmRevoke.fullName}</strong>? They will lose all platform-level privileges immediately.
            </p>
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRevoke(null)} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => handleRevoke(confirmRevoke)}
                disabled={revoking === confirmRevoke.id}
                style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {revoking === confirmRevoke.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldOff size={13} />}
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Crown size={22} color="#f59e0b" />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>Super Admins</h1>
            <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>
              Accounts with absolute platform-wide authority · {admins.length} active
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.125rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, color: '#fbbf24', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <UserPlus size={15} />
          Grant Super Admin
        </button>
      </div>

      {/* Warning banner */}
      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, marginBottom: '1.5rem' }}>
        <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ color: '#92400e', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
          Super Admins bypass <strong style={{ color: '#f59e0b' }}>all</strong> business-level permission checks and can access, modify, or delete data across every company on the platform. All changes are permanently recorded in the audit trail.
        </p>
      </div>

      {/* Table */}
      <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>User</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Email</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Note</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Companies</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Since</th>
              <th style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>
                  <Crown size={32} color="#1e293b" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
                  No Super Admins yet. Use the button above to grant access.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr
                  key={admin.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* User */}
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                        {admin.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {admin.fullName}
                          {admin.id === currentUserId && (
                            <span style={{ padding: '0.1rem 0.375rem', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 4, color: '#f59e0b', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em' }}>YOU</span>
                          )}
                        </div>
                        <div style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
                          <Crown size={9} /> SUPER ADMIN
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td style={{ padding: '0.875rem 1rem', color: '#94a3b8' }}>{admin.email}</td>

                  {/* Note */}
                  <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontStyle: admin.superAdminNote ? 'normal' : 'italic' }}>
                    {admin.superAdminNote || '—'}
                  </td>

                  {/* Companies */}
                  <td style={{ padding: '0.875rem 1rem', color: '#94a3b8' }}>{admin._count.businessMemberships}</td>

                  {/* Status */}
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: admin.status === 'active' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                      color: admin.status === 'active' ? '#34d399' : '#f87171',
                    }}>
                      {admin.status}
                    </span>
                  </td>

                  {/* Since */}
                  <td style={{ padding: '0.875rem 1rem', color: '#64748b' }}>
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    {admin.id === currentUserId ? (
                      <span style={{ color: '#374151', fontSize: '0.75rem' }}>—</span>
                    ) : (
                      <button
                        onClick={() => setConfirmRevoke(admin)}
                        disabled={revoking === admin.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {revoking === admin.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldOff size={12} />}
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
