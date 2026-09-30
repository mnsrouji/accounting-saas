// =============================================================
// Billing Provider Interface — Provider-Agnostic Adapter Contract
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// =============================================================

export type BillingInterval = 'month' | 'year'
export type BillingEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.deleted'
  | 'subscription.trial_will_end'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.upcoming'
  | 'customer.created'
  | 'payment_method.attached'
  | 'checkout.completed'

export interface BillingCustomer {
  providerId: string
  email: string
  name?: string
  metadata?: Record<string, string>
}

export interface BillingSubscription {
  providerId: string
  customerId: string
  planProviderId: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  trialEnd?: Date
  cancelAtPeriodEnd: boolean
  metadata?: Record<string, string>
}

export interface BillingInvoice {
  providerId: string
  customerId: string
  subscriptionId?: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible' | 'draft'
  paidAt?: Date
  invoiceUrl?: string
  invoicePdfUrl?: string
  periodStart?: Date
  periodEnd?: Date
}

export interface CreateCheckoutSessionParams {
  businessId: string
  userId: string
  email: string
  planCode: string
  billingInterval: BillingInterval
  successUrl: string
  cancelUrl: string
  trialDays?: number
}

export interface CreatePortalSessionParams {
  businessId: string
  customerId: string
  returnUrl: string
}

export interface BillingWebhookEvent {
  id: string
  type: BillingEventType
  data: Record<string, unknown>
  rawBody: string
  signature: string
}

export interface BillingProviderInterface {
  /**
   * Provider identifier (e.g. 'stripe', 'paddle', 'mock')
   */
  readonly providerId: string

  /**
   * Check if this provider is configured (has required env vars)
   */
  isConfigured(): boolean

  /**
   * Create or retrieve a billing customer for a business
   */
  createOrGetCustomer(params: {
    businessId: string
    email: string
    name?: string
  }): Promise<BillingCustomer>

  /**
   * Create a hosted checkout session for plan subscription
   */
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{
    url: string
    sessionId: string
  }>

  /**
   * Create a billing portal session for the customer
   */
  createPortalSession(params: CreatePortalSessionParams): Promise<{
    url: string
  }>

  /**
   * Verify webhook signature and parse event
   */
  verifyWebhookEvent(rawBody: string, signature: string): Promise<BillingWebhookEvent>

  /**
   * Get subscription details from provider
   */
  getSubscription(subscriptionId: string): Promise<BillingSubscription>

  /**
   * Cancel subscription at period end or immediately
   */
  cancelSubscription(subscriptionId: string, immediate?: boolean): Promise<BillingSubscription>

  /**
   * Get invoices for a customer
   */
  getInvoices(customerId: string, limit?: number): Promise<BillingInvoice[]>
}
