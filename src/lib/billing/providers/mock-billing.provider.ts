// =============================================================
// Mock Billing Provider — Simulation for Development / CI
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// Returns predictable, deterministic results without any external calls.
// =============================================================

import {
  BillingProviderInterface,
  BillingCustomer,
  BillingSubscription,
  BillingInvoice,
  BillingWebhookEvent,
  CreateCheckoutSessionParams,
  CreatePortalSessionParams,
} from '../billing-provider.interface'

export class MockBillingProvider implements BillingProviderInterface {
  readonly providerId = 'mock'

  isConfigured(): boolean {
    return true // always available in dev/test
  }

  async createOrGetCustomer(params: {
    businessId: string
    email: string
    name?: string
  }): Promise<BillingCustomer> {
    return {
      providerId: `mock_cus_${params.businessId.slice(0, 8)}`,
      email: params.email,
      name: params.name,
      metadata: { businessId: params.businessId },
    }
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{
    url: string
    sessionId: string
  }> {
    const sessionId = `mock_cs_${Date.now()}`
    const url = `${params.successUrl}?session_id=${sessionId}&provider=mock&plan=${params.planCode}`
    return { url, sessionId }
  }

  async createPortalSession(params: CreatePortalSessionParams): Promise<{ url: string }> {
    const url = `${params.returnUrl}?portal=mock&customer=${params.customerId}`
    return { url }
  }

  async verifyWebhookEvent(rawBody: string, signature: string): Promise<BillingWebhookEvent> {
    if (!signature || signature.startsWith('invalid')) {
      throw new Error('Invalid webhook signature')
    }
    const data = JSON.parse(rawBody)
    return {
      id: data.id || `mock_evt_${Date.now()}`,
      type: data.type,
      data: data.data || {},
      rawBody,
      signature,
    }
  }

  async getSubscription(subscriptionId: string): Promise<BillingSubscription> {
    const now = new Date()
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return {
      providerId: subscriptionId,
      customerId: 'mock_cus_default',
      planProviderId: 'mock_plan_professional',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
    }
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<BillingSubscription> {
    const sub = await this.getSubscription(subscriptionId)
    return {
      ...sub,
      status: immediate ? 'canceled' : 'active',
      cancelAtPeriodEnd: !immediate,
    }
  }

  async getInvoices(_customerId: string, limit = 10): Promise<BillingInvoice[]> {
    const invoices: BillingInvoice[] = []
    for (let i = 0; i < Math.min(limit, 3); i++) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      invoices.push({
        providerId: `mock_inv_${Date.now()}_${i}`,
        customerId: _customerId,
        amount: 4900,
        currency: 'usd',
        status: 'paid',
        paidAt: date,
        invoiceUrl: '#',
        invoicePdfUrl: '#',
      })
    }
    return invoices
  }
}
