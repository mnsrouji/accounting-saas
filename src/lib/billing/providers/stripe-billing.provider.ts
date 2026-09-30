// =============================================================
// Stripe Billing Provider — Production Payment Integration
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// =============================================================
// Required environment variables:
//   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET  — whsec_...
//   STRIPE_PUBLISHABLE_KEY — pk_live_... or pk_test_... (client-side)
// =============================================================

import {
  BillingProviderInterface,
  BillingCustomer,
  BillingSubscription,
  BillingInvoice,
  BillingWebhookEvent,
  CreateCheckoutSessionParams,
  CreatePortalSessionParams,
  BillingEventType,
} from '../billing-provider.interface'

// Stripe types are defined without importing the SDK to keep it optional.
// When STRIPE_SECRET_KEY is set, the stripe package is dynamically required.
// This avoids build errors when Stripe is not installed.

type StripeInstance = {
  customers: {
    create: (p: object) => Promise<{ id: string; email: string; name: string | null }>
    list: (p: object) => Promise<{ data: Array<{ id: string; email: string; name: string | null; metadata: Record<string, string> }> }>
  }
  checkout: {
    sessions: {
      create: (p: object) => Promise<{ url: string | null; id: string }>
    }
  }
  billingPortal: {
    sessions: {
      create: (p: object) => Promise<{ url: string }>
    }
  }
  webhooks: {
    constructEvent: (body: string, sig: string, secret: string) => { id: string; type: string; data: { object: Record<string, unknown> } }
  }
  subscriptions: {
    retrieve: (id: string) => Promise<StripeSubscriptionData>
    update: (id: string, p: object) => Promise<StripeSubscriptionData>
    cancel: (id: string) => Promise<StripeSubscriptionData>
  }
  invoices: {
    list: (p: object) => Promise<{ data: StripeInvoiceData[] }>
  }
}

type StripeSubscriptionData = {
  id: string
  customer: string
  status: string
  items: { data: Array<{ price: { id: string } }> }
  current_period_start: number
  current_period_end: number
  trial_end: number | null
  cancel_at_period_end: boolean
  metadata: Record<string, string>
}

type StripeInvoiceData = {
  id: string
  customer: string
  subscription: string | null
  amount_paid: number
  currency: string
  status: string | null
  status_transitions: { paid_at: number | null }
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  period_start: number
  period_end: number
}

const STRIPE_EVENT_MAP: Record<string, BillingEventType | undefined> = {
  'customer.subscription.created': 'subscription.created',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.deleted': 'subscription.deleted',
  'customer.subscription.trial_will_end': 'subscription.trial_will_end',
  'invoice.paid': 'invoice.paid',
  'invoice.payment_failed': 'invoice.payment_failed',
  'invoice.upcoming': 'invoice.upcoming',
  'customer.created': 'customer.created',
  'payment_method.attached': 'payment_method.attached',
  'checkout.session.completed': 'checkout.completed',
}

export class StripeBillingProvider implements BillingProviderInterface {
  readonly providerId = 'stripe'
  private _stripe: StripeInstance | null = null

  isConfigured(): boolean {
    return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
  }

