// =============================================================
// Collections Management Service — AR Workspace & Recovery Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { CrmActivityService } from './crm-activity-service'
import { CrmTaskService } from './crm-task-service'
import { PaymentPromiseService } from './payment-promise-service'
import Decimal from 'decimal.js'

export interface CollectionItem {
  invoiceId: string
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  daysOverdue: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  agingBucket: '0-30' | '31-60' | '61-90' | '90+'
  customerId: string
  customerName: string
  customerCode?: string
  customerPhone?: string
  customerEmail?: string
  assignedCollector?: {
    id: string
    fullName: string
  }
  lastActivity?: {
    id: string
    activityType: string
    activityDate: Date
    subject: string
  }
  nextFollowUpDate?: Date
  paymentPromise?: {
    id: string
    promisedAmount: number
    promiseDate: Date
    status: string
  }
}

export class CollectionsService {
  /**
   * Get complete Collections Workspace items for Accounts Receivable.
   */
  static async getCollectionsWorkspace(
    businessId: string,
    filters?: {
      customerId?: string
      assignedCollectorId?: string
      agingBucket?: string
      minDaysOverdue?: number
    }
  ): Promise<{
    items: CollectionItem[]
    summary: {
      totalOverdueAr: number
      customersOverdueCount: number
      invoicesOverdueCount: number
      agingBuckets: {
        bucket0_30: number
        bucket31_60: number
        bucket61_90: number
        bucket90Plus: number
      }
      brokenPromisesCount: number
      openPromisesCount: number
    }
  }> {
    const now = new Date()

    const overdueInvoices = await prisma.sale.findMany({
      where: {
        businessId,
        customerId: filters?.customerId ? filters.customerId : undefined,
        status: { notIn: ['draft', 'voided', 'cancelled', 'paid'] },
        dueDate: { lt: now },
        balanceDue: { gt: 0 },
      },
      include: {
        customer: {
          include: {
            assignedUser: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    const items: CollectionItem[] = []
    const customerSet = new Set<string>()
    let totalOverdueAr = new Decimal(0)
    let b0_30 = new Decimal(0)
    let b31_60 = new Decimal(0)
    let b61_90 = new Decimal(0)
    let b90Plus = new Decimal(0)

    for (const inv of overdueInvoices) {
      if (!inv.dueDate || !inv.customerId || !inv.customer) continue

      const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))

      if (filters?.minDaysOverdue !== undefined && diffDays < filters.minDaysOverdue) {
        continue
      }

      let agingBucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30'
      if (diffDays > 90) agingBucket = '90+'
      else if (diffDays > 60) agingBucket = '61-90'
      else if (diffDays > 30) agingBucket = '31-60'

      if (filters?.agingBucket && filters.agingBucket !== agingBucket) {
        continue
      }

      if (filters?.assignedCollectorId && inv.customer.assignedUserId !== filters.assignedCollectorId) {
        continue
      }

      const bal = new Decimal(inv.balanceDue)
      totalOverdueAr = totalOverdueAr.plus(bal)
      customerSet.add(inv.customerId)

      if (agingBucket === '0-30') b0_30 = b0_30.plus(bal)
      else if (agingBucket === '31-60') b31_60 = b31_60.plus(bal)
      else if (agingBucket === '61-90') b61_90 = b61_90.plus(bal)
      else b90Plus = b90Plus.plus(bal)

      // Get last activity for this customer / invoice
      const lastActivity = await prisma.crmActivity.findFirst({
        where: {
          businessId,
          customerId: inv.customerId,
        },
        orderBy: { activityDate: 'desc' },
      })

      // Get next open task / follow-up
      const nextTask = await prisma.crmTask.findFirst({
        where: {
          businessId,
          customerId: inv.customerId,
          status: { in: ['open', 'in_progress'] },
          dueDate: { gte: now },
        },
        orderBy: { dueDate: 'asc' },
      })

      // Get latest payment promise
      const latestPromise = await prisma.paymentPromise.findFirst({
        where: {
          businessId,
          customerId: inv.customerId,
          OR: [{ invoiceId: inv.id }, { invoiceId: null }],
        },
        orderBy: { createdAt: 'desc' },
      })

      items.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        daysOverdue: diffDays,
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        outstandingAmount: bal.toNumber(),
        agingBucket,
        customerId: inv.customerId,
        customerName: inv.customer.name,
        customerCode: inv.customer.code || undefined,
        customerPhone: inv.customer.phone || inv.customer.mobile || undefined,
        customerEmail: inv.customer.email || undefined,
        assignedCollector: inv.customer.assignedUser
          ? { id: inv.customer.assignedUser.id, fullName: inv.customer.assignedUser.fullName }
          : undefined,
        lastActivity: lastActivity
          ? {
              id: lastActivity.id,
              activityType: lastActivity.activityType,
              activityDate: lastActivity.activityDate,
              subject: lastActivity.subject,
            }
          : undefined,
        nextFollowUpDate: nextTask?.dueDate,
        paymentPromise: latestPromise
          ? {
              id: latestPromise.id,
              promisedAmount: Number(latestPromise.promisedAmount),
              promiseDate: latestPromise.promiseDate,
              status: latestPromise.status,
            }
          : undefined,
      })
    }

    const [brokenPromisesCount, openPromisesCount] = await Promise.all([
      prisma.paymentPromise.count({ where: { businessId, status: 'broken' } }),
      prisma.paymentPromise.count({ where: { businessId, status: 'open' } }),
    ])

    return {
      items,
      summary: {
        totalOverdueAr: totalOverdueAr.toNumber(),
        customersOverdueCount: customerSet.size,
        invoicesOverdueCount: items.length,
        agingBuckets: {
          bucket0_30: b0_30.toNumber(),
          bucket31_60: b31_60.toNumber(),
          bucket61_90: b61_90.toNumber(),
          bucket90Plus: b90Plus.toNumber(),
        },
        brokenPromisesCount,
        openPromisesCount,
      },
    }
  }

  /**
   * Log a direct collection action from the workspace.
   */
  static async logCollectionAction(
    businessId: string,
    input: {
      customerId: string
      invoiceId?: string
      actionType: 'call' | 'email' | 'whatsapp' | 'note' | 'promise' | 'task'
      subject: string
      notes?: string
      outcome?: string
      dueDate?: Date
      promisedAmount?: number
      promiseDate?: Date
      taskPriority?: 'low' | 'medium' | 'high' | 'urgent'
    },
    userId?: string
  ) {
    if (input.actionType === 'promise' && input.promisedAmount && input.promiseDate) {
      return PaymentPromiseService.createPromise(
        {
          businessId,
          customerId: input.customerId,
          invoiceId: input.invoiceId,
          promisedAmount: input.promisedAmount,
          promiseDate: input.promiseDate,
          notes: input.notes,
          assignedUserId: userId,
        },
        userId
      )
    }

    if (input.actionType === 'task' && input.dueDate) {
      return CrmTaskService.createTask(
        {
          businessId,
          customerId: input.customerId,
          title: input.subject,
          description: input.notes,
          dueDate: input.dueDate,
          priority: input.taskPriority || 'high',
          assignedToId: userId,
          relatedEntityType: 'sale',
          relatedEntityId: input.invoiceId,
        },
        userId
      )
    }

    // Default to logging CRM Activity
    return CrmActivityService.createActivity(
      {
        businessId,
        customerId: input.customerId,
        activityType: input.actionType as any,
        subject: input.subject,
        description: input.notes,
        outcome: input.outcome,
        relatedEntityType: 'sale',
        relatedEntityId: input.invoiceId,
        userId,
      },
      userId
    )
  }
}
