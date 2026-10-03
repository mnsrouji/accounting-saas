// =============================================================
// Members & Permissions Manager Client Component
// Multi-Tenant SaaS Accounting & ERP Platform
// Supports: Direct User Creation, Dual Permissions Views (Detailed & Matrix), & Direct Password Resets
// =============================================================

'use client'

import React, { useState, useEffect, useTransition, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  PermissionDefinition,
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
  Layers,
  Table,
  List,
  Sparkles,
  HelpCircle,
  LayoutGrid,
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
  sales: <ShoppingCart size={17} />,
  purchases: <ShoppingBag size={17} />,
  customers: <Users size={17} />,
  suppliers: <Truck size={17} />,
  inventory: <Package size={17} />,
  treasury: <Landmark size={17} />,
  accounting: <BookOpen size={17} />,
  expenses: <Receipt size={17} />,
  reports: <BarChart3 size={17} />,
  settings: <Settings size={17} />,
}

const ACTION_COLORS: Record<string, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  view: { bg: 'rgba(59, 130, 246, 0.1)', text: '#2563eb', labelAr: 'عرض واستعلام', labelEn: 'View' },
  create: { bg: 'rgba(16, 185, 129, 0.1)', text: '#059669', labelAr: 'إنشاء وإصدار', labelEn: 'Create' },
  edit: { bg: 'rgba(245, 158, 11, 0.1)', text: '#d97706', labelAr: 'تعديل', labelEn: 'Edit' },
  delete: { bg: 'rgba(239, 68, 68, 0.1)', text: '#dc2626', labelAr: 'حذف وإلغاء', labelEn: 'Delete' },
  manage: { bg: 'rgba(99, 102, 241, 0.1)', text: '#4f46e5', labelAr: 'إدارة شاملة', labelEn: 'Manage' },
  post: { bg: 'rgba(168, 85, 247, 0.1)', text: '#7c3aed', labelAr: 'ترحيل وقفل', labelEn: 'Post & Lock' },
  export: { bg: 'rgba(6, 182, 212, 0.1)', text: '#0891b2', labelAr: 'تصدير وطباعة', labelEn: 'Export' },
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

  // Edit Permissions Modal State
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null)
  const [editPermissionsRole, setEditPermissionsRole] = useState<MemberRole>('accountant')
  const [editSelectedPermissions, setEditSelectedPermissions] = useState<string[]>([])
  const [permActiveModule, setPermActiveModule] = useState<string>('all')
  const [permSearchQuery, setPermSearchQuery] = useState('')
  const [permModalMode, setPermModalMode] = useState<'matrix' | 'detailed'>('matrix') // Dual viewing mode!

  // Direct Reset Password Modal State
  const [resettingMember, setResettingMember] = useState<MemberRow | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [copiedNotification, setCopiedNotification] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
    customCount: (count: number) => isAr ? `${count} صلاحية مفعلة` : isTr ? `${count} özel izin` : `${count} custom perms`,
    allModules: isAr ? 'كافة الوحدات والأنظمة' : isTr ? 'Tüm Modüller' : 'All Modules',
    viewMatrixMode: isAr ? '📊 مصفوفة جدولية سريعة' : isTr ? '📊 Matris Tablosu' : '📊 Matrix Grid',
    viewDetailedMode: isAr ? '📑 قائمة تفصيلية' : isTr ? '📑 Ayrıntılı Liste' : '📑 Detailed List',
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
    setPermActiveModule('all')
    setPermSearchQuery('')

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

  // Toggle all permissions matching an action across entire system
  function toggleActionAcrossSystem(
    actionType: 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'post' | 'export',
    currentList: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    const actionPerms = SYSTEM_PERMISSIONS_REGISTRY.flatMap((g) =>
      g.permissions.filter((p) => p.action === actionType).map((p) => p.code)
    )
    const allChecked = actionPerms.every((c) => currentList.includes(c))
    if (allChecked) {
      setList(currentList.filter((c) => !actionPerms.includes(c)))
    } else {
      setList(Array.from(new Set([...currentList, ...actionPerms])))
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

  // Filtered permission module groups for Edit Modal
  const editModalFilteredGroups = useMemo(() => {
    return SYSTEM_PERMISSIONS_REGISTRY.map((group) => {
      if (permActiveModule !== 'all' && group.moduleId !== permActiveModule) {
        return null
      }
      if (!permSearchQuery.trim()) {
        return group
      }
      const q = permSearchQuery.toLowerCase().trim()
      const matchingPerms = group.permissions.filter(
        (p) =>
          p.nameAr.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.descriptionAr.toLowerCase().includes(q)
      )
      if (matchingPerms.length === 0) return null
      return {
        ...group,
        permissions: matchingPerms,
      }
    }).filter(Boolean) as PermissionModuleGroup[]
  }, [permActiveModule, permSearchQuery])

  return (
    <div>
      {/* Alert Notifications */}
      {successMsg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#065f46',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <CheckCircle2 size={18} color="#10b981" />
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
            <Copy size={13} /> {copiedNotification ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ النص' : 'Copy')}
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#991b1b',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} color="#ef4444" />
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
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
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
                    <td colSpan={5} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600 }}>{isAr ? 'لم يتم العثور على أي مستخدمين مطابقين' : 'No matching members found'}</div>
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
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--color-brand-500, #4f46e5), #8b5cf6)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)',
                              }}
                            >
                              {m.user.fullName?.charAt(0).toUpperCase() || m.user.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
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
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.625rem', fontWeight: 600 }}
                          >
                            {t.roles[m.role] || m.role}
                          </span>
                        </td>

                        {/* Custom Permissions badge */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          {isOwner || isAdmin ? (
                            <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '0.35rem 0.625rem' }}>
                              <Check size={13} style={{ marginInlineEnd: '0.25rem' }} /> {t.allPermissions}
                            </span>
                          ) : customPermCount !== null ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEditPermissions(m)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.625rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                borderColor: 'var(--color-brand-500)',
                                color: 'var(--color-brand-500)',
                              }}
                              title={isAr ? 'انقر لتعديل الصلاحيات' : 'Click to customize'}
                            >
                              <Sliders size={13} />
                              <span>{t.customCount(customPermCount)}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEditPermissions(m)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              {isAr ? 'افتراضي حسب الدور' : 'Role Preset'}
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span
                            className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
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

      {/* TAB 2: ROLES & PERMISSIONS OVERVIEW */}
      {activeTab === 'matrix' && (
        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
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
                  {group.permissions.map((p) => {
                    const actionInfo = ACTION_COLORS[p.action] || ACTION_COLORS.manage
                    return (
                      <div
                        key={p.code}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {isAr ? p.nameAr : isTr ? p.nameTr : p.nameEn}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              background: actionInfo.bg,
                              color: actionInfo.text,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                            }}
                          >
                            {isAr ? actionInfo.labelAr : actionInfo.labelEn}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.35rem 0', lineHeight: 1.4 }}>
                          {isAr ? p.descriptionAr : isTr ? p.descriptionTr : p.descriptionEn}
                        </p>
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
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: DIRECT USER CREATION MODAL                       */}
      {/* ========================================================= */}
      {mounted && isAddUserModalOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: 'calc(100vh - 3rem)',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color, #e2e8f0)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-page)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--color-brand-500)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>{t.addUserBtn}</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isAr ? 'إنشاء حساب مستخدم مباشر وتفعيله فوراً' : 'Create direct user account with immediate access'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDirectUser} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  {/* Full Name */}
                  <div>
                    <label className="form-label required">{isAr ? 'الاسم الكامل للمستخدم' : 'Full Name'}</label>
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
                <div style={{ marginBottom: '1.25rem' }}>
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    {isAr
                      ? '⚡ الحساب سيعمل فوراً دون انتظار أي رسائل تأكيد بريدية'
                      : 'Account activates instantly without needing email confirmation'}
                  </span>
                </div>

                {/* Base Role Selector */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label required">{isAr ? 'الدور الأساسي (القالب الافتراضي)' : 'Base Role Template'}</label>
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
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-page)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  flexShrink: 0,
                }}
              >
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
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isAr ? 'إنشاء وتفعيل الحساب فوراً' : 'Create & Activate User'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DUAL-VIEW CUSTOM PERMISSIONS MANAGER MODAL       */}
      {/* ========================================================= */}
      {mounted && editingMember && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '1120px',
              height: 'calc(100vh - 2.5rem)',
              maxHeight: '92vh',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color, #e2e8f0)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-page)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, var(--color-brand-500, #4f46e5), #8b5cf6)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)',
                    flexShrink: 0,
                  }}
                >
                  <Sliders size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>
                      {isAr ? `تخصيص صلاحيات المستخدم: ${editingMember.user.fullName}` : `Manage Permissions: ${editingMember.user.fullName}`}
                    </h3>
                    <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      {editSelectedPermissions.length} / {ALL_PERMISSION_CODES.length} {isAr ? 'صلاحية مفعلة' : 'active'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                    {editingMember.user.email}
                  </div>
                </div>
              </div>

              {/* View Switcher Toggle & Close Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                {/* Visual View Switcher */}
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-surface, #ffffff)',
                    padding: '0.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPermModalMode('matrix')}
                    className={`btn btn-sm ${permModalMode === 'matrix' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderRadius: '6px',
                    }}
                  >
                    <Table size={14} />
                    <span>{t.viewMatrixMode}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermModalMode('detailed')}
                    className={`btn btn-sm ${permModalMode === 'detailed' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderRadius: '6px',
                    }}
                  >
                    <List size={14} />
                    <span>{t.viewDetailedMode}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Top Toolbar: Quick Presets, View Mode & Search */}
            <div
              style={{
                padding: '0.75rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexShrink: 0,
              }}
            >
              {/* Role Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginInlineEnd: '0.25rem' }}>
                  {isAr ? 'قوالب سريعة:' : 'Presets:'}
                </span>
                {(['accountant', 'sales_user', 'purchase_user', 'inventory_user', 'viewer'] as MemberRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setEditPermissionsRole(r)
                      setEditSelectedPermissions([...(ROLE_PRESET_PERMISSIONS[r] || [])])
                    }}
                    className={`btn btn-sm ${editPermissionsRole === r ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.725rem', padding: '0.25rem 0.55rem', borderRadius: '6px', fontWeight: 600 }}
                  >
                    {t.roles[r] || r}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditSelectedPermissions([...ALL_PERMISSION_CODES])}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.725rem', padding: '0.25rem 0.55rem', borderRadius: '6px', color: '#10b981', fontWeight: 700 }}
                >
                  <Check size={13} style={{ marginInlineEnd: '0.2rem' }} />
                  {isAr ? 'تحديد الكل' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditSelectedPermissions([])}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.725rem', padding: '0.25rem 0.55rem', borderRadius: '6px', color: '#ef4444', fontWeight: 700 }}
                >
                  {isAr ? 'إلغاء الكل' : 'Clear All'}
                </button>
              </div>

              {/* View Switcher In Toolbar (Guarantees 100% visibility) & Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-page)',
                    padding: '0.2rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPermModalMode('matrix')}
                    className={`btn btn-sm ${permModalMode === 'matrix' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      borderRadius: '5px',
                    }}
                  >
                    <Table size={13} />
                    <span>{isAr ? 'مصفوفة' : 'Matrix'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermModalMode('detailed')}
                    className={`btn btn-sm ${permModalMode === 'detailed' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      borderRadius: '5px',
                    }}
                  >
                    <List size={13} />
                    <span>{isAr ? 'تفصيلي' : 'Detailed'}</span>
                  </button>
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      [isAr ? 'right' : 'left']: '0.625rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    placeholder={isAr ? 'تصفية الصلاحيات...' : 'Filter permissions...'}
                    className="form-control"
                    style={{
                      [isAr ? 'paddingRight' : 'paddingLeft']: '2rem',
                      height: '34px',
                      fontSize: '0.75rem',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Body: VIEW 1 — MATRIX GRID TABLE */}
            {permModalMode === 'matrix' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-page)', borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 700, width: '26%' }}>
                            {isAr ? 'الوحدة / النظام' : 'System Module'}
                          </th>
                          <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', width: '12%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span>👁️ {isAr ? 'عرض' : 'View'}</span>
                              <button
                                type="button"
                                onClick={() => toggleActionAcrossSystem('view', editSelectedPermissions, setEditSelectedPermissions)}
                                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700 }}
                              >
                                {isAr ? 'تحديد' : 'Toggle'}
                              </button>
                            </div>
                          </th>
                          <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', width: '12%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span>➕ {isAr ? 'إنشاء' : 'Create'}</span>
                              <button
                                type="button"
                                onClick={() => toggleActionAcrossSystem('create', editSelectedPermissions, setEditSelectedPermissions)}
                                style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700 }}
                              >
                                {isAr ? 'تحديد' : 'Toggle'}
                              </button>
                            </div>
                          </th>
                          <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', width: '12%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span>✏️ {isAr ? 'تعديل' : 'Edit'}</span>
                              <button
                                type="button"
                                onClick={() => toggleActionAcrossSystem('edit', editSelectedPermissions, setEditSelectedPermissions)}
                                style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700 }}
                              >
                                {isAr ? 'تحديد' : 'Toggle'}
                              </button>
                            </div>
                          </th>
                          <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', width: '12%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span>🗑️ {isAr ? 'حذف' : 'Delete'}</span>
                              <button
                                type="button"
                                onClick={() => toggleActionAcrossSystem('delete', editSelectedPermissions, setEditSelectedPermissions)}
                                style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700 }}
                              >
                                {isAr ? 'تحديد' : 'Toggle'}
                              </button>
                            </div>
                          </th>
                          <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', width: '14%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span>⚡ {isAr ? 'إجراءات متقدمة' : 'Advanced'}</span>
                            </div>
                          </th>
                          <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', width: '12%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span>📥 {isAr ? 'تصدير' : 'Export'}</span>
                              <button
                                type="button"
                                onClick={() => toggleActionAcrossSystem('export', editSelectedPermissions, setEditSelectedPermissions)}
                                style={{ background: 'none', border: 'none', color: '#0891b2', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700 }}
                              >
                                {isAr ? 'تحديد' : 'Toggle'}
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {SYSTEM_PERMISSIONS_REGISTRY.map((group) => {
                          const moduleCodes = group.permissions.map((p) => p.code)
                          const allChecked = moduleCodes.every((c) => editSelectedPermissions.includes(c))
                          const enabledCount = moduleCodes.filter((c) => editSelectedPermissions.includes(c)).length

                          // Match perms by action
                          const viewPerm = group.permissions.find((p) => p.action === 'view')
                          const createPerm = group.permissions.find((p) => p.action === 'create')
                          const editPerm = group.permissions.find((p) => p.action === 'edit')
                          const deletePerm = group.permissions.find((p) => p.action === 'delete')
                          const exportPerm = group.permissions.find((p) => p.action === 'export')
                          const advPerms = group.permissions.filter(
                            (p) => p.action === 'manage' || p.action === 'post' || (p.action !== 'view' && p.action !== 'create' && p.action !== 'edit' && p.action !== 'delete' && p.action !== 'export')
                          )

                          return (
                            <tr
                              key={group.moduleId}
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                backgroundColor: enabledCount > 0 ? 'rgba(99, 102, 241, 0.02)' : 'transparent',
                              }}
                              className="table-row-hover"
                            >
                              {/* Module Title & Row Toggle */}
                              <td style={{ padding: '0.875rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    <span style={{ color: 'var(--color-brand-500)' }}>
                                      {MODULE_ICONS[group.moduleId] || <Shield size={16} />}
                                    </span>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                        {isAr ? group.nameAr : isTr ? group.nameTr : group.nameEn}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {enabledCount} من {moduleCodes.length} {isAr ? 'مفعلة' : 'active'}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => toggleModuleInList(group, editSelectedPermissions, setEditSelectedPermissions)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.675rem', padding: '0.15rem 0.45rem', borderRadius: '4px' }}
                                    title={isAr ? 'تحديد / إلغاء تحديد كامل الصف' : 'Toggle entire row'}
                                  >
                                    {allChecked ? (isAr ? 'إلغاء' : 'Clear') : (isAr ? 'تحديد' : 'All')}
                                  </button>
                                </div>
                              </td>

                              {/* View Action Cell */}
                              <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                                {viewPerm ? (
                                  <label
                                    title={`${viewPerm.nameAr} (${viewPerm.code})\n${viewPerm.descriptionAr}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: '0.35rem',
                                      borderRadius: '6px',
                                      background: editSelectedPermissions.includes(viewPerm.code) ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editSelectedPermissions.includes(viewPerm.code)}
                                      onChange={() => togglePermissionInList(viewPerm.code, editSelectedPermissions, setEditSelectedPermissions)}
                                      style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#2563eb' }}
                                    />
                                  </label>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
                                )}
                              </td>

                              {/* Create Action Cell */}
                              <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                                {createPerm ? (
                                  <label
                                    title={`${createPerm.nameAr} (${createPerm.code})\n${createPerm.descriptionAr}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: '0.35rem',
                                      borderRadius: '6px',
                                      background: editSelectedPermissions.includes(createPerm.code) ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editSelectedPermissions.includes(createPerm.code)}
                                      onChange={() => togglePermissionInList(createPerm.code, editSelectedPermissions, setEditSelectedPermissions)}
                                      style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#059669' }}
                                    />
                                  </label>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
                                )}
                              </td>

                              {/* Edit Action Cell */}
                              <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                                {editPerm ? (
                                  <label
                                    title={`${editPerm.nameAr} (${editPerm.code})\n${editPerm.descriptionAr}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: '0.35rem',
                                      borderRadius: '6px',
                                      background: editSelectedPermissions.includes(editPerm.code) ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editSelectedPermissions.includes(editPerm.code)}
                                      onChange={() => togglePermissionInList(editPerm.code, editSelectedPermissions, setEditSelectedPermissions)}
                                      style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#d97706' }}
                                    />
                                  </label>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
                                )}
                              </td>

                              {/* Delete Action Cell */}
                              <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                                {deletePerm ? (
                                  <label
                                    title={`${deletePerm.nameAr} (${deletePerm.code})\n${deletePerm.descriptionAr}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: '0.35rem',
                                      borderRadius: '6px',
                                      background: editSelectedPermissions.includes(deletePerm.code) ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editSelectedPermissions.includes(deletePerm.code)}
                                      onChange={() => togglePermissionInList(deletePerm.code, editSelectedPermissions, setEditSelectedPermissions)}
                                      style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#dc2626' }}
                                    />
                                  </label>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
                                )}
                              </td>

                              {/* Advanced / Post / Manage Actions Cell */}
                              <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                                {advPerms.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    {advPerms.map((ap) => {
                                      const isAct = editSelectedPermissions.includes(ap.code)
                                      return (
                                        <label
                                          key={ap.code}
                                          title={`${ap.nameAr} (${ap.code})\n${ap.descriptionAr}`}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            cursor: 'pointer',
                                            fontSize: '0.6875rem',
                                            fontWeight: 600,
                                            padding: '0.15rem 0.35rem',
                                            borderRadius: '4px',
                                            background: isAct ? 'rgba(168, 85, 247, 0.12)' : 'rgba(100, 116, 139, 0.06)',
                                            color: isAct ? '#7c3aed' : 'var(--text-muted)',
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isAct}
                                            onChange={() => togglePermissionInList(ap.code, editSelectedPermissions, setEditSelectedPermissions)}
                                            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#7c3aed' }}
                                          />
                                          <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ap.nameAr.split(' ')[0]}
                                          </span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
                                )}
                              </td>

                              {/* Export Action Cell */}
                              <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                                {exportPerm ? (
                                  <label
                                    title={`${exportPerm.nameAr} (${exportPerm.code})\n${exportPerm.descriptionAr}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: '0.35rem',
                                      borderRadius: '6px',
                                      background: editSelectedPermissions.includes(exportPerm.code) ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editSelectedPermissions.includes(exportPerm.code)}
                                      onChange={() => togglePermissionInList(exportPerm.code, editSelectedPermissions, setEditSelectedPermissions)}
                                      style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#0891b2' }}
                                    />
                                  </label>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Body: VIEW 2 — DETAILED TWO-COLUMN LIST VIEW */}
            {permModalMode === 'detailed' && (
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar Module Navigation */}
                <div
                  style={{
                    width: '240px',
                    borderInlineEnd: '1px solid var(--border-color)',
                    background: 'var(--bg-page)',
                    overflowY: 'auto',
                    padding: '0.75rem 0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    flexShrink: 0,
                  }}
                >
                  {/* All Modules Tab */}
                  <button
                    type="button"
                    onClick={() => setPermActiveModule('all')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: permActiveModule === 'all' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                      color: permActiveModule === 'all' ? 'var(--color-brand-500)' : 'var(--text-primary)',
                      fontWeight: permActiveModule === 'all' ? 700 : 500,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textAlign: isAr ? 'right' : 'left',
                      width: '100%',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Layers size={16} />
                      <span>{t.allModules}</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '10px',
                        background: permActiveModule === 'all' ? 'var(--color-brand-500)' : 'rgba(100, 116, 139, 0.15)',
                        color: permActiveModule === 'all' ? '#ffffff' : 'var(--text-muted)',
                      }}
                    >
                      {editSelectedPermissions.length}
                    </span>
                  </button>

                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.35rem 0.5rem' }} />

                  {/* Individual Modules */}
                  {SYSTEM_PERMISSIONS_REGISTRY.map((group) => {
                    const moduleCodes = group.permissions.map((p) => p.code)
                    const enabledCount = moduleCodes.filter((c) => editSelectedPermissions.includes(c)).length
                    const isSelected = permActiveModule === group.moduleId
                    const allActive = enabledCount === moduleCodes.length && moduleCodes.length > 0

                    return (
                      <button
                        key={group.moduleId}
                        type="button"
                        onClick={() => setPermActiveModule(group.moduleId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.625rem 0.75rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                          color: isSelected ? 'var(--color-brand-500)' : 'var(--text-primary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          textAlign: isAr ? 'right' : 'left',
                          width: '100%',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                          <span style={{ color: isSelected ? 'var(--color-brand-500)' : 'var(--text-muted)' }}>
                            {MODULE_ICONS[group.moduleId] || <Shield size={16} />}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {isAr ? group.nameAr : isTr ? group.nameTr : group.nameEn}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '10px',
                            background: allActive
                              ? 'rgba(16, 185, 129, 0.15)'
                              : enabledCount > 0
                              ? 'rgba(99, 102, 241, 0.15)'
                              : 'rgba(100, 116, 139, 0.12)',
                            color: allActive
                              ? '#059669'
                              : enabledCount > 0
                              ? 'var(--color-brand-500)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {enabledCount}/{moduleCodes.length}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Main Permissions Detailed Grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                  {editModalFilteredGroups.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Search size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600 }}>{isAr ? 'لا توجد صلاحيات مطابقة للبحث' : 'No matching permissions found'}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {editModalFilteredGroups.map((group) => {
                        const moduleCodes = group.permissions.map((p) => p.code)
                        const allChecked = moduleCodes.every((c) => editSelectedPermissions.includes(c))

                        return (
                          <div
                            key={group.moduleId}
                            style={{
                              border: '1px solid var(--border-color)',
                              borderRadius: '12px',
                              background: 'var(--bg-surface)',
                              overflow: 'hidden',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                            }}
                          >
                            {/* Module Header Bar */}
                            <div
                              style={{
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-page)',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-brand-500)' }}>
                                {MODULE_ICONS[group.moduleId] || <Shield size={18} />}
                                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800 }}>
                                  {isAr ? group.nameAr : isTr ? group.nameTr : group.nameEn}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleModuleInList(group, editSelectedPermissions, setEditSelectedPermissions)}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.725rem', padding: '0.2rem 0.6rem' }}
                              >
                                {allChecked
                                  ? (isAr ? 'إلغاء تحديد الوحدة' : 'Deselect Module')
                                  : (isAr ? 'تحديد كافة الوحدة' : 'Select All')}
                              </button>
                            </div>

                            {/* Permissions Rows */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {group.permissions.map((p, idx) => {
                                const isChecked = editSelectedPermissions.includes(p.code)
                                const actionInfo = ACTION_COLORS[p.action] || ACTION_COLORS.manage

                                return (
                                  <div
                                    key={p.code}
                                    onClick={() => togglePermissionInList(p.code, editSelectedPermissions, setEditSelectedPermissions)}
                                    style={{
                                      padding: '0.875rem 1rem',
                                      borderBottom: idx === group.permissions.length - 1 ? 'none' : '1px solid var(--border-color)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      cursor: 'pointer',
                                      backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                                      transition: 'background-color 0.15s ease',
                                      gap: '1rem',
                                    }}
                                  >
                                    {/* Right side: Checkbox + info */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // Handled by parent div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          marginTop: '0.15rem',
                                          cursor: 'pointer',
                                          accentColor: 'var(--color-brand-500, #4f46e5)',
                                        }}
                                      />
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {isAr ? p.nameAr : isTr ? p.nameTr : p.nameEn}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 700,
                                              background: actionInfo.bg,
                                              color: actionInfo.text,
                                              padding: '0.1rem 0.4rem',
                                              borderRadius: '4px',
                                            }}
                                          >
                                            {isAr ? actionInfo.labelAr : actionInfo.labelEn}
                                          </span>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                                          {isAr ? p.descriptionAr : isTr ? p.descriptionTr : p.descriptionEn}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Left side: Code Badge */}
                                    <span
                                      style={{
                                        fontSize: '0.675rem',
                                        fontFamily: 'monospace',
                                        color: 'var(--text-muted)',
                                        background: 'var(--bg-page)',
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border-color)',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {p.code}
                                    </span>
                                  </div>
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
            )}

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-page)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isAr ? 'الإجمالي المعتمد:' : 'Total Configured:'}
                </span>
                <span className="badge badge-primary" style={{ fontSize: '0.8125rem', padding: '0.3rem 0.6rem', fontWeight: 700 }}>
                  {editSelectedPermissions.length} من {ALL_PERMISSION_CODES.length} {isAr ? 'صلاحية' : 'permissions'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isAr ? 'حفظ واعتماد الصلاحيات' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DIRECT RESET PASSWORD MODAL                      */}
      {/* ========================================================= */}
      {mounted && resettingMember && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
              border: '1px solid var(--border-color, #e2e8f0)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-page)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <KeyRound size={20} style={{ color: 'var(--color-brand-500)' }} />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>{t.resetPassword}</h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingMember(null)}
                className="btn btn-secondary btn-sm"
                style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {isAr
                  ? `تعيين كلمة مرور دخول جديدة للمستخدم (${resettingMember.user.fullName}) (${resettingMember.user.email}) بشكل فوري:`
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
                    style={{ [isAr ? 'paddingLeft' : 'paddingRight']: '2.5rem', fontFamily: 'monospace', fontSize: '0.9375rem' }}
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

            {/* Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-page)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                flexShrink: 0,
              }}
            >
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
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
              >
                {isPending && <Loader2 size={16} className="animate-spin" />}
                {isAr ? 'تحديث كلمة المرور فوراً' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