  private getStripe(): StripeInstance {
    if (!this._stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not configured')
      }
      // Safe dynamic require to avoid bundling Stripe at build time when not installed
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const dynamicRequire = eval('require')
      const Stripe = dynamicRequire('stripe')
      this._stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20',
        appInfo: { name: 'AccountFlow ERP', version: '1.16.0' },
      }) as StripeInstance
    }
    return this._stripe
  }

  async createOrGetCustomer(params: {
    businessId: string
    email: string
    name?: string
  }): Promise<BillingCustomer> {
    const stripe = this.getStripe()

    // Check for existing customer by business metadata
    const existing = await stripe.customers.list({
      email: params.email,
      limit: 5,
    })

    const found = existing.data.find((c) => c.metadata?.businessId === params.businessId)
    if (found) {
      return {
        providerId: found.id,
        email: found.email,
        name: found.name || undefined,
        metadata: { businessId: params.businessId },
      }
    }

    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: { businessId: params.businessId },
    })

    return {
      providerId: customer.id,
      email: customer.email,
      name: customer.name || undefined,
      metadata: { businessId: params.businessId },
    }
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{
    url: string
    sessionId: string
  }> {
    const stripe = this.getStripe()

    // Map planCode to Stripe price ID from environment
    const priceId = process.env[`STRIPE_PRICE_${params.planCode.toUpperCase()}_${params.billingInterval.toUpperCase()}`]
    if (!priceId) {
      throw new Error(`No Stripe price configured for plan: ${params.planCode}/${params.billingInterval}. Set STRIPE_PRICE_${params.planCode.toUpperCase()}_${params.billingInterval.toUpperCase()}`)
    }

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.email,
      metadata: {
        businessId: params.businessId,
        userId: params.userId,
        planCode: params.planCode,
      },
      subscription_data: {
        metadata: {
          businessId: params.businessId,
          planCode: params.planCode,
        },
      },
    }

    if (params.trialDays && params.trialDays > 0) {
      (sessionParams.subscription_data as Record<string, unknown>).trial_period_days = params.trialDays
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL')
    }

    return { url: session.url, sessionId: session.id }
  }

  async createPortalSession(params: CreatePortalSessionParams): Promise<{ url: string }> {
    const stripe = this.getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    })
    return { url: session.url }
  }

  async verifyWebhookEvent(rawBody: string, signature: string): Promise<BillingWebhookEvent> {
    const stripe = this.getStripe()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    const mappedType = STRIPE_EVENT_MAP[event.type]

    if (!mappedType) {
      throw new Error(`Unhandled Stripe event type: ${event.type}`)
    }

    return {
      id: event.id,
      type: mappedType,
      data: event.data.object,
      rawBody,
      signature,
    }
  }

  async getSubscription(subscriptionId: string): Promise<BillingSubscription> {
    const stripe = this.getStripe()
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    return this.mapSubscription(sub)
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<BillingSubscription> {
    const stripe = this.getStripe()
    let sub: StripeSubscriptionData

    if (immediate) {
      sub = await stripe.subscriptions.cancel(subscriptionId)
    } else {
      sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    }

    return this.mapSubscription(sub)
  }

  async getInvoices(customerId: string, limit = 10): Promise<BillingInvoice[]> {
    const stripe = this.getStripe()
    const { data } = await stripe.invoices.list({
      customer: customerId,
      limit,
    })
    return data.map(this.mapInvoice)
  }

  private mapSubscription(sub: StripeSubscriptionData): BillingSubscription {
    const statusMap: Record<string, BillingSubscription['status']> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'unpaid',
      incomplete: 'incomplete',
      incomplete_expired: 'canceled',
    }

    return {
      providerId: sub.id,
      customerId: sub.customer,
      planProviderId: sub.items.data[0]?.price.id || '',
      status: statusMap[sub.status] || 'active',
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      metadata: sub.metadata,
    }
  }

  private mapInvoice(inv: StripeInvoiceData): BillingInvoice {
    const statusMap: Record<string, BillingInvoice['status']> = {
      paid: 'paid',
      open: 'open',
      void: 'void',
      uncollectible: 'uncollectible',
      draft: 'draft',
    }

    return {
      providerId: inv.id,
      customerId: inv.customer,
      subscriptionId: inv.subscription || undefined,
      amount: inv.amount_paid,
      currency: inv.currency,
      status: statusMap[inv.status || 'draft'] || 'draft',
      paidAt: inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000)
        : undefined,
      invoiceUrl: inv.hosted_invoice_url || undefined,
      invoicePdfUrl: inv.invoice_pdf || undefined,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000) : undefined,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : undefined,
    }
  }
}
