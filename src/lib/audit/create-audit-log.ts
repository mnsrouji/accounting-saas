import { prisma } from '@/lib/db/prisma'
import type { AuditAction } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

interface CreateAuditLogInput {
  businessId?: string
  userId?: string
  action: AuditAction
  module: string
  recordId?: string
  recordType?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  changedFields?: string[]
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

/**
 * Create an audit log entry.
 * Accepts an optional Prisma transaction client (tx) for atomic operations.
 */
export async function createAuditLog(
  input: CreateAuditLogInput,
  tx?: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
): Promise<void> {
  const client = tx ?? prisma

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validRecordId = input.recordId && UUID_REGEX.test(input.recordId) ? input.recordId : undefined
  const mergedNewValues =
    input.recordId && !validRecordId
      ? { ...input.newValues, targetRecordId: input.recordId }
      : input.newValues

  try {
    await (client as PrismaClient).auditLog.create({
      data: {
        businessId: input.businessId && UUID_REGEX.test(input.businessId) ? input.businessId : undefined,
        userId: input.userId && UUID_REGEX.test(input.userId) ? input.userId : undefined,
        action: input.action,
        module: input.module,
        recordId: validRecordId,
        recordType: input.recordType,
        oldValues: input.oldValues as object | undefined,
        newValues: mergedNewValues as object | undefined,
        changedFields: input.changedFields ?? [],
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        sessionId: input.sessionId,
      },
    })
  } catch (error) {
    // Audit log failures should NOT break the main operation.
    // Log the error but don't rethrow.
    console.error('[AuditLog] Failed to write audit log:', error)
  }
}

/**
 * Compute which fields changed between two objects.
 */
export function getChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): string[] {
  const changed: string[] = []
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)])

  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed.push(key)
    }
  }

  return changed
}
