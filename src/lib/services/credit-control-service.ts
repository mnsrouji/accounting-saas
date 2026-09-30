// =============================================================
// Credit Control Service — Exposure, Rules & Override Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import {
  createCreditOverrideSchema,
  creditControlConfigSchema,
  CreateCreditOverrideInput,
  CreditControlConfigInput,
} from '@/lib/validations/crm-schemas'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'
import Decimal from 'decimal.js'
import { SalesOrderStatus } from '@prisma/client'

export interface CustomerCreditMetrics {
  customerId: string
  customerName: string
  creditLimit: number
  currentBalance: number
  openOrdersAmount: number
  currentExposure: number
  overdueExposure: number
  availableCredit: number
  utilizationPercent: number
  creditStatus: 'normal' | 'warning' | 'blocked'
  isOverdue: boolean
  oldestOverdueDays: number
  activeOverridesCount: number
}

export class CreditControlService {
  /**
   * Calculate comprehensive credit metrics and exposure for a customer.
   */
  static async getCreditMetrics(businessId: string, customerId: string): Promise<CustomerCreditMetrics> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
      include: {
        customerGroup: true,
      },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    const creditLimitDecimal = customer.creditLimit
      ? new Decimal(customer.creditLimit)
      : customer.customerGroup?.creditLimit
      ? new Decimal(customer.customerGroup.creditLimit)
      : new Decimal(0)

    const currentBalance = new Decimal(customer.balance || 0)

    // Calculate un-invoiced open sales orders total for this customer
    const openOrders = await prisma.salesOrder.findMany({
      where: {
        businessId,
        customerId,
        status: { in: [SalesOrderStatus.confirmed, SalesOrderStatus.processing] },
      },
      select: {
        grandTotal: true,
      },
    })

    const openOrdersAmount = openOrders.reduce(
      (acc, order) => acc.plus(new Decimal(order.grandTotal)),
      new Decimal(0)
    )

    const currentExposure = currentBalance.plus(openOrdersAmount)

    // Calculate overdue exposure and oldest overdue days from posted sales invoices
    const now = new Date()
    const overdueInvoices = await prisma.sale.findMany({
      where: {
        businessId,
        customerId,
        status: { notIn: ['draft', 'voided', 'cancelled', 'paid'] },
        dueDate: { lt: now },
        balanceDue: { gt: 0 },
      },
      select: {
        balanceDue: true,
        dueDate: true,
      },
    })

    let overdueExposure = new Decimal(0)
    let oldestOverdueDays = 0

