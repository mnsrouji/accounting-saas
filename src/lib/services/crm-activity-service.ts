// =============================================================
// CRM Activity Service — Communications, Meetings & Notes Log
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import {
  createCrmActivitySchema,
  updateCrmActivitySchema,
  CreateCrmActivityInput,
  UpdateCrmActivityInput,
} from '@/lib/validations/crm-schemas'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'

export class CrmActivityService {
  /**
   * Log a new CRM Activity.
   */
  static async createActivity(input: CreateCrmActivityInput, userId?: string) {
    const validated = createCrmActivitySchema.parse(input)
    const effectiveUserId = validated.userId || userId || null

    if (validated.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: validated.customerId, businessId: validated.businessId, deletedAt: null },
      })
      if (!customer) throw new TenantAccessDeniedError('Customer')
    }

    if (validated.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: validated.supplierId, businessId: validated.businessId, deletedAt: null },
      })
      if (!supplier) throw new TenantAccessDeniedError('Supplier')
    }

    const activity = await prisma.crmActivity.create({
      data: {
        businessId: validated.businessId,
        customerId: validated.customerId || null,
        supplierId: validated.supplierId || null,
        customerContactId: validated.customerContactId || null,
        supplierContactId: validated.supplierContactId || null,
        opportunityId: validated.opportunityId || null,
        activityType: validated.activityType,
        subject: validated.subject,
        description: validated.description || null,
        activityDate: validated.activityDate,
        dueDate: validated.dueDate || null,
        status: validated.status || 'completed',
        outcome: validated.outcome || null,
        relatedEntityType: validated.relatedEntityType || null,
        relatedEntityId: validated.relatedEntityId || null,
        userId: effectiveUserId,
      },
      include: {
        customer: true,
        supplier: true,
        customerContact: true,
        supplierContact: true,
        opportunity: true,
        user: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: effectiveUserId || undefined,
      entityType: 'crm_activity',
      entityId: activity.id,
      action: 'create',
      newData: activity,
    })

    return activity
  }

  /**
   * Update an existing CRM Activity.
   */
  static async updateActivity(input: UpdateCrmActivityInput, userId?: string) {
    const validated = updateCrmActivitySchema.parse(input)

    const existing = await prisma.crmActivity.findFirst({
      where: { id: validated.id, businessId: validated.businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('CrmActivity')

    const updated = await prisma.crmActivity.update({
      where: { id: validated.id },
      data: {
        activityType: validated.activityType !== undefined ? validated.activityType : undefined,
        subject: validated.subject !== undefined ? validated.subject : undefined,
        description: validated.description !== undefined ? validated.description : undefined,
        activityDate: validated.activityDate !== undefined ? validated.activityDate : undefined,
        dueDate: validated.dueDate !== undefined ? validated.dueDate : undefined,
        status: validated.status !== undefined ? validated.status : undefined,
        outcome: validated.outcome !== undefined ? validated.outcome : undefined,
        customerContactId: validated.customerContactId !== undefined ? validated.customerContactId : undefined,
        supplierContactId: validated.supplierContactId !== undefined ? validated.supplierContactId : undefined,
        opportunityId: validated.opportunityId !== undefined ? validated.opportunityId : undefined,
        relatedEntityType: validated.relatedEntityType !== undefined ? validated.relatedEntityType : undefined,
        relatedEntityId: validated.relatedEntityId !== undefined ? validated.relatedEntityId : undefined,
      },
      include: {
        customer: true,
        supplier: true,
        customerContact: true,
        supplierContact: true,
        opportunity: true,
        user: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'crm_activity',
      entityId: updated.id,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  /**
   * Delete a CRM activity.
   */
  static async deleteActivity(businessId: string, activityId: string, userId?: string) {
    const existing = await prisma.crmActivity.findFirst({
      where: { id: activityId, businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('CrmActivity')

    await prisma.crmActivity.delete({
      where: { id: activityId },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'crm_activity',
      entityId: activityId,
      action: 'delete',
      oldData: existing,
    })

    return { success: true }
  }

  /**
   * Query activities for a business with flexible filters.
   */
  static async getActivities(
    businessId: string,
    filters?: {
      customerId?: string
      supplierId?: string
      opportunityId?: string
      activityType?: string
      userId?: string
      status?: string
      startDate?: Date
      endDate?: Date
      limit?: number
    }
  ) {
    const where: any = { businessId }

    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.supplierId) where.supplierId = filters.supplierId
    if (filters?.opportunityId) where.opportunityId = filters.opportunityId
    if (filters?.activityType) where.activityType = filters.activityType
    if (filters?.userId) where.userId = filters.userId
    if (filters?.status) where.status = filters.status
    if (filters?.startDate || filters?.endDate) {
      where.activityDate = {}
      if (filters.startDate) where.activityDate.gte = filters.startDate
      if (filters.endDate) where.activityDate.lte = filters.endDate
    }

    return prisma.crmActivity.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
        customerContact: { select: { id: true, name: true, email: true, phone: true } },
        supplierContact: { select: { id: true, name: true, email: true, phone: true } },
        opportunity: { select: { id: true, name: true, stage: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { activityDate: 'desc' },
      take: filters?.limit || 100,
    })
  }

  /**
   * Get complete chronological activity timeline for customer or supplier.
   */
  static async getActivityTimeline(
    businessId: string,
    params: { customerId?: string; supplierId?: string; limit?: number }
  ) {
    return this.getActivities(businessId, {
      customerId: params.customerId,
      supplierId: params.supplierId,
      limit: params.limit || 50,
    })
  }
}
