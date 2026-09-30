// =============================================================
// Sales Opportunity Service — CRM Pipeline & Stage Management
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  CreateOpportunityInput,
  UpdateOpportunityInput,
} from '@/lib/validations/crm-schemas'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'
import Decimal from 'decimal.js'

export class OpportunityService {
  /**
   * Create a new sales opportunity.
   */
  static async createOpportunity(input: CreateOpportunityInput, userId?: string) {
    const validated = createOpportunitySchema.parse(input)
    const effectiveUserId = validated.assignedUserId || userId || null

    if (validated.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: validated.customerId, businessId: validated.businessId, deletedAt: null },
      })
      if (!customer) throw new TenantAccessDeniedError('Customer')
    }

    if (validated.quotationId) {
      const quotation = await prisma.quotation.findFirst({
        where: { id: validated.quotationId, businessId: validated.businessId },
      })
      if (!quotation) throw new TenantAccessDeniedError('Quotation')
    }

    if (validated.salesOrderId) {
      const salesOrder = await prisma.salesOrder.findFirst({
        where: { id: validated.salesOrderId, businessId: validated.businessId },
      })
      if (!salesOrder) throw new TenantAccessDeniedError('SalesOrder')
    }

    const opportunity = await prisma.salesOpportunity.create({
      data: {
        businessId: validated.businessId,
        customerId: validated.customerId || null,
        name: validated.name,
        expectedValue: new Decimal(validated.expectedValue || 0),
        currency: validated.currency || 'USD',
        probability: validated.probability !== undefined ? validated.probability : 50,
        stage: validated.stage || 'lead',
        expectedClosingDate: validated.expectedClosingDate ? new Date(validated.expectedClosingDate) : null,
        source: validated.source || null,
        assignedUserId: effectiveUserId,
        lostReason: validated.lostReason || null,
        nextAction: validated.nextAction || null,
        nextActionDate: validated.nextActionDate ? new Date(validated.nextActionDate) : null,
        notes: validated.notes || null,
        quotationId: validated.quotationId || null,
        salesOrderId: validated.salesOrderId || null,
      },
      include: {
        customer: true,
        assignedUser: true,
        quotation: true,
        salesOrder: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: effectiveUserId || undefined,
      entityType: 'sales_opportunity',
      entityId: opportunity.id,
      action: 'create',
      newData: opportunity,
    })

    return opportunity
  }

  /**
   * Update an existing opportunity.
   */
  static async updateOpportunity(input: UpdateOpportunityInput, userId?: string) {
    const validated = updateOpportunitySchema.parse(input)

    const existing = await prisma.salesOpportunity.findFirst({
      where: { id: validated.id, businessId: validated.businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('SalesOpportunity')

    const isStageChange = validated.stage && validated.stage !== existing.stage
    const isClosing = validated.stage === 'won' || validated.stage === 'lost'

    const updated = await prisma.salesOpportunity.update({
      where: { id: validated.id },
      data: {
        name: validated.name !== undefined ? validated.name : undefined,
        customerId: validated.customerId !== undefined ? validated.customerId : undefined,
        expectedValue: validated.expectedValue !== undefined ? new Decimal(validated.expectedValue) : undefined,
        currency: validated.currency !== undefined ? validated.currency : undefined,
        probability: validated.probability !== undefined ? validated.probability : undefined,
        stage: validated.stage !== undefined ? validated.stage : undefined,
        expectedClosingDate: validated.expectedClosingDate !== undefined ? (validated.expectedClosingDate ? new Date(validated.expectedClosingDate) : null) : undefined,
        actualClosingDate: isClosing ? new Date() : validated.actualClosingDate !== undefined ? (validated.actualClosingDate ? new Date(validated.actualClosingDate) : null) : undefined,
        source: validated.source !== undefined ? validated.source : undefined,
        assignedUserId: validated.assignedUserId !== undefined ? validated.assignedUserId : undefined,
        lostReason: validated.lostReason !== undefined ? validated.lostReason : undefined,
        nextAction: validated.nextAction !== undefined ? validated.nextAction : undefined,
        nextActionDate: validated.nextActionDate !== undefined ? (validated.nextActionDate ? new Date(validated.nextActionDate) : null) : undefined,
        notes: validated.notes !== undefined ? validated.notes : undefined,
        quotationId: validated.quotationId !== undefined ? validated.quotationId : undefined,
        salesOrderId: validated.salesOrderId !== undefined ? validated.salesOrderId : undefined,
      },
      include: {
        customer: true,
        assignedUser: true,
        quotation: true,
        salesOrder: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'sales_opportunity',
      entityId: updated.id,
      action: isStageChange ? `stage_change_${validated.stage}` : 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  /**
   * Link an opportunity to an existing Quotation.
   */
  static async linkQuotation(businessId: string, opportunityId: string, quotationId: string, userId?: string) {
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, businessId },
    })
    if (!quotation) throw new TenantAccessDeniedError('Quotation')

    return this.updateOpportunity({
      id: opportunityId,
      businessId,
      quotationId,
      stage: 'proposal',
      expectedValue: quotation.grandTotal.toNumber(),
    }, userId)
  }

  /**
   * Link an opportunity to an existing Sales Order.
   */
  static async linkSalesOrder(businessId: string, opportunityId: string, salesOrderId: string, userId?: string) {
    const order = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, businessId },
    })
    if (!order) throw new TenantAccessDeniedError('SalesOrder')

    return this.updateOpportunity({
      id: opportunityId,
      businessId,
      salesOrderId,
      stage: 'won',
      expectedValue: order.grandTotal.toNumber(),
      probability: 100,
    }, userId)
  }

  /**
   * Get opportunities with pipeline metrics.
   */
  static async getOpportunities(
    businessId: string,
    filters?: {
      customerId?: string
      assignedUserId?: string
      stage?: string
      limit?: number
    }
  ) {
    const where: any = { businessId }
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.assignedUserId) where.assignedUserId = filters.assignedUserId
    if (filters?.stage) where.stage = filters.stage

    return prisma.salesOpportunity.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        assignedUser: { select: { id: true, fullName: true, email: true } },
        quotation: { select: { id: true, quotationNumber: true, grandTotal: true, status: true } },
        salesOrder: { select: { id: true, orderNumber: true, grandTotal: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    })
  }

  /**
   * Compute CRM Pipeline Metrics (Total, Weighted, By Stage).
   */
  static async getPipelineMetrics(businessId: string, assignedUserId?: string) {
    const where: any = { businessId }
    if (assignedUserId) where.assignedUserId = assignedUserId

    const opportunities = await prisma.salesOpportunity.findMany({
      where,
    })

    let totalPipelineValue = new Decimal(0)
    let weightedPipelineValue = new Decimal(0)
    let openCount = 0
    let wonCount = 0
    let lostCount = 0
    let wonValue = new Decimal(0)

    const stageBreakdown: Record<string, { count: number; totalValue: Decimal; weightedValue: Decimal }> = {
      lead: { count: 0, totalValue: new Decimal(0), weightedValue: new Decimal(0) },
      qualified: { count: 0, totalValue: new Decimal(0), weightedValue: new Decimal(0) },
      proposal: { count: 0, totalValue: new Decimal(0), weightedValue: new Decimal(0) },
      negotiation: { count: 0, totalValue: new Decimal(0), weightedValue: new Decimal(0) },
      won: { count: 0, totalValue: new Decimal(0), weightedValue: new Decimal(0) },
      lost: { count: 0, totalValue: new Decimal(0), weightedValue: new Decimal(0) },
    }

    for (const opp of opportunities) {
      const val = new Decimal(opp.expectedValue || 0)
      const prob = opp.probability || 0
      const weighted = val.mul(prob).div(100)

      if (!stageBreakdown[opp.stage]) {
        stageBreakdown[opp.stage] = { count: 0, totalValue: new Decimal(0), weightedValue: new Decimal(0) }
      }

      stageBreakdown[opp.stage].count += 1
      stageBreakdown[opp.stage].totalValue = stageBreakdown[opp.stage].totalValue.plus(val)
      stageBreakdown[opp.stage].weightedValue = stageBreakdown[opp.stage].weightedValue.plus(weighted)

      if (opp.stage === 'won') {
        wonCount += 1
        wonValue = wonValue.plus(val)
      } else if (opp.stage === 'lost') {
        lostCount += 1
      } else {
        openCount += 1
        totalPipelineValue = totalPipelineValue.plus(val)
        weightedPipelineValue = weightedPipelineValue.plus(weighted)
      }
    }

    const totalClosed = wonCount + lostCount
    const winRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0

    return {
      totalOpportunities: opportunities.length,
      openCount,
      wonCount,
      lostCount,
      winRate: Math.round(winRate * 10) / 10,
      totalPipelineValue: totalPipelineValue.toNumber(),
      weightedPipelineValue: weightedPipelineValue.toNumber(),
      wonValue: wonValue.toNumber(),
      stageBreakdown: Object.entries(stageBreakdown).map(([stage, data]) => ({
        stage,
        count: data.count,
        totalValue: data.totalValue.toNumber(),
        weightedValue: data.weightedValue.toNumber(),
      })),
    }
  }
}
