// =============================================================
// Billing Service — Core Orchestration Layer
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// Coordinates: BillingProvider ↔ SubscriptionService ↔ AuditLog
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { getBillingProvider } from './billing-registry'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { BillingWebhookEvent, BillingInterval } from './billing-provider.interface'

export class BillingService {
  // -------------------------------------------------------
  // Checkout & Portal
  // -------------------------------------------------------

  static async createCheckoutSession(params: {
    businessId: string
    userId: string
    planCode: string
    billingInterval: BillingInterval
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string; sessionId: string }> {
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: params.businessId },
      select: { name: true, email: true },
    })

    const provider = getBillingProvider()

    const session = await provider.createCheckoutSession({
      businessId: params.businessId,
      userId: params.userId,
      email: business.email || 'billing@accountflow.io',
      planCode: params.planCode,
      billingInterval: params.billingInterval,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    })

    await createAuditLog({
      action: 'create',
      module: 'billing',
      recordId: session.sessionId,
      recordType: 'checkout_session',
      businessId: params.businessId,
      userId: params.userId,
      newValues: {
        planCode: params.planCode,
        billingInterval: params.billingInterval,
        provider: provider.providerId,
      },
    })

    return session
  }

  static async createPortalSession(params: {
    businessId: string
    userId: string
    returnUrl: string
  }): Promise<{ url: string }> {
    // Get stored provider customer ID
    const storedSub = await prisma.subscription.findFirst({
      where: { businessId: params.businessId },
      select: { providerCustomerId: true },
    })

    const customerId = storedSub?.providerCustomerId || `mock_cus_${params.businessId.slice(0, 8)}`

    const provider = getBillingProvider()
    const session = await provider.createPortalSession({
      businessId: params.businessId,
      customerId,
      returnUrl: params.returnUrl,
    })

    await createAuditLog({
      action: 'create',
      module: 'billing',
      recordId: params.businessId,
      recordType: 'portal_session',
      businessId: params.businessId,
      userId: params.userId,
      newValues: { provider: provider.providerId },
    })

    return session
  }

  // -------------------------------------------------------
  // Invoice History
  // -------------------------------------------------------

  static async getInvoices(businessId: string) {
    const storedSub = await prisma.subscription.findFirst({
      where: { businessId },
      select: { providerCustomerId: true },
    })

    const customerId = storedSub?.providerCustomerId || `mock_cus_${businessId.slice(0, 8)}`

    const provider = getBillingProvider()
    return provider.getInvoices(customerId, 20)
  }

  // -------------------------------------------------------
  // Cancel Subscription
  // -------------------------------------------------------

  static async cancelSubscription(params: {
    businessId: string
    userId: string
    immediate?: boolean
  }) {
    const storedSub = await prisma.subscription.findFirst({
      where: { businessId: params.businessId },
      select: { id: true, providerSubscriptionId: true },
    })

    if (!storedSub?.providerSubscriptionId) {
      // No external subscription — mark as canceled directly in DB
      if (storedSub) {
        await prisma.subscription.update({
          where: { id: storedSub.id },
          data: { status: 'canceled' },
        })
      }
      return { canceled: true, provider: 'none', cancelAtPeriodEnd: false }
    }

    const provider = getBillingProvider()
    const updated = await provider.cancelSubscription(
      storedSub.providerSubscriptionId,
      params.immediate ?? false
    )

    // Sync status back
    await prisma.subscription.update({
      where: { id: storedSub.id },
      data: {
        status: updated.status,
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        currentPeriodEnd: updated.currentPeriodEnd,
      },
    })

    await createAuditLog({
      action: 'update',
      module: 'billing',
      recordId: storedSub.id,
      recordType: 'subscription',
      businessId: params.businessId,
      userId: params.userId,
      newValues: {
        action: 'cancel',
        immediate: params.immediate,
        provider: provider.providerId,
        newStatus: updated.status,
      },
    })

    return { canceled: true, provider: provider.providerId, cancelAtPeriodEnd: updated.cancelAtPeriodEnd }
  }

  // -------------------------------------------------------
  // Webhook Ingestion
  // -------------------------------------------------------

  static async processWebhookEvent(rawBody: string, signature: string): Promise<void> {
    const provider = getBillingProvider()
    let event: BillingWebhookEvent

    try {
      event = await provider.verifyWebhookEvent(rawBody, signature)
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${(err as Error).message}`)
    }

    // Idempotency: skip already-processed events
    const existing = await prisma.billingWebhookEvent.findUnique({
      where: { providerEventId: event.id },
    })
    if (existing && existing.status === 'processed') return

    // Persist or update the raw event for audit / replay
    const record = existing
      ? await prisma.billingWebhookEvent.update({
          where: { id: existing.id },
          data: {
            status: 'processing',
            payload: event.data as object,
            receivedAt: new Date(),
          },
        })
      : await prisma.billingWebhookEvent.create({
          data: {
            providerEventId: event.id,
            provider: provider.providerId,
            eventType: event.type,
            payload: event.data as object,
            status: 'processing',
            receivedAt: new Date(),
          },
        })

    try {
      await this.dispatchWebhookEvent(event)
      await prisma.billingWebhookEvent.update({
        where: { id: record.id },
        data: { status: 'processed', processedAt: new Date(), lastError: null },
      })
    } catch (err) {
      await prisma.billingWebhookEvent.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          lastError: (err as Error).message,
          retryCount: { increment: 1 },
        },
      })
      throw err
    }
  }

  private static async dispatchWebhookEvent(event: BillingWebhookEvent): Promise<void> {
    const data = event.data as Record<string, unknown>

    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated': {
        await this.syncSubscriptionFromProvider(data)
        break
      }
      case 'subscription.deleted': {
        await this.handleSubscriptionDeleted(data)
        break
      }
      case 'invoice.paid': {
        await this.handleInvoicePaid(data)
        break
      }
      case 'invoice.payment_failed': {
        await this.handleInvoicePaymentFailed(data)
        break
      }
      case 'checkout.completed': {
        await this.handleCheckoutCompleted(data)
        break
      }
      default:
        // Unhandled event types are silently recorded (status=processed)
        break
    }
  }

  private static async syncSubscriptionFromProvider(data: Record<string, unknown>) {
    const businessId = (data.metadata as Record<string, string>)?.businessId
    if (!businessId) return

    const statusMap: Record<string, string> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'past_due',
      incomplete: 'trialing',
    }

    const providerStatus = (data.status as string) || 'active'
    const newStatus = statusMap[providerStatus] || 'active'
    const providerSubId = data.id as string
    const providerCustomerId = data.customer as string

    await prisma.subscription.updateMany({
      where: { businessId },
      data: {
        status: newStatus,
        providerSubscriptionId: providerSubId,
        providerCustomerId,
        currentPeriodStart: data.current_period_start
          ? new Date((data.current_period_start as number) * 1000)
          : undefined,
        currentPeriodEnd: data.current_period_end
          ? new Date((data.current_period_end as number) * 1000)
          : undefined,
        cancelAtPeriodEnd: (data.cancel_at_period_end as boolean) ?? false,
      },
    })
  }

  private static async handleSubscriptionDeleted(data: Record<string, unknown>) {
    const businessId = (data.metadata as Record<string, string>)?.businessId
    if (!businessId) return

    await prisma.subscription.updateMany({
      where: { businessId },
      data: { status: 'canceled' },
    })
  }

  private static async handleInvoicePaid(data: Record<string, unknown>) {
    const businessId = ((data.subscription_details as Record<string, unknown>)?.metadata as Record<string, string>)?.businessId
    if (!businessId) return

    // Ensure subscription remains active
    await prisma.subscription.updateMany({
      where: { businessId, status: 'past_due' },
      data: { status: 'active' },
    })
  }

  private static async handleInvoicePaymentFailed(data: Record<string, unknown>) {
    const businessId = ((data.subscription_details as Record<string, unknown>)?.metadata as Record<string, string>)?.businessId
    if (!businessId) return

    await prisma.subscription.updateMany({
      where: { businessId },
      data: { status: 'past_due' },
    })
  }

  private static async handleCheckoutCompleted(data: Record<string, unknown>) {
    const businessId = (data.metadata as Record<string, string>)?.businessId
    const planCode = (data.metadata as Record<string, string>)?.planCode
    if (!businessId || !planCode) return

    const plan = await prisma.subscriptionPlan.findFirst({ where: { code: planCode } })
    if (!plan) return

    // Upsert subscription to active
    const existing = await prisma.subscription.findFirst({ where: { businessId } })
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: 'active',
          providerSubscriptionId: data.subscription as string,
          providerCustomerId: data.customer as string,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    } else {
      await prisma.subscription.create({
        data: {
          businessId,
          planId: plan.id,
          status: 'active',
          providerSubscriptionId: data.subscription as string,
          providerCustomerId: data.customer as string,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      })
    }
  }
}
