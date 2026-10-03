import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { InvitationService } from '@/lib/services/invitation-service'
import { getLocale } from 'next-intl/server'
import MembersManagerClient from '../settings/members/MembersManagerClient'
import { UserCog } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Users & Roles | AccountFlow',
  description: 'Manage business team members, roles and access permissions',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function UsersAndRolesPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const access = await requireBusinessAccess(businessId, 'settings', 'full')

  const members = await InvitationService.getMembers(businessId)

  const t = {
    title: isAr ? 'المستخدمون والصلاحيات' : isTr ? 'Kullanıcılar ve Roller' : 'Users & Roles',
    subtitle: isAr
      ? 'إضافة المستخدمين المباشرين، تعيين كلمات المرور، وتخصيص مصفوفة الصلاحيات بدقة'
      : isTr
      ? 'Doğrudan kullanıcı ekleme, şifre belirleme ve yetki matrisi özelleştirme'
      : 'Add direct users, set credentials and fine-tune granular access permissions',
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--color-brand-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserCog size={22} />
          </div>
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="page-subtitle">{t.subtitle}</p>
          </div>
        </div>
      </div>

      <MembersManagerClient
        businessId={businessId}
        initialMembers={members as any}
      />
    </div>
  )
}
