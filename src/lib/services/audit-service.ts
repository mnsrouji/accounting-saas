// =============================================================
// Audit Service — Enterprise Audit Trail Logging
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { AuditAction } from '@prisma/client'

export interface LogAuditInput {
  businessId: string
  userId?: string
  entityType: string
  entityId?: string
  action: string
  changes?: Record<string, any>
  oldData?: Record<string, any>
  newData?: Record<string, any>
  newValues?: Record<string, any>
  oldValues?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export class AuditService {
  /**
   * Log an audit event.
   */
  static async log(input: LogAuditInput, tx?: any): Promise<void> {
    const client = tx ?? prisma
    try {
      // Map arbitrary string actions to closest AuditAction enum if available
      let auditAction: AuditAction = AuditAction.create
      const act = input.action.toLowerCase()
      if (act.includes('update') || act.includes('change') || act.includes('approve') || act.includes('confirm')) {
        auditAction = AuditAction.update
      } else if (act.includes('delete') || act.includes('cancel')) {
        auditAction = AuditAction.delete
      } else if (act.includes('post') || act.includes('convert')) {
        auditAction = AuditAction.post
      }

      await client.auditLog.create({
        data: {
          businessId: input.businessId,
          userId: input.userId,
          action: auditAction,
          module: input.entityType,
          recordId: input.entityId,
          recordType: input.entityType,
          oldValues: input.oldData || undefined,
          newValues: input.newData || input.changes || undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      })
    } catch (err) {
      console.warn('[AuditService] Failed to write audit event:', err)
    }
  }
}
