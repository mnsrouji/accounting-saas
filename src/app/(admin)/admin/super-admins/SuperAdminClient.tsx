'use client'

// =============================================================
// Super Admin Management Page — Client Component
// =============================================================

import { useState, useTransition, useCallback } from 'react'
import {
  grantSuperAdminAction,
  revokeSuperAdminAction,
  searchUsersForSuperAdminAction,
  superAdminUpdateUserStatusAction,
} from '@/actions/saas/super-admin-actions'
import {
  ShieldCheck,
  ShieldOff,
  Search,
  Crown,
  Users,
  AlertTriangle,
  CheckCircle,
  X,
  UserCheck,
  UserX,
  Loader2,
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
// Toast helper
// ─────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 9999,
        padding: '0.875rem 1.25rem',
        borderRadius: 12,
        background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${ok ? '#22c55e' : '#ef4444'}`,
        color: ok ? '#4ade80' : '#f87171',
        fontSize: '0.875rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideInRight 0.3s ease',
      }}
    >
      {ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Avatar initials
// ─────────────────────────────────────────────────────────────

function Avatar({ user, size = 38 }: { user: AdminUser; size?: number }) {
  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.fullName}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']
  const color = colors[user.fullName.charCodeAt(0) % colors.length]

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Grant Modal
// ─────────────────────────────────────────────────────────────

function GrantModal({
  onClose,
  onGranted,
}: {
  onClose: () => void
  onGranted: (user: AdminUser) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const res = await searchUsersForSuperAdminAction(q)
    setSearching(false)
    if (res.success) setResults(res.data as AdminUser[])
  }, [])

  const handleGrant = () => {
    if (!selected) return
    startTransition(async () => {
      const res = await grantSuperAdminAction(selected.id, note)
      if (res.success) {
        onGranted({ ...selected, isSuperAdmin: true, superAdminNote: note })
        onClose()
      }
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '2rem',
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Grant Super Admin
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Search for a user and grant them absolute platform-wide control
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.5rem',
              paddingRight: '1rem',
              paddingTop: '0.625rem',
              paddingBottom: '0.625rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#f8fafc',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            autoFocus
          />
          {searching && <Loader2 size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6366f1', animation: 'spin 1s linear infinite' }} />}
        </div>

        {/* Results */}
        {results.length > 0 && !selected && (
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              >
                <Avatar user={u} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#f8fafc', fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fullName}</span>
                    {u.isSuperAdmin && <Crown size={12} color="#f59e0b" />}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
                <div style={{ color: '#475569', fontSize: '0.75rem', flexShrink: 0 }}>{u._count.businessMemberships} co.</div>
              </button>
            ))}
          </div>
        )}

        {/* Selected user */}
        {selected && (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 10,
                marginBottom: '0.75rem',
              }}
            >
              <Avatar user={selected} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontSize: '0.875rem', fontWeight: 700 }}>{selected.fullName}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem' }}>
              Note / Reason (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. System administrator, CTO..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#f8fafc',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Warning */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '0.75rem',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10,
            marginBottom: '1.5rem',
          }}
        >
          <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
            Super Admins have <strong>absolute, unrestricted access</strong> to all companies, users, financial data, and system settings. Grant with extreme caution.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#94a3b8',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleGrant}
            disabled={!selected || isPending}
            style={{
              padding: '0.625rem 1.5rem',
              background: selected ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 10,
              color: selected ? '#fff' : '#475569',
              fontSize: '0.875rem',
              cursor: selected ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Crown size={14} />}
            {isPending ? 'Granting...' : 'Grant Super Admin'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Client Component
// ─────────────────────────────────────────────────────────────

export default function SuperAdminClient({ superAdmins: initial, currentUserId }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<AdminUser | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const handleGranted = (user: AdminUser) => {
    setAdmins((prev) => {
      const exists = prev.find((a) => a.id === user.id)
      if (exists) return prev.map((a) => (a.id === user.id ? user : a))
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
      showToast(`${user.fullName}'s Super Admin access has been revoked`, true)
    } else {
      showToast(res.error, false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(2rem); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {showModal && (
        <GrantModal
          onClose={() => setShowModal(false)}
          onGranted={handleGranted}
        />
      )}

      {/* Confirm Revoke Dialog */}
      {confirmRevoke && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 16,
              padding: '2rem',
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldOff size={20} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Revoke Super Admin</h3>
                <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>This action is logged and auditable</p>
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Are you sure you want to revoke Super Admin access from <strong style={{ color: '#f8fafc' }}>{confirmRevoke.fullName}</strong>? They will lose all platform-level privileges immediately.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmRevoke(null)}
                style={{ padding: '0.625rem 1.25rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#94a3b8', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(confirmRevoke)}
                disabled={revoking === confirmRevoke.id}
                style={{ padding: '0.625rem 1.25rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', borderRadius: 10, color: '#fff', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {revoking === confirmRevoke.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldOff size={14} />}
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={18} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              Super Admins
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Accounts with absolute, unrestricted platform-wide authority over all businesses, users, and data.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            border: 'none',
            borderRadius: 12,
            color: '#000',
            fontSize: '0.875rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 0 24px rgba(245,158,11,0.3)',
            letterSpacing: '0.01em',
          }}
        >
          <Crown size={16} />
          Grant Super Admin
        </button>
      </div>

      {/* Warning Banner */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          padding: '1rem 1.25rem',
          background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 12,
          marginBottom: '2rem',
        }}
      >
        <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.875rem', margin: '0 0 0.25rem' }}>
            Critical Privilege Level
          </p>
          <p style={{ color: '#92400e', fontSize: '0.8125rem', margin: 0, lineHeight: 1.6 }}>
            Super Admins bypass ALL business-level permission checks. They can access, modify, and delete data across every company on the platform. All privilege changes are permanently logged in the audit trail.
          </p>
        </div>
      </div>

      {/* Super Admin Cards */}
      {admins.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
          }}
        >
          <Crown size={48} color="#374151" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#475569', fontSize: '0.875rem' }}>No Super Admins yet. Grant access to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {admins.map((admin) => (
            <div
              key={admin.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                background: admin.id === currentUserId
                  ? 'rgba(245,158,11,0.07)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${admin.id === currentUserId ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                transition: 'all 0.2s',
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative' }}>
                <Avatar user={admin} size={46} />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #090d16',
                  }}
                >
                  <Crown size={9} color="#000" />
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#f8fafc', fontSize: '0.9375rem', fontWeight: 700 }}>{admin.fullName}</span>
                  {admin.id === currentUserId && (
                    <span style={{ padding: '0.125rem 0.5rem', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, color: '#f59e0b', fontSize: '0.6875rem', fontWeight: 700 }}>
                      YOU
                    </span>
                  )}
                  <span
                    style={{
                      padding: '0.125rem 0.5rem',
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: 6,
                      color: '#fbbf24',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    SUPER ADMIN
                  </span>
                </div>
                <div style={{ color: '#64748b', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  {admin.email}
                </div>
                {admin.superAdminNote && (
                  <div style={{ color: '#78716c', fontSize: '0.75rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    {admin.superAdminNote}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem' }}>
                  <span style={{ color: '#475569', fontSize: '0.75rem' }}>
                    <Users size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    {admin._count.businessMemberships} companies
                  </span>
                  <span style={{ color: admin.status === 'active' ? '#22c55e' : '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                    ● {admin.status}
                  </span>
                  <span style={{ color: '#374151', fontSize: '0.75rem' }}>
                    Since {new Date(admin.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {admin.id !== currentUserId && (
                <button
                  onClick={() => setConfirmRevoke(admin)}
                  disabled={revoking === admin.id}
                  title="Revoke Super Admin"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.875rem',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8,
                    color: '#f87171',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'
                  }}
                >
                  {revoking === admin.id ? (
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <ShieldOff size={13} />
                  )}
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats footer */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem 1.5rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#475569',
          fontSize: '0.8125rem',
        }}
      >
        <ShieldCheck size={16} color="#6366f1" />
        <span>
          {admins.length} Super Admin{admins.length !== 1 ? 's' : ''} total · All privilege changes are permanently recorded in the platform audit trail
        </span>
      </div>
    </>
  )
}
