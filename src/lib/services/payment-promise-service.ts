// =============================================================
// Payment Promise Service — Commitment Tracking & Broken Promise Detection
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import {
  createPaymentPromiseSchema,
  updatePaymentPromiseSchema,
  CreatePaymentPromiseInput,
  UpdatePaymentPromiseInput,
} from '@/lib/validations/crm-schemas'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'
import Decimal from 'decimal.js'

export class PaymentPromiseService {
  /**
   * Create a new payment promise.
   */
  static async createPromise(input: CreatePaymentPromiseInput, userId?: string) {
    const validated = createPaymentPromiseSchema.parse(input)
    const effectiveUserId = validated.assignedUserId || userId || null

    const customer = await prisma.customer.findFirst({
      where: { id: validated.customerId, businessId: validated.businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    if (validated.invoiceId) {
      const invoice = await prisma.sale.findFirst({
        where: { id: validated.invoiceId, businessId: validated.businessId },
      })
      if (!invoice) throw new TenantAccessDeniedError('Sale Invoice')
    }

    const promise = await prisma.paymentPromise.create({
      data: {
        businessId: validated.businessId,
        customerId: validated.customerId,
        invoiceId: validated.invoiceId || null,
        promisedAmount: new Decimal(validated.promisedAmount),
        promiseDate: new Date(validated.promiseDate),
        status: 'open',
        actualPaidAmount: new Decimal(0),
        assignedUserId: effectiveUserId,
        notes: validated.notes || null,
      },
      include: {
        customer: true,
        invoice: true,
        assignedUser: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: effectiveUserId || undefined,
      entityType: 'payment_promise',
      entityId: promise.id,
      action: 'create',
      newData: promise,
    })

    return promise
  }

  /**
   * Update a payment promise.
   */
  static async updatePromise(input: UpdatePaymentPromiseInput, userId?: string) {
    const validated = updatePaymentPromiseSchema.parse(input)

    const existing = await prisma.paymentPromise.findFirst({
      where: { id: validated.id, businessId: validated.businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('PaymentPromise')

    const updated = await prisma.paymentPromise.update({
      where: { id: validated.id },
      data: {
        status: validated.status !== undefined ? validated.status : undefined,
        actualPaidAmount: validated.actualPaidAmount !== undefined ? new Decimal(validated.actualPaidAmount) : undefined,
        paidAt: validated.paidAt !== undefined ? (validated.paidAt ? new Date(validated.paidAt) : null) : undefined,
        notes: validated.notes !== undefined ? validated.notes : undefined,
      },
      include: {
        customer: true,
        invoice: true,
        assignedUser: true,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'payment_promise',
      entityId: updated.id,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  /**
   * Record a payment fulfillment against an open promise.
   */
  static async recordPromisePayment(
    businessId: string,
    promiseId: string,
    paidAmount: number | Decimal,
    paidAt: Date = new Date(),
    userId?: string
  ) {
    const promise = await prisma.paymentPromise.findFirst({
      where: { id: promiseId, businessId },
    })
    if (!promise) throw new TenantAccessDeniedError('PaymentPromise')

    const paidDec = new Decimal(paidAmount)
    const promisedDec = new Decimal(promise.promisedAmount)
    const totalPaid = new Decimal(promise.actualPaidAmount).plus(paidDec)

    const status = totalPaid.gte(promisedDec) ? 'kept' : 'open'

    const updated = await prisma.paymentPromise.update({
      where: { id: promiseId },
      data: {
        actualPaidAmount: totalPaid,
        status,
        paidAt,
      },
      include: {
        customer: true,
        invoice: true,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'payment_promise',
      entityId: promiseId,
      action: `record_payment_${status}`,
      oldData: promise,
      newData: updated,
    })

    return updated
  }

  /**
   * Automatically evaluate payment promises against actual customer payments and overdue dates.
   */
  static async evaluatePaymentPromises(businessId: string): Promise<{
    evaluatedCount: number
    keptCount: number
    brokenCount: number
  }> {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Find all open promises
    const openPromises = await prisma.paymentPromise.findMany({
      where: {
        businessId,
        status: 'open',
      },
      include: {
        invoice: true,
      },
    })

    let keptCount = 0
    let brokenCount = 0

    for (const promise of openPromises) {
      const promisedAmount = new Decimal(promise.promisedAmount)
      const promiseDate = new Date(promise.promiseDate)

      // If tied to a specific invoice, check invoice allocations & paidAmount
      if (promise.invoiceId && promise.invoice) {
        const invoicePaid = new Decimal(promise.invoice.paidAmount || 0)
        if (invoicePaid.gte(promisedAmount)) {
          await prisma.paymentPromise.update({
            where: { id: promise.id },
            data: { status: 'kept', actualPaidAmount: invoicePaid, paidAt: new Date() },
          })
          keptCount++
          continue
        }
      } else {
        // Tied to customer broadly: check payments made on/after promise creation up to promiseDate
        const payments = await prisma.payment.findMany({
          where: {
            businessId,
            customerId: promise.customerId,
            type: 'incoming',
            status: 'posted',
            paymentDate: { gte: promise.createdAt },
          },
        })

        const totalPayments = payments.reduce(
          (acc, p) => acc.plus(new Decimal(p.amount)),
          new Decimal(0)
        )

        if (totalPayments.gte(promisedAmount)) {
          await prisma.paymentPromise.update({
            where: { id: promise.id },
            data: { status: 'kept', actualPaidAmount: totalPayments, paidAt: new Date() },
          })
          keptCount++
          continue
        }
      }

      // If promise date has passed and payment was not satisfied, mark as broken
      if (promiseDate < today) {
        await prisma.paymentPromise.update({
          where: { id: promise.id },
          data: { status: 'broken' },
        })
        brokenCount++
      }
    }

    return {
      evaluatedCount: openPromises.length,
      keptCount,
      brokenCount,
    }
  }

  /**
   * Get broken promises with customer & invoice context.
   */
  static async getBrokenPromises(businessId: string, customerId?: string) {
    const where: any = { businessId, status: 'broken' }
    if (customerId) where.customerId = customerId

    return prisma.paymentPromise.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, balanceDue: true } },
        assignedUser: { select: { id: true, fullName: true } },
      },
      orderBy: { promiseDate: 'desc' },
    })
  }

  /**
   * Get promises with flexible filters.
   */
  static async getPromises(
    businessId: string,
    filters?: {
      customerId?: string
      status?: string
      assignedUserId?: string
      limit?: number
    }
  ) {
    const where: any = { businessId }
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status
    if (filters?.assignedUserId) where.assignedUserId = filters.assignedUserId

    return prisma.paymentPromise.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true, phone: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, balanceDue: true } },
        assignedUser: { select: { id: true, fullName: true } },
      },
      orderBy: { promiseDate: 'asc' },
      take: filters?.limit || 100,
    })
  }
}
