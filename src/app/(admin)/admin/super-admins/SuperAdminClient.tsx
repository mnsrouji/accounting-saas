'use client'

// =============================================================
// Super Admin Management — Full Control Panel
// Tabs: Super Admins | All Users | All Businesses
// =============================================================

import { useState, useTransition, useCallback, useEffect } from 'react'
import {
  grantSuperAdminAction,
  revokeSuperAdminAction,
  searchUsersForSuperAdminAction,
  getAllUsersAsSuperAdminAction,
  getAllBusinessesAsSuperAdminAction,
  superAdminUpdateUserStatusAction,
  superAdminDeleteUserAction,
  superAdminUpdateBusinessStatusAction,
  superAdminDeleteBusinessAction,
} from '@/actions/saas/super-admin-actions'
import {
  Crown, Search, ShieldOff, X, AlertTriangle, Loader2,
  UserPlus, CheckCircle, Building, Users, Shield,
  Trash2, PlayCircle, PauseCircle, Archive,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────

type AdminUser = {
  id: string; email: string; fullName: string; avatarUrl: string | null
  status: string; isSuperAdmin: boolean; superAdminNote: string | null
  createdAt: Date; _count: { businessMemberships: number }
}

type BizRow = {
  id: string; name: string; legalName?: string | null; email?: string | null
  status: string; defaultCurrency: string; country?: string | null
  createdAt: Date; _count: { members: number; customers: number; sales: number }
}

type Props = { superAdmins: AdminUser[]; currentUserId: string }
type Tab = 'admins' | 'users' | 'businesses'

// ─── Helpers ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, [string, string]> = {
    active: ['rgba(52,211,153,0.1)', '#34d399'],
    suspended: ['rgba(245,158,11,0.1)', '#f59e0b'],
    inactive: ['rgba(100,116,139,0.1)', '#64748b'],
    closed: ['rgba(239,68,68,0.1)', '#f87171'],
  }
  const [bg, color] = colors[status] ?? ['rgba(100,116,139,0.1)', '#64748b']
  return (
    <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, background: bg, color, textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, padding: '0.75rem 1rem', borderRadius: 10, background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${ok ? '#22c55e' : '#ef4444'}`, color: ok ? '#4ade80' : '#f87171', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      {ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
      {msg}
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel, danger,
  onConfirm, onCancel, loading,
}: {
  title: string; message: React.ReactNode; confirmLabel: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void; loading?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#0d1322', border: `1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: '1.75rem', maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <h3 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.625rem' }}>{title}</h3>
        <div style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>{message}</div>
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '0.5rem 1.25rem', background: danger ? 'rgba(239,68,68,0.9)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Grant Super Admin Modal ──────────────────────────────────

function GrantModal({ onClose, onGranted }: { onClose: () => void; onGranted: (u: AdminUser) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

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
    startTransition(async () => {
      const res = await grantSuperAdminAction(selected.id, note)
      if (res.success) { onGranted({ ...selected, isSuperAdmin: true, superAdminNote: note || null }); onClose() }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Crown size={18} color="#f59e0b" />
            <h2 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Grant Super Admin</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ position: 'relative', marginBottom: '0.875rem' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          {searching && <Loader2 size={14} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#6366f1', animation: 'spin 1s linear infinite' }} />}
          <input autoFocus type="text" placeholder="Search by email or name..." value={query} onChange={(e) => handleSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '2rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f8fafc', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {results.length > 0 && !selected && (
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' }}>
            {results.map((u, i) => (
              <button key={u.id} onClick={() => { setSelected(u); setResults([]) }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', background: 'transparent', border: 'none', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>{u.fullName.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f8fafc', fontSize: '0.8125rem', fontWeight: 600 }}>{u.fullName}{u.isSuperAdmin && <Crown size={10} color="#f59e0b" style={{ marginLeft: 4 }} />}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{u.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div style={{ marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, marginBottom: '0.625rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#312e81', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>{selected.fullName.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1 }}><div style={{ color: '#f8fafc', fontSize: '0.8125rem', fontWeight: 600 }}>{selected.fullName}</div><div style={{ color: '#64748b', fontSize: '0.75rem' }}>{selected.email}</div></div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <input type="text" placeholder="Note (e.g. CTO, System Admin)..." value={note} onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f8fafc', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.625rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, marginBottom: '1rem' }}>
          <AlertTriangle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: '#f87171', fontSize: '0.75rem', margin: 0 }}>Super Admins have <strong>absolute unrestricted access</strong> to all data. Grant with caution.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleGrant} disabled={!selected || isPending}
            style={{ padding: '0.5rem 1.125rem', background: selected ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 8, color: selected ? '#000' : '#475569', fontSize: '0.8125rem', fontWeight: 700, cursor: selected ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Crown size={13} />}
            Grant Access
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Super Admins Tab ─────────────────────────────────────────

function SuperAdminsTab({ admins, setAdmins, currentUserId, showModal, setShowModal, showToast }: any) {
  const [confirmRevoke, setConfirmRevoke] = useState<AdminUser | null>(null)
  const [revoking, setRevoking] = useState(false)

  const handleRevoke = async () => {
    if (!confirmRevoke) return
    setRevoking(true)
    const res = await revokeSuperAdminAction(confirmRevoke.id)
    setRevoking(false)
    setConfirmRevoke(null)
    if (res.success) { setAdmins((p: AdminUser[]) => p.filter(a => a.id !== confirmRevoke.id)); showToast(`${confirmRevoke.fullName}'s access revoked`, true) }
    else showToast(res.error, false)
  }

  return (
    <>
      {showModal && <GrantModal onClose={() => setShowModal(false)} onGranted={(u) => { setAdmins((p: AdminUser[]) => p.find(a => a.id === u.id) ? p.map(a => a.id === u.id ? u : a) : [...p, u]); showToast(`${u.fullName} granted Super Admin`, true) }} />}
      {confirmRevoke && <ConfirmDialog title="Revoke Super Admin" danger
        message={<>Remove Super Admin from <strong style={{ color: '#f8fafc' }}>{confirmRevoke.fullName}</strong>? They lose all platform-level privileges immediately.</>}
        confirmLabel="Revoke" loading={revoking} onConfirm={handleRevoke} onCancel={() => setConfirmRevoke(null)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>{admins.length} Super Admin{admins.length !== 1 ? 's' : ''} with absolute platform authority</p>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.875rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, color: '#fbbf24', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
          <UserPlus size={14} /> Grant Super Admin
        </button>
      </div>
      <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>User</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Email</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Note</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Since</th>
            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
          </tr></thead>
          <tbody>
            {admins.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>No Super Admins yet.</td></tr>
            ) : admins.map((a: AdminUser) => (
              <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>{a.fullName.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {a.fullName}
                        {a.id === currentUserId && <span style={{ padding: '0.1rem 0.3rem', background: 'rgba(245,158,11,0.12)', borderRadius: 4, color: '#f59e0b', fontSize: '0.6rem', fontWeight: 700 }}>YOU</span>}
                      </div>
                      <div style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Crown size={8} /> SUPER ADMIN</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{a.email}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontStyle: a.superAdminNote ? 'normal' : 'italic' }}>{a.superAdminNote || '—'}</td>
                <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={a.status} /></td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                  {a.id !== currentUserId && (
                    <button onClick={() => setConfirmRevoke(a)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                      <ShieldOff size={11} /> Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Users Tab ────────────────────────────────────────────────

function UsersTab({ currentUserId, showToast }: { currentUserId: string; showToast: (m: string, ok: boolean) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ user: AdminUser; action: string } | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    getAllUsersAsSuperAdminAction({ limit: 100 }).then(res => {
      if (res.success) setUsers(res.data.users as AdminUser[])
      setLoading(false)
    })
  }, [])

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const execAction = (user: AdminUser, action: string) => {
    startTransition(async () => {
      if (action === 'delete') {
        const res = await superAdminDeleteUserAction(user.id)
        if (res.success) { setUsers(p => p.filter(u => u.id !== user.id)); showToast(`${user.fullName} deleted`, true) }
        else showToast(res.error, false)
      } else {
        const res = await superAdminUpdateUserStatusAction(user.id, action as any)
        if (res.success) { setUsers(p => p.map(u => u.id === user.id ? { ...u, status: action } : u)); showToast(`${user.fullName} → ${action}`, true) }
        else showToast(res.error, false)
      }
      setConfirm(null)
    })
  }

  return (
    <>
      {confirm && (
        <ConfirmDialog
          title={confirm.action === 'delete' ? '⚠️ Delete User' : `Change User Status`}
          danger={confirm.action === 'delete' || confirm.action === 'suspended'}
          message={<>Are you sure you want to <strong style={{ color: '#f8fafc' }}>{confirm.action}</strong> <strong style={{ color: '#f8fafc' }}>{confirm.user.fullName}</strong>?{confirm.action === 'delete' && <><br /><span style={{ color: '#f87171', fontSize: '0.8125rem' }}>This action is permanent and cannot be undone.</span></>}</>}
          confirmLabel={confirm.action === 'delete' ? 'Delete Permanently' : confirm.action.charAt(0).toUpperCase() + confirm.action.slice(1)}
          loading={pending} onConfirm={() => execAction(confirm.user, confirm.action)} onCancel={() => setConfirm(null)}
        />
      )}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', paddingLeft: '2.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', paddingRight: '1rem', background: '#0d1322', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f8fafc', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>User</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Email</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Companies</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Joined</th>
            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>No users found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>{u.fullName.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {u.fullName}
                        {u.id === currentUserId && <span style={{ padding: '0.1rem 0.3rem', background: 'rgba(245,158,11,0.12)', borderRadius: 4, color: '#f59e0b', fontSize: '0.6rem', fontWeight: 700 }}>YOU</span>}
                        {u.isSuperAdmin && <Crown size={10} color="#f59e0b" />}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{u.email}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{u._count.businessMemberships}</td>
                <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={u.status} /></td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                  {u.id !== currentUserId ? (
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                      {u.status !== 'active' && (
                        <button onClick={() => setConfirm({ user: u, action: 'active' })} title="Activate" style={{ padding: '0.3rem 0.55rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 6, color: '#34d399', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <PlayCircle size={11} /> Activate
                        </button>
                      )}
                      {u.status === 'active' && (
                        <button onClick={() => setConfirm({ user: u, action: 'suspended' })} title="Suspend" style={{ padding: '0.3rem 0.55rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <PauseCircle size={11} /> Suspend
                        </button>
                      )}
                      <button onClick={() => setConfirm({ user: u, action: 'delete' })} title="Delete" style={{ padding: '0.3rem 0.55rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  ) : <span style={{ color: '#374151', fontSize: '0.75rem' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '0.75rem', color: '#374151', fontSize: '0.75rem' }}>{filtered.length} user{filtered.length !== 1 ? 's' : ''} shown</div>
    </>
  )
}

// ─── Businesses Tab ───────────────────────────────────────────

function BusinessesTab({ showToast }: { showToast: (m: string, ok: boolean) => void }) {
  const [businesses, setBusinesses] = useState<BizRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ biz: BizRow; action: string } | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    getAllBusinessesAsSuperAdminAction({ limit: 100 }).then(res => {
      if (res.success) setBusinesses(res.data.businesses as BizRow[])
      setLoading(false)
    })
  }, [])

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const execAction = (biz: BizRow, action: string) => {
    startTransition(async () => {
      if (action === 'delete') {
        const res = await superAdminDeleteBusinessAction(biz.id)
        if (res.success) { setBusinesses(p => p.filter(b => b.id !== biz.id)); showToast(`${biz.name} deleted`, true) }
        else showToast(res.error, false)
      } else {
        const res = await superAdminUpdateBusinessStatusAction(biz.id, action as any)
        if (res.success) { setBusinesses(p => p.map(b => b.id === biz.id ? { ...b, status: action } : b)); showToast(`${biz.name} → ${action}`, true) }
        else showToast(res.error, false)
      }
      setConfirm(null)
    })
  }

  return (
    <>
      {confirm && (
        <ConfirmDialog
          title={confirm.action === 'delete' ? '⚠️ Delete Business' : `Change Business Status`}
          danger={confirm.action === 'delete' || confirm.action === 'suspended' || confirm.action === 'closed'}
          message={<>Are you sure you want to <strong style={{ color: '#f8fafc' }}>{confirm.action}</strong> <strong style={{ color: '#f8fafc' }}>{confirm.biz.name}</strong>?{confirm.action === 'delete' && <><br /><span style={{ color: '#f87171', fontSize: '0.8125rem' }}>All invoices, transactions, and data will be permanently deleted.</span></>}</>}
          confirmLabel={confirm.action === 'delete' ? 'Delete Permanently' : confirm.action.charAt(0).toUpperCase() + confirm.action.slice(1)}
          loading={pending} onConfirm={() => execAction(confirm.biz, confirm.action)} onCancel={() => setConfirm(null)}
        />
      )}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input type="text" placeholder="Search businesses..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', paddingLeft: '2.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', paddingRight: '1rem', background: '#0d1322', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f8fafc', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Business</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Email</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Members</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Sales</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Created</th>
            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>No businesses found.</td></tr>
            ) : filtered.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building size={14} color="#38bdf8" />
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>{b.name}</div>
                      {b.legalName && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{b.legalName}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{b.email || '—'}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{b._count.members}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{b._count.sales}</td>
                <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={b.status} /></td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                    {b.status !== 'active' && (
                      <button onClick={() => setConfirm({ biz: b, action: 'active' })} style={{ padding: '0.3rem 0.55rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 6, color: '#34d399', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <PlayCircle size={11} /> Activate
                      </button>
                    )}
                    {b.status === 'active' && (
                      <button onClick={() => setConfirm({ biz: b, action: 'suspended' })} style={{ padding: '0.3rem 0.55rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <PauseCircle size={11} /> Suspend
                      </button>
                    )}
                    {b.status !== 'closed' && (
                      <button onClick={() => setConfirm({ biz: b, action: 'closed' })} style={{ padding: '0.3rem 0.55rem', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, color: '#64748b', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Archive size={11} /> Close
                      </button>
                    )}
                    <button onClick={() => setConfirm({ biz: b, action: 'delete' })} style={{ padding: '0.3rem 0.55rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '0.75rem', color: '#374151', fontSize: '0.75rem' }}>{filtered.length} business{filtered.length !== 1 ? 'es' : ''} shown</div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────

export default function SuperAdminClient({ superAdmins: initial, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('admins')
  const [admins, setAdmins] = useState<AdminUser[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = useCallback((msg: string, ok: boolean) => setToast({ msg, ok }), [])

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'admins', label: 'Super Admins', icon: <Crown size={14} />, count: admins.length },
    { id: 'users', label: 'All Users', icon: <Users size={14} /> },
    { id: 'businesses', label: 'All Businesses', icon: <Building size={14} /> },
  ]

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield size={22} color="#f59e0b" />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>Super Admin Panel</h1>
            <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>Full platform control — users, businesses, privileges</p>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div style={{ display: 'flex', gap: '0.625rem', padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, marginBottom: '1.5rem' }}>
        <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ color: '#92400e', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
          All actions here are <strong style={{ color: '#f59e0b' }}>permanent and audited</strong>. Deletions cannot be undone.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.625rem 1rem', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#6366f1' : 'transparent'}`, color: tab === t.id ? '#f8fafc' : '#64748b', fontSize: '0.875rem', fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', marginBottom: '-1px', transition: 'all 0.15s' }}>
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span style={{ padding: '0.1rem 0.4rem', background: tab === t.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700, color: tab === t.id ? '#818cf8' : '#475569' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'admins' && <SuperAdminsTab admins={admins} setAdmins={setAdmins} currentUserId={currentUserId} showModal={showModal} setShowModal={setShowModal} showToast={showToast} />}
      {tab === 'users' && <UsersTab currentUserId={currentUserId} showToast={showToast} />}
      {tab === 'businesses' && <BusinessesTab showToast={showToast} />}
    </>
  )
}
