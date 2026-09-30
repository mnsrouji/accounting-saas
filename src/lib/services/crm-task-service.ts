// =============================================================
// CRM Task & Follow-up Service — Task Management & Workflows
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import {
  createCrmTaskSchema,
  updateCrmTaskSchema,
  CreateCrmTaskInput,
  UpdateCrmTaskInput,
} from '@/lib/validations/crm-schemas'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'

export class CrmTaskService {
  /**
   * Create a new CRM Task.
   */
  static async createTask(input: CreateCrmTaskInput, userId?: string) {
    const validated = createCrmTaskSchema.parse(input)
    const effectiveCreatedBy = validated.createdById || userId || null

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

    const task = await prisma.crmTask.create({
      data: {
        businessId: validated.businessId,
        customerId: validated.customerId || null,
        supplierId: validated.supplierId || null,
        opportunityId: validated.opportunityId || null,
        title: validated.title,
        description: validated.description || null,
        dueDate: validated.dueDate,
        priority: validated.priority || 'medium',
        status: validated.status || 'open',
        reminderAt: validated.reminderAt || null,
        relatedEntityType: validated.relatedEntityType || null,
        relatedEntityId: validated.relatedEntityId || null,
        assignedToId: validated.assignedToId || null,
        createdById: effectiveCreatedBy,
      },
      include: {
        customer: true,
        supplier: true,
        opportunity: true,
        assignedTo: true,
        creator: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: effectiveCreatedBy || undefined,
      entityType: 'crm_task',
      entityId: task.id,
      action: 'create',
      newData: task,
    })

    return task
  }

  /**
   * Update an existing CRM Task.
   */
  static async updateTask(input: UpdateCrmTaskInput, userId?: string) {
    const validated = updateCrmTaskSchema.parse(input)

    const existing = await prisma.crmTask.findFirst({
      where: { id: validated.id, businessId: validated.businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('CrmTask')

    const isCompleting = validated.status === 'completed' && existing.status !== 'completed'

    const updated = await prisma.crmTask.update({
      where: { id: validated.id },
      data: {
        title: validated.title !== undefined ? validated.title : undefined,
        description: validated.description !== undefined ? validated.description : undefined,
        dueDate: validated.dueDate !== undefined ? validated.dueDate : undefined,
        priority: validated.priority !== undefined ? validated.priority : undefined,
        status: validated.status !== undefined ? validated.status : undefined,
        reminderAt: validated.reminderAt !== undefined ? validated.reminderAt : undefined,
        completedAt: isCompleting ? new Date() : validated.status && validated.status !== 'completed' ? null : undefined,
        assignedToId: validated.assignedToId !== undefined ? validated.assignedToId : undefined,
        relatedEntityType: validated.relatedEntityType !== undefined ? validated.relatedEntityType : undefined,
        relatedEntityId: validated.relatedEntityId !== undefined ? validated.relatedEntityId : undefined,
      },
      include: {
        customer: true,
        supplier: true,
        opportunity: true,
        assignedTo: true,
        creator: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'crm_task',
      entityId: updated.id,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  /**
   * Transition task status.
   */
  static async updateTaskStatus(
    businessId: string,
    taskId: string,
    status: 'open' | 'in_progress' | 'completed' | 'cancelled',
    userId?: string
  ) {
    return this.updateTask({ id: taskId, businessId, status }, userId)
  }

  /**
   * Get tasks with flexible filtering.
   */
  static async getTasks(
    businessId: string,
    filters?: {
      customerId?: string
      supplierId?: string
      opportunityId?: string
      assignedToId?: string
      status?: string
      priority?: string
      isOverdue?: boolean
      limit?: number
    }
  ) {
    const where: any = { businessId }

    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.supplierId) where.supplierId = filters.supplierId
    if (filters?.opportunityId) where.opportunityId = filters.opportunityId
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId
    if (filters?.status) where.status = filters.status
    if (filters?.priority) where.priority = filters.priority
    if (filters?.isOverdue) {
      where.dueDate = { lt: new Date() }
      where.status = { notIn: ['completed', 'cancelled'] }
    }

    return prisma.crmTask.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
        opportunity: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: filters?.limit || 100,
    })
  }

  /**
   * Get overdue tasks for dashboard alerts.
   */
  static async getOverdueTasks(businessId: string, assignedToId?: string) {
    return this.getTasks(businessId, {
      assignedToId,
      isOverdue: true,
    })
  }
}
