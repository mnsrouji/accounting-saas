// =============================================================
// Tenant Members Settings Page — Team & Permissions Control
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { InvitationService } from '@/lib/services/invitation-service'
import { RoleService } from '@/lib/services/role-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { getLocale } from 'next-intl/server'
import MembersManagerClient from './MembersManagerClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Team Members | AccountFlow',
}

interface Props {
  params: Promise<{ businessId: string }>
}

export default async function TenantMembersPage({ params }: Props) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  const [members, roles] = await Promise.all([
    InvitationService.getMembers(businessId),
    RoleService.getRoles(businessId),
  ])

  const t = {
    title: isAr ? 'فريق العمل وإدارة الصلاحيات والأدوار' : isTr ? 'Ekip Üyeleri, Roller ve Yetki Yönetimi' : 'Team Members, Custom Roles & Access Control',
    subtitle: isAr
      ? 'إضافة مستخدمين، تخصيص الصلاحيات بدقة، وإنشاء أدوار وظيفية مخصصة'
      : isTr
      ? 'Kullanıcı ekleme, özel yetkilendirme ve özel roller tanımlama'
      : 'Direct user provisioning, custom roles builder, and granular access control',
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </div>

      <SettingsNav businessId={businessId} />

      <MembersManagerClient
        businessId={businessId}
        initialMembers={members as any}
        initialRoles={roles as any}
      />
    </div>
  )
}
