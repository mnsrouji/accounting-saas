// =============================================================
// Members & Permissions Manager Client Component
// Multi-Tenant SaaS Accounting & ERP Platform
// Supports: Direct User Creation, Granular Permissions & Password Resets
// =============================================================

'use client'

import React, { useState, useTransition } from 'react'
import {
  createDirectUserAction,
  updateMemberCustomPermissionsAction,
  resetUserPasswordDirectAction,
  updateMemberRoleAction,
  updateMemberStatusAction,
  removeMemberAction,
} from '@/actions/saas/invitation-actions'
import { MemberRole, MemberStatus } from '@prisma/client'
import { useLocale } from 'next-intl'
import {
  SYSTEM_PERMISSIONS_REGISTRY,
  ROLE_PRESET_PERMISSIONS,
  ALL_PERMISSION_CODES,
  PermissionModuleGroup,
} from '@/lib/auth/permissions-registry'
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  Check,
  KeyRound,
  Sliders,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  CheckCircle2,
  ShoppingCart,
  ShoppingBag,
  Package,
  Landmark,
  BookOpen,
  Receipt,
  BarChart3,
  Settings,
  Truck,
  Copy,
} from 'lucide-react'

export interface MemberRow {
  id: string
  userId: string
  role: MemberRole
  status: MemberStatus
  permissions?: string[] | Record<string, boolean> | null
  invitedAt: Date | null
  joinedAt: Date | null
  user: {
    id: string
    email: string
    fullName: string
    avatarUrl?: string | null
    phone?: string | null
    createdAt?: Date | null
  }
}

interface Props {
  businessId: string
  initialMembers: MemberRow[]
  isSuperAdmin?: boolean
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  sales: <ShoppingCart size={18} />,
  purchases: <ShoppingBag size={18} />,
  customers: <Users size={18} />,
  suppliers: <Truck size={18} />,
  inventory: <Package size={18} />,
  treasury: <Landmark size={18} />,
  accounting: <BookOpen size={18} />,
  expenses: <Receipt size={18} />,
  reports: <BarChart3 size={18} />,
  settings: <Settings size={18} />,
}

