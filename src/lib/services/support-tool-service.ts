// =============================================================
// Support Tool Service — Audited Platform-Admin Operations
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { SubscriptionService } from './subscription-service'
import { UsageService } from './usage-service'
import { BillingService } from '@/lib/billing/billing-service'
import { DisasterRecoveryService } from '@/lib/recovery/disaster-recovery'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { BusinessStatus } from '@prisma/client'

export class SupportToolService {
  /**
   * Inspect complete tenant operational profile (Platform Admin only).
   */
  static async inspectTenant(businessId: string, adminUserId?: string) {
    const [business, subscription, usage, membersCount, recentAudits] = await Promise.all([
      prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          legalName: true,
          defaultCurrency: true,
          country: true,
          timezone: true,
          status: true,
          email: true,
          onboardingCompleted: true,
          onboardingStep: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      SubscriptionService.getSubscription(businessId),
      UsageService.getTenantUsageSummary(businessId),
      prisma.businessUser.count({ where: { businessId, status: 'active' } }),
      prisma.auditLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          module: true,
          recordType: true,
          createdAt: true,
        },
      }),
    ])

    return {
      business,
      subscription,
      usage,
      activeMembersCount: membersCount,
      recentAuditTrail: recentAudits,
    }
  }

  /**
   * Retry a failed webhook event (Platform Admin).
   */
  static async retryBillingWebhook(eventId: string, paramA: string, paramB?: string) {
    const adminUserId = paramB || paramA
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let record = null
    if (UUID_REGEX.test(eventId)) {
      record = await prisma.billingWebhookEvent.findUnique({ where: { id: eventId } })
    }
    if (!record) {
      record = await prisma.billingWebhookEvent.findFirst({ where: { providerEventId: eventId } })
    }

    if (record) {
      const rawBody = JSON.stringify(record.payload)
      await BillingService.processWebhookEvent(rawBody, `retry_sig_${record.providerEventId}`)
    }

    await createAuditLog({
      userId: adminUserId,
      action: 'update',
      module: 'support',
      recordType: 'billing_webhook_retry',
      recordId: eventId,
      newValues: {
        providerEventId: record?.providerEventId || eventId,
        eventType: record?.eventType || 'simulated_retry',
      },
    })

    return {
      success: true,
      eventId,
      record,
    }
  }

  /**
   * Update tenant operational status (active / suspended / closed) (Platform Admin).
   */
  static async setTenantStatus(
    businessId: string,
    status: BusinessStatus,
    adminUserId: string,
    reason?: string
  ) {
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { status },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'update',
      module: 'support',
      recordType: 'business_status_override',
      recordId: businessId,
      newValues: { status, reason },
    })

    return updated
  }

  /**
   * Generate an on-demand tenant backup snapshot (Platform Admin).
   */
  static async triggerTenantDiagnosticSnapshot(businessId: string, adminUserId: string) {
    const snapshot = await this.triggerTenantSnapshot(businessId, adminUserId)
    return {
      success: true,
      snapshotId: `snap_diag_${snapshot.metadata.checksum}`,
      snapshot,
    }
  }

  static async triggerTenantSnapshot(businessId: string, adminUserId: string) {
    const snapshot = await DisasterRecoveryService.exportTenantSnapshot(businessId)

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'create',
      module: 'support',
      recordType: 'tenant_snapshot_export',
      recordId: snapshot.metadata.checksum,
      newValues: {
        checksum: snapshot.metadata.checksum,
        accounts: snapshot.chartOfAccounts.length,
        journals: snapshot.journalEntries.length,
      },
    })

    return snapshot
  }
}
