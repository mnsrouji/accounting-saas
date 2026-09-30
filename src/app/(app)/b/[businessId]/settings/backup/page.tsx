import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DataManagementService } from '@/lib/services/data-management-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { BackupManagementClient } from './BackupManagementClient'

export const metadata: Metadata = {
  title: 'Backup & Data Management | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function BackupPage({ params }: PageProps) {
  const { businessId } = await params
  const { business } = await requireBusinessAccess(businessId)

  const stats = await DataManagementService.getBusinessDataStats(businessId)

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">النسخ الاحتياطي وإدارة البيانات (Backup & Restore)</h1>
          <p className="page-subtitle">تصدير واستيراد بيانات المنشأة بالكامل، وإدارة وتصفير القيود والعمليات المحاسبية بأمان</p>
        </div>
      </div>

      <SettingsNav businessId={businessId} />

      <BackupManagementClient
        businessId={businessId}
        businessName={business.name}
        currency={business.defaultCurrency}
        initialStats={stats}
      />
    </div>
  )
}
