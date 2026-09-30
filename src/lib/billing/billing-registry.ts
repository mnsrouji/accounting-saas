// =============================================================
// Billing Registry — Provider Resolution & Singleton Access
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// =============================================================
// Resolution order:
//   1. BILLING_PROVIDER env var ('stripe' | 'mock')
//   2. Auto-detect: Stripe if STRIPE_SECRET_KEY is set
//   3. Fallback: Mock provider (safe for dev/CI)
// =============================================================

import { BillingProviderInterface } from './billing-provider.interface'
import { MockBillingProvider } from './providers/mock-billing.provider'
import { StripeBillingProvider } from './providers/stripe-billing.provider'

let _instance: BillingProviderInterface | null = null

export function getBillingProvider(): BillingProviderInterface {
  if (_instance) return _instance

  const requested = process.env.BILLING_PROVIDER?.toLowerCase()

  if (requested === 'stripe' || (!requested && process.env.STRIPE_SECRET_KEY)) {
    const stripe = new StripeBillingProvider()
    if (stripe.isConfigured()) {
      _instance = stripe
      console.info('[Billing] Using Stripe provider')
      return _instance
    }
  }

  if (requested === 'mock' || !requested || process.env.NODE_ENV !== 'production') {
    _instance = new MockBillingProvider()
    console.info('[Billing] Using Mock provider (set BILLING_PROVIDER=stripe for production)')
    return _instance
  }

  throw new Error(
    `No billing provider configured. Set BILLING_PROVIDER=stripe and STRIPE_SECRET_KEY, or BILLING_PROVIDER=mock.`
  )
}

/**
 * Reset provider singleton. Used in tests.
 */
export function resetBillingProvider(): void {
  _instance = null
}