export default function MembersManagerClient({
  businessId,
  initialMembers,
  isSuperAdmin = true,
}: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [members, setMembers] = useState<MemberRow[]>(initialMembers)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'matrix'>('members')
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Direct User Creation Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState<MemberRole>('accountant')
  const [newCustomPermissions, setNewCustomPermissions] = useState<string[]>(
    ROLE_PRESET_PERMISSIONS['accountant'] || []
  )
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showPermissionsInAddModal, setShowPermissionsInAddModal] = useState(false)

  // Edit Permissions Modal State
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null)
  const [editPermissionsRole, setEditPermissionsRole] = useState<MemberRole>('accountant')
  const [editSelectedPermissions, setEditSelectedPermissions] = useState<string[]>([])

  // Direct Reset Password Modal State
  const [resettingMember, setResettingMember] = useState<MemberRow | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [copiedNotification, setCopiedNotification] = useState(false)

  const t = {
    teamMembers: isAr ? 'المستخدمون وفريق العمل' : isTr ? 'Ekip Üyeleri ve Kullanıcılar' : 'Team Members & Users',
    permissionsMatrix: isAr ? 'مصفوفة الصلاحيات والأدوار' : isTr ? 'Yetki ve Rol Matrisi' : 'Permissions & Roles Matrix',
    addUserBtn: isAr ? 'إضافة مستخدم مباشر' : isTr ? 'Doğrudan Kullanıcı Ekle' : 'Add Direct User',
    searchPlaceholder: isAr ? 'البحث بالاسم أو البريد أو الدور...' : isTr ? 'İsim, e-posta veya role göre ara...' : 'Search by name, email or role...',
    userCol: isAr ? 'المستخدم' : isTr ? 'Kullanıcı' : 'User',
    roleCol: isAr ? 'الدور الأساسي' : isTr ? 'Rol' : 'Base Role',
    permissionsCol: isAr ? 'الصلاحيات المخصصة' : isTr ? 'Özel İzinler' : 'Permissions',
    statusCol: isAr ? 'الحالة' : isTr ? 'Durum' : 'Status',
    actionsCol: isAr ? 'الإجراءات والتحكم' : isTr ? 'İşlemler' : 'Actions',
    editPermissions: isAr ? 'تخصيص الصلاحيات' : isTr ? 'İzinleri Düzenle' : 'Manage Permissions',
    resetPassword: isAr ? 'تعيين كلمة المرور' : isTr ? 'Şifreyi Değiştir' : 'Reset Password',
    activate: isAr ? 'تنشيط الحساب' : isTr ? 'Aktif Et' : 'Activate',
    deactivate: isAr ? 'تعطيل الحساب' : isTr ? 'Devre Dışı Bırak' : 'Deactivate',
    removeMember: isAr ? 'حذف من المنشأة' : isTr ? 'İşletmeden Kaldır' : 'Remove Member',
    confirmRemove: isAr ? 'هل أنت متأكد من حذف هذا المستخدم من المنشأة؟' : isTr ? 'Bu kullanıcıyı işletmeden kaldırmak istediğinize emin misiniz?' : 'Are you sure you want to remove this member?',
    active: isAr ? 'نشط' : isTr ? 'Aktif' : 'Active',
    inactive: isAr ? 'معطل' : isTr ? 'Pasif' : 'Inactive',
    allPermissions: isAr ? 'صلاحيات كاملة' : isTr ? 'Tam Yetkili' : 'Full Access',
    customCount: (count: number) => isAr ? `${count} صلاحية مخصصة` : isTr ? `${count} özel izin` : `${count} custom perms`,
    roles: {
      owner: isAr ? 'مالك المنشأة (Owner)' : isTr ? 'Kurucu / Sahip' : 'Owner',
      administrator: isAr ? 'مدير نظام (Admin)' : isTr ? 'Yönetici (Admin)' : 'Administrator',
      accountant: isAr ? 'محاسب عام (Accountant)' : isTr ? 'Muhasebeci' : 'Accountant',
      sales_user: isAr ? 'مسؤول مبيعات (Sales)' : isTr ? 'Satış Yetkilisi' : 'Sales User',
      purchase_user: isAr ? 'مسؤول مشتريات (Purchases)' : isTr ? 'Satın Alma Yetkilisi' : 'Purchase User',
      inventory_user: isAr ? 'مسؤول مستودعات (Inventory)' : isTr ? 'Depo Yetkilisi' : 'Inventory User',
      viewer: isAr ? 'مشاهد فقط (Viewer)' : isTr ? 'Görüntüleyici' : 'Viewer',
      custom: isAr ? 'مخصص (Custom)' : isTr ? 'Özel' : 'Custom',
    },
  }

  // Generate strong random password
  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
    let pwd = ''
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return pwd
  }

  // Handle role change in Add User Modal
  function handleNewRoleChange(role: MemberRole) {
    setNewRole(role)
    if (ROLE_PRESET_PERMISSIONS[role]) {
      setNewCustomPermissions([...ROLE_PRESET_PERMISSIONS[role]])
    }
  }

  // Submit Direct User Creation
  function handleCreateDirectUser(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!newFullName.trim() || !newEmail.trim()) {
      setErrorMsg(isAr ? 'يرجى إدخال الاسم الكامل والبريد الإلكتروني' : 'Please enter full name and email')
      return
    }

    const passwordToUse = newPassword.trim() || generateRandomPassword()

    startTransition(async () => {
      const res = await createDirectUserAction({
        businessId,
        fullName: newFullName.trim(),
        email: newEmail.trim(),
        password: passwordToUse,
        phone: newPhone.trim() || undefined,
        role: newRole,
        customPermissions: newCustomPermissions,
      })

      if (res.success && res.data) {
        setIsAddUserModalOpen(false)
        setNewFullName('')
        setNewEmail('')
        setNewPassword('')
        setNewPhone('')
        setMembers((prev) => [res.data as any, ...prev.filter((m) => m.id !== res.data?.id)])
        setSuccessMsg(
          isAr
            ? `تم إنشاء وتفعيل حساب المستخدم (${res.data.user.email}) بنجاح! كلمة المرور: ${passwordToUse}`
            : `User account created successfully! Password: ${passwordToUse}`
        )
      } else {
        setErrorMsg(res.error || (isAr ? 'فشل إنشاء المستخدم' : 'Failed to create user'))
      }
    })
  }

  // Open Edit Permissions Modal
  function handleOpenEditPermissions(member: MemberRow) {
    setEditingMember(member)
    setEditPermissionsRole(member.role)
    let initialPerms: string[] = []
    if (Array.isArray(member.permissions)) {
      initialPerms = member.permissions
    } else if (ROLE_PRESET_PERMISSIONS[member.role]) {
      initialPerms = [...ROLE_PRESET_PERMISSIONS[member.role]]
    } else {
      initialPerms = [...ALL_PERMISSION_CODES]
    }
    setEditSelectedPermissions(initialPerms)
  }

  // Save Custom Permissions
  function handleSavePermissions() {
    if (!editingMember) return
    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await updateMemberCustomPermissionsAction({
        businessId,
        targetUserId: editingMember.userId,
        permissions: editSelectedPermissions,
        role: editPermissionsRole,
      })

      if (res.success && res.data) {
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === editingMember.userId
              ? {
                  ...m,
                  role: editPermissionsRole,
                  permissions: editSelectedPermissions,
                }
              : m
          )
        )
        setEditingMember(null)
        setSuccessMsg(isAr ? 'تم تحديث الصلاحيات المخصصة بنجاح!' : 'Custom permissions updated successfully!')
        setTimeout(() => setSuccessMsg(null), 4000)
      } else {
        setErrorMsg(res.error || (isAr ? 'فشل تحديث الصلاحيات' : 'Failed to update permissions'))
      }
    })
  }

  // Save Direct Reset Password
  function handleSavePasswordReset() {
    if (!resettingMember || !resetPasswordValue.trim()) return
    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await resetUserPasswordDirectAction({
        businessId,
        targetUserId: resettingMember.userId,
        newPassword: resetPasswordValue.trim(),
      })

      if (res.success) {
        const email = resettingMember.user.email
        setResettingMember(null)
        setSuccessMsg(
          isAr
            ? `تم تحديث كلمة المرور للمستخدم (${email}) بنجاح! كلمة المرور الجديدة: ${resetPasswordValue}`
            : `Password updated for ${email} successfully! New Password: ${resetPasswordValue}`
        )
      } else {
        setErrorMsg(res.error || (isAr ? 'فشل إعادة تعيين كلمة المرور' : 'Failed to reset password'))
      }
    })
  }

  // Status Change
  function handleStatusToggle(member: MemberRow) {
    const newStatus: MemberStatus = member.status === 'active' ? 'inactive' : 'active'
    startTransition(async () => {
      const res = await updateMemberStatusAction(businessId, member.userId, newStatus)
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.userId === member.userId ? { ...m, status: newStatus } : m))
        )
        setSuccessMsg(isAr ? 'تم تحديث حالة الحساب بنجاح' : 'User status updated successfully')
        setTimeout(() => setSuccessMsg(null), 3000)
      } else {
        alert(res.error || 'Failed to update status')
      }
    })
  }

  // Remove Member
  function handleRemoveMember(member: MemberRow) {
    if (!confirm(t.confirmRemove)) return
    startTransition(async () => {
      const res = await removeMemberAction(businessId, member.userId)
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.userId !== member.userId))
        setSuccessMsg(isAr ? 'تمت إزالة العضو بنجاح' : 'Member removed successfully')
        setTimeout(() => setSuccessMsg(null), 3000)
      } else {
        alert(res.error || 'Failed to remove member')
      }
    })
  }

  // Toggle single permission in a list
  function togglePermissionInList(
    code: string,
    currentList: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    if (currentList.includes(code)) {
      setList(currentList.filter((c) => c !== code))
    } else {
      setList([...currentList, code])
    }
  }

  // Toggle entire module in a list
  function toggleModuleInList(
    moduleGroup: PermissionModuleGroup,
    currentList: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    const moduleCodes = moduleGroup.permissions.map((p) => p.code)
    const allChecked = moduleCodes.every((code) => currentList.includes(code))

    if (allChecked) {
      setList(currentList.filter((c) => !moduleCodes.includes(c)))
    } else {
      const unique = Array.from(new Set([...currentList, ...moduleCodes]))
      setList(unique)
    }
  }

  // Filtered members list
  const filteredMembers = members.filter((m) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      m.user.fullName?.toLowerCase().includes(query) ||
      m.user.email?.toLowerCase().includes(query) ||
      m.role?.toLowerCase().includes(query)
    )
  })

  return (
    <div>
      {/* Alert Notifications */}
      {successMsg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--color-brand-500)',
            color: 'var(--color-brand-500)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(successMsg)
              setCopiedNotification(true)
              setTimeout(() => setCopiedNotification(false), 2000)
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}
          >
            <Copy size={13} /> {copiedNotification ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-danger)',
            color: 'var(--color-danger)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs Header & Top Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`btn ${activeTab === 'members' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Users size={16} />
            {t.teamMembers} ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`btn ${activeTab === 'matrix' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Shield size={16} />
            {t.permissionsMatrix}
          </button>
        </div>

        {activeTab === 'members' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', minWidth: '260px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  [isAr ? 'right' : 'left']: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="form-control"
                style={{
                  [isAr ? 'paddingRight' : 'paddingLeft']: '2.25rem',
                  height: '38px',
                  fontSize: '0.8125rem',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setNewFullName('')
                setNewEmail('')
                setNewPassword(generateRandomPassword())
                setNewPhone('')
                setNewRole('accountant')
                setNewCustomPermissions([...ROLE_PRESET_PERMISSIONS['accountant']])
                setIsAddUserModalOpen(true)
              }}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}
            >
              <UserPlus size={16} />
              {t.addUserBtn}
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: MEMBERS LIST */}
      {activeTab === 'members' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-page)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600 }}>{t.userCol}</th>
                  <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600 }}>{t.roleCol}</th>
                  <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600 }}>{t.permissionsCol}</th>
                  <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600 }}>{t.statusCol}</th>
                  <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>
                    {t.actionsCol}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {isAr ? 'لم يتم العثور على أي مستخدمين مطابقين' : 'No matching members found'}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const isOwner = m.role === 'owner'
                    const isAdmin = m.role === 'administrator'
                    const customPermCount = Array.isArray(m.permissions) ? m.permissions.length : null

                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                        {/* User info */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--color-brand-500), #8b5cf6)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                flexShrink: 0,
                              }}
                            >
                              {m.user.fullName?.charAt(0).toUpperCase() || m.user.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                {m.user.fullName}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {m.user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Base Role */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span
                            className={`badge ${
                              isOwner
                                ? 'badge-primary'
                                : isAdmin
                                ? 'badge-info'
                                : m.role === 'accountant'
                                ? 'badge-success'
                                : 'badge-secondary'
                            }`}
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.625rem' }}
                          >
                            {t.roles[m.role] || m.role}
                          </span>
                        </td>

                        {/* Custom Permissions badge */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          {isOwner || isAdmin ? (
                            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                              <Check size={12} style={{ marginInlineEnd: '0.25rem' }} /> {t.allPermissions}
                            </span>
                          ) : customPermCount !== null ? (
                            <span
                              className="badge badge-info"
                              style={{
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                              onClick={() => handleOpenEditPermissions(m)}
                              title={isAr ? 'انقر لتعديل الصلاحيات' : 'Click to customize'}
                            >
                              <Sliders size={12} /> {t.customCount(customPermCount)}
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                              {isAr ? 'افتراضي حسب الدور' : 'Role Preset'}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span
                            className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                            style={{ fontSize: '0.75rem' }}
                          >
                            {m.status === 'active' ? t.active : t.inactive}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            {/* Manage Permissions */}
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditPermissions(m)}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                                title={t.editPermissions}
                              >
                                <Sliders size={14} />
                                <span>{isAr ? 'الصلاحيات' : 'Permissions'}</span>
                              </button>
                            )}

                            {/* Direct Reset Password */}
                            <button
                              type="button"
                              onClick={() => {
                                setResettingMember(m)
                                setResetPasswordValue(generateRandomPassword())
                                setShowResetPassword(false)
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                              title={t.resetPassword}
                            >
                              <KeyRound size={14} />
                              <span>{isAr ? 'كلمة المرور' : 'Password'}</span>
                            </button>

                            {/* Status toggle */}
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleStatusToggle(m)}
                                className={`btn btn-sm ${m.status === 'active' ? 'btn-secondary' : 'btn-success'}`}
                                style={{ fontSize: '0.75rem' }}
                              >
                                {m.status === 'active' ? t.deactivate : t.activate}
                              </button>
                            )}

                            {/* Remove Member */}
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m)}
                                className="btn btn-danger btn-sm"
                                style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title={t.removeMember}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
      {activeTab === 'matrix' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {isAr ? 'دليل ومصفوفة الصلاحيات الشاملة للنظام' : 'ERP System Permissions & Capabilities Matrix'}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {isAr
                ? 'استعراض كافة الوحدات والعمليات وإمكانية تخصيصها بدقة لكل مستخدم أو دور تشغيلي'
                : 'Complete overview of all modular capabilities that can be assigned and fine-tuned per user'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {SYSTEM_PERMISSIONS_REGISTRY.map((group) => (
              <div
                key={group.moduleId}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  background: 'var(--bg-page)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', color: 'var(--color-brand-500)' }}>
                  {MODULE_ICONS[group.moduleId] || <Shield size={18} />}
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>
                    {isAr ? group.nameAr : isTr ? group.nameTr : group.nameEn}
                  </h4>
                  <span className="badge badge-secondary" style={{ marginInlineStart: 'auto', fontSize: '0.7rem' }}>
                    {group.permissions.length} {isAr ? 'صلاحيات' : 'perms'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {group.permissions.map((p) => (
                    <div
                      key={p.code}
                      style={{
                        padding: '0.625rem 0.75rem',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {isAr ? p.nameAr : isTr ? p.nameTr : p.nameEn}
                        </span>
                        <span
                          style={{
                            fontSize: '0.675rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-page)',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                          }}
                        >
                          {p.code}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        {isAr ? p.descriptionAr : isTr ? p.descriptionTr : p.descriptionEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: DIRECT USER CREATION MODAL                       */}
      {/* ========================================================= */}
      {isAddUserModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '650px',
              width: '95%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <UserPlus size={20} style={{ color: 'var(--color-brand-500)' }} />
                <h3 className="modal-title">{t.addUserBtn}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDirectUser} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  {/* Full Name */}
                  <div>
                    <label className="form-label required">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder={isAr ? 'مثال: سامر العلي' : 'e.g. John Doe'}
                      className="form-control"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="form-label required">{isAr ? 'البريد الإلكتروني (لتسجيل الدخول)' : 'Email Address'}</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@company.com"
                      className="form-control"
                    />
                  </div>
                </div>

                {/* Password with Generator */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <label className="form-label required" style={{ margin: 0 }}>
                      {isAr ? 'كلمة المرور المباشرة' : 'Direct Login Password'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewPassword(generateRandomPassword())}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem' }}
                    >
                      <RefreshCw size={12} /> {isAr ? 'توليد كلمة سر عشوائية' : 'Generate'}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-control"
                      style={{ [isAr ? 'paddingLeft' : 'paddingRight']: '2.5rem', fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        [isAr ? 'left' : 'right']: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isAr
                      ? 'سيتم تفعيل الحساب فوراً بهذا البريد وكلمة المرور دون الحاجة لتأكيد البريد'
                      : 'Account will be activated immediately with this password without email verification'}
                  </span>
                </div>

                {/* Base Role Selector */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label required">{isAr ? 'الدور الأساسي (القالب)' : 'Base Role Template'}</label>
                  <select
                    value={newRole}
                    onChange={(e) => handleNewRoleChange(e.target.value as MemberRole)}
                    className="form-control"
                  >
                    <option value="accountant">{t.roles.accountant}</option>
                    <option value="sales_user">{t.roles.sales_user}</option>
                    <option value="purchase_user">{t.roles.purchase_user}</option>
                    <option value="inventory_user">{t.roles.inventory_user}</option>
                    <option value="viewer">{t.roles.viewer}</option>
                    <option value="administrator">{t.roles.administrator}</option>
                    <option value="custom">{t.roles.custom}</option>
                  </select>
                </div>

                {/* Collapsible Granular Permissions Matrix */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setShowPermissionsInAddModal(!showPermissionsInAddModal)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-page)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sliders size={16} style={{ color: 'var(--color-brand-500)' }} />
                      {isAr ? 'تخصيص الصلاحيات التفصيلية يدوياً' : 'Customize Granular Permissions'}
                    </span>
                    <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                      {newCustomPermissions.length} {isAr ? 'محددة' : 'selected'}
                    </span>
                  </button>

                  {showPermissionsInAddModal && (
                    <div style={{ padding: '1rem', maxHeight: '250px', overflowY: 'auto', background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setNewCustomPermissions([...ALL_PERMISSION_CODES])}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem' }}
                        >
                          {isAr ? 'تحديد الكل' : 'Select All'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewCustomPermissions([])}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem' }}
                        >
                          {isAr ? 'إلغاء التحديد' : 'Deselect All'}
                        </button>
                      </div>

                      {SYSTEM_PERMISSIONS_REGISTRY.map((group) => {
                        const moduleCodes = group.permissions.map((p) => p.code)
                        const allChecked = moduleCodes.every((c) => newCustomPermissions.includes(c))

                        return (
                          <div key={group.moduleId} style={{ marginBottom: '1rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--border-color)',
                                paddingBottom: '0.375rem',
                                marginBottom: '0.5rem',
                              }}
                            >
                              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>
                                {isAr ? group.nameAr : isTr ? group.nameTr : group.nameEn}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleModuleInList(group, newCustomPermissions, setNewCustomPermissions)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                {allChecked ? (isAr ? 'إلغاء الوحدة' : 'Clear') : (isAr ? 'تحديد الوحدة' : 'Select all')}
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.375rem' }}>
                              {group.permissions.map((p) => {
                                const isChecked = newCustomPermissions.includes(p.code)
                                return (
                                  <label
                                    key={p.code}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      padding: '0.25rem',
                                      borderRadius: '4px',
                                      background: isChecked ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePermissionInList(p.code, newCustomPermissions, setNewCustomPermissions)}
                                    />
                                    <span>{isAr ? p.nameAr : isTr ? p.nameTr : p.nameEn}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isPending}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isAr ? 'إنشاء وتفعيل الحساب فوراً' : 'Create & Activate User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDIT CUSTOM PERMISSIONS MODAL                    */}
      {/* ========================================================= */}
      {editingMember && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '750px',
              width: '95%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Sliders size={20} style={{ color: 'var(--color-brand-500)' }} />
                <div>
                  <h3 className="modal-title">
                    {isAr ? `تخصيص صلاحيات المستخدم: ${editingMember.user.fullName}` : `Edit Permissions for ${editingMember.user.fullName}`}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {editingMember.user.email}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="btn btn-secondary btn-sm"
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
              {/* Quick Template Presets */}
              <div style={{ marginBottom: '1.25rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: '8px' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem', fontWeight: 700 }}>
                  {isAr ? 'تطبيق قالب صلاحيات سريع:' : 'Apply Preset Template:'}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(['accountant', 'sales_user', 'purchase_user', 'inventory_user', 'viewer', 'administrator'] as MemberRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setEditPermissionsRole(r)
                        setEditSelectedPermissions([...(ROLE_PRESET_PERMISSIONS[r] || [])])
                      }}
                      className={`btn btn-sm ${editPermissionsRole === r ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {t.roles[r] || r}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditSelectedPermissions([...ALL_PERMISSION_CODES])}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                  >
                    {isAr ? 'تحديد كافة الصلاحيات' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSelectedPermissions([])}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                  >
                    {isAr ? 'إلغاء الكل' : 'Clear'}
                  </button>
                </div>
              </div>

              {/* Modules Matrix */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {SYSTEM_PERMISSIONS_REGISTRY.map((group) => {
                  const moduleCodes = group.permissions.map((p) => p.code)
                  const allChecked = moduleCodes.every((c) => editSelectedPermissions.includes(c))

                  return (
                    <div
                      key={group.moduleId}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '1rem',
                        background: 'var(--bg-surface)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid var(--border-color)',
                          paddingBottom: '0.5rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-brand-500)' }}>
                          {MODULE_ICONS[group.moduleId] || <Shield size={16} />}
                          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                            {isAr ? group.nameAr : isTr ? group.nameTr : group.nameEn}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleModuleInList(group, editSelectedPermissions, setEditSelectedPermissions)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
                        >
                          {allChecked ? (isAr ? 'إلغاء تحديد الوحدة' : 'Deselect Module') : (isAr ? 'تحديد كافة الوحدة' : 'Select Module')}
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                        {group.permissions.map((p) => {
                          const isChecked = editSelectedPermissions.includes(p.code)
                          return (
                            <label
                              key={p.code}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.625rem',
                                padding: '0.5rem 0.625rem',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: isChecked ? 'var(--color-brand-500)' : 'var(--border-color)',
                                background: isChecked ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-page)',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermissionInList(p.code, editSelectedPermissions, setEditSelectedPermissions)}
                                style={{ marginTop: '0.15rem' }}
                              />
                              <div>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {isAr ? p.nameAr : isTr ? p.nameTr : p.nameEn}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {isAr ? p.descriptionAr : isTr ? p.descriptionTr : p.descriptionEn}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="modal-footer">
              <span style={{ marginInlineEnd: 'auto', fontSize: '0.8125rem', fontWeight: 600 }}>
                {isAr ? `الإجمالي المحدد: ${editSelectedPermissions.length} من ${ALL_PERMISSION_CODES.length}` : `Selected: ${editSelectedPermissions.length}/${ALL_PERMISSION_CODES.length}`}
              </span>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="btn btn-secondary"
                disabled={isPending}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="btn btn-primary"
                disabled={isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isPending && <Loader2 size={16} className="animate-spin" />}
                {isAr ? 'حفظ الصلاحيات المخصصة' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DIRECT RESET PASSWORD MODAL                      */}
      {/* ========================================================= */}
      {resettingMember && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <KeyRound size={20} style={{ color: 'var(--color-brand-500)' }} />
                <h3 className="modal-title">{t.resetPassword}</h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingMember(null)}
                className="btn btn-secondary btn-sm"
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {isAr
                  ? `تعيين كلمة مرور جديدة للمستخدم (${resettingMember.user.fullName}) (${resettingMember.user.email}) بشكل مباشر وفوري:`
                  : `Set new direct login password for ${resettingMember.user.fullName}:`}
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <label className="form-label required" style={{ margin: 0 }}>
                    {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordValue(generateRandomPassword())}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem' }}
                  >
                    <RefreshCw size={12} /> {isAr ? 'توليد كلمة سر عشوائية' : 'Generate'}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    className="form-control"
                    style={{ [isAr ? 'paddingLeft' : 'paddingRight']: '2.5rem', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{
                      position: 'absolute',
                      [isAr ? 'left' : 'right']: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setResettingMember(null)}
                className="btn btn-secondary"
                disabled={isPending}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSavePasswordReset}
                className="btn btn-primary"
                disabled={isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isPending && <Loader2 size={16} className="animate-spin" />}
                {isAr ? 'تحديث كلمة المرور فوراً' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