    for (const inv of overdueInvoices) {
      overdueExposure = overdueExposure.plus(new Decimal(inv.balanceDue))
      if (inv.dueDate) {
        const diffDays = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays > oldestOverdueDays) {
          oldestOverdueDays = diffDays
        }
      }
    }

    const availableCredit = creditLimitDecimal.gt(0)
      ? Decimal.max(0, creditLimitDecimal.minus(currentExposure))
      : new Decimal(0)

    const utilizationPercent = creditLimitDecimal.gt(0)
      ? currentExposure.div(creditLimitDecimal).mul(100).toNumber()
      : currentExposure.gt(0)
      ? 100
      : 0

    // Determine status
    let calculatedStatus: 'normal' | 'warning' | 'blocked' = 'normal'
    if (customer.creditStatus === 'blocked') {
      calculatedStatus = 'blocked'
    } else if (creditLimitDecimal.gt(0) && currentExposure.gt(creditLimitDecimal)) {
      calculatedStatus = 'blocked'
    } else if (overdueExposure.gt(0) || utilizationPercent >= 80) {
      calculatedStatus = 'warning'
    }

    // Count active valid overrides
    const activeOverrides = await prisma.creditOverride.count({
      where: {
        businessId,
        customerId,
        status: 'approved',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    })

    return {
      customerId: customer.id,
      customerName: customer.name,
      creditLimit: creditLimitDecimal.toNumber(),
      currentBalance: currentBalance.toNumber(),
      openOrdersAmount: openOrdersAmount.toNumber(),
      currentExposure: currentExposure.toNumber(),
      overdueExposure: overdueExposure.toNumber(),
      availableCredit: availableCredit.toNumber(),
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      creditStatus: calculatedStatus,
      isOverdue: overdueExposure.gt(0),
      oldestOverdueDays,
      activeOverridesCount: activeOverrides,
    }
  }

  /**
   * Validate if a Sales Order is allowed to be confirmed under credit policy.
   */
  static async validateSalesOrderCredit(
    businessId: string,
    customerId: string,
    orderAmount: number | Decimal,
    authorizedOverrideId?: string
  ): Promise<{
    allowed: boolean
    reason?: string
    requiresOverride: boolean
    currentExposure: number
    newExposure: number
    creditLimit: number
    overrideApplied?: boolean
  }> {
    const metrics = await this.getCreditMetrics(businessId, customerId)
    const amountDec = new Decimal(orderAmount)
    const newExposure = new Decimal(metrics.currentExposure).plus(amountDec)

    // Check if customer is hard blocked
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { creditStatus: true, creditBlockReason: true },
    })

    if (customer?.creditStatus === 'blocked') {
      if (authorizedOverrideId) {
        const override = await this.validateAndConsumeOverride(businessId, customerId, authorizedOverrideId)
        if (override) {
          return {
            allowed: true,
            requiresOverride: false,
            currentExposure: metrics.currentExposure,
            newExposure: newExposure.toNumber(),
            creditLimit: metrics.creditLimit,
            overrideApplied: true,
          }
        }
      }
      return {
        allowed: false,
        reason: customer.creditBlockReason || 'Customer account is placed on credit hold (Blocked)',
        requiresOverride: true,
        currentExposure: metrics.currentExposure,
        newExposure: newExposure.toNumber(),
        creditLimit: metrics.creditLimit,
      }
    }

    // Check business credit control config
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { creditControlConfig: true },
    })
    const config = (business?.creditControlConfig as any) || {
      blockOnCreditLimitExceeded: true,
      blockOnOverdueInvoices: true,
    }

    // Check credit limit violation
    if (metrics.creditLimit > 0 && newExposure.gt(metrics.creditLimit) && config.blockOnCreditLimitExceeded) {
      if (authorizedOverrideId) {
        const override = await this.validateAndConsumeOverride(businessId, customerId, authorizedOverrideId)
        if (override) {
          return {
            allowed: true,
            requiresOverride: false,
            currentExposure: metrics.currentExposure,
            newExposure: newExposure.toNumber(),
            creditLimit: metrics.creditLimit,
            overrideApplied: true,
          }
        }
      }

      return {
        allowed: false,
        reason: `Credit limit exceeded. Limit: $${metrics.creditLimit.toFixed(2)}, Projected Exposure: $${newExposure.toFixed(2)}`,
        requiresOverride: true,
        currentExposure: metrics.currentExposure,
        newExposure: newExposure.toNumber(),
        creditLimit: metrics.creditLimit,
      }
    }

    // Check overdue invoices policy
    if (metrics.overdueExposure > 0 && config.blockOnOverdueInvoices && metrics.oldestOverdueDays > (config.maxOverdueDaysAllowed || 30)) {
      if (authorizedOverrideId) {
        const override = await this.validateAndConsumeOverride(businessId, customerId, authorizedOverrideId)
        if (override) {
          return {
            allowed: true,
            requiresOverride: false,
            currentExposure: metrics.currentExposure,
            newExposure: newExposure.toNumber(),
            creditLimit: metrics.creditLimit,
            overrideApplied: true,
          }
        }
      }

      return {
        allowed: false,
        reason: `Customer has overdue unpaid invoices totaling $${metrics.overdueExposure.toFixed(2)} (Overdue for ${metrics.oldestOverdueDays} days)`,
        requiresOverride: true,
        currentExposure: metrics.currentExposure,
        newExposure: newExposure.toNumber(),
        creditLimit: metrics.creditLimit,
      }
    }

    return {
      allowed: true,
      requiresOverride: false,
      currentExposure: metrics.currentExposure,
      newExposure: newExposure.toNumber(),
      creditLimit: metrics.creditLimit,
    }
  }

  /**
   * Create an authorized Credit Override record.
   */
  static async createCreditOverride(input: CreateCreditOverrideInput, authorizerUserId: string) {
    const validated = createCreditOverrideSchema.parse({
      ...input,
      authorizedBy: input.authorizedBy || authorizerUserId,
    })
    const effectiveAuthorizer = validated.authorizedBy || authorizerUserId

    const customer = await prisma.customer.findFirst({
      where: { id: validated.customerId, businessId: validated.businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    const authorizer = await prisma.businessUser.findFirst({
      where: {
        userId: authorizerUserId,
        businessId: validated.businessId,
        status: 'active',
      },
    })
    if (!authorizer) {
      throw new TenantAccessDeniedError('User does not have authorization to override credit rules')
    }

    const override = await prisma.creditOverride.create({
      data: {
        businessId: validated.businessId,
        customerId: validated.customerId,
        salesOrderId: validated.salesOrderId || null,
        authorizedBy: authorizerUserId,
        requestedAmount: new Decimal(validated.requestedAmount),
        currentExposure: new Decimal(validated.currentExposure),
        creditLimit: new Decimal(validated.creditLimit),
        reason: validated.reason,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        status: 'approved',
      },
      include: {
        customer: true,
        authorizer: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: authorizerUserId,
      entityType: 'credit_override',
      entityId: override.id,
      action: 'create_override',
      newData: override,
    })

    return override
  }

  /**
   * Validate and consume an active credit override.
   */
  static async validateAndConsumeOverride(
    businessId: string,
    customerId: string,
    overrideId: string
  ) {
    const override = await prisma.creditOverride.findFirst({
      where: {
        id: overrideId,
        businessId,
        customerId,
        status: 'approved',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })

    if (!override) return null

    await prisma.creditOverride.update({
      where: { id: overrideId },
      data: { status: 'used' },
    })

    return override
  }

  /**
   * Update Customer's manual credit status (Normal / Warning / Blocked).
   */
  static async updateCustomerCreditStatus(
    businessId: string,
    customerId: string,
    status: 'normal' | 'warning' | 'blocked',
    reason?: string,
    userId?: string
  ) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    })
    if (!existing) throw new TenantAccessDeniedError('Customer')

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        creditStatus: status,
        creditBlockReason: status === 'blocked' ? reason || 'Manually placed on credit hold' : null,
        updatedBy: userId,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'customer_credit_status',
      entityId: customerId,
      action: `set_credit_status_${status}`,
      oldData: { status: existing.creditStatus, reason: existing.creditBlockReason },
      newData: { status, reason },
    })

    return updated
  }

  /**
   * Update business credit control configuration.
   */
  static async updateCreditControlConfig(
    businessId: string,
    config: CreditControlConfigInput,
    userId?: string
  ) {
    const validated = creditControlConfigSchema.parse(config)

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        creditControlConfig: validated,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'credit_control_config',
      entityId: businessId,
      action: 'update_config',
      newData: validated,
    })

    return updated
  }
}
