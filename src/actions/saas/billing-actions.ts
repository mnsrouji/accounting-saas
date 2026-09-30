// =============================================================
// Billing Server Actions — Tenant-Facing Billing Operations
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// =============================================================

'use server'

import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { BillingService } from '@/lib/billing/billing-service'
import type { BillingInterval } from '@/lib/billing/billing-provider.interface'

// ----------------------------------------------------------------
// Create Checkout Session (upgrade/subscribe)
// ----------------------------------------------------------------

const CheckoutSchema = z.object({
  planCode: z.string().min(1),
  billingInterval: z.enum(['month', 'year']),
})

export async function createBillingCheckout(
  businessId: string,
  input: z.infer<typeof CheckoutSchema>
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'write')

    const validated = CheckoutSchema.parse(input)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await BillingService.createCheckoutSession({
      businessId,
      userId,
      planCode: validated.planCode,
      billingInterval: validated.billingInterval as BillingInterval,
      successUrl: `${appUrl}/b/${businessId}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/b/${businessId}/settings/subscription?checkout=canceled`,
    })

    return { success: true, url: session.url }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ----------------------------------------------------------------
// Create Billing Portal Session (manage/cancel)
// ----------------------------------------------------------------

export async function createBillingPortal(
  businessId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'write')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await BillingService.createPortalSession({
      businessId,
      userId,
      returnUrl: `${appUrl}/b/${businessId}/settings/subscription`,
    })

    return { success: true, url: session.url }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ----------------------------------------------------------------
// Cancel Subscription
// ----------------------------------------------------------------

export async function cancelSubscription(
  businessId: string,
  immediate = false
): Promise<{ success: boolean; cancelAtPeriodEnd?: boolean; error?: string }> {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'full')

    const result = await BillingService.cancelSubscription({
      businessId,
      userId,
      immediate,
    })

    return { success: true, cancelAtPeriodEnd: result.cancelAtPeriodEnd }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ----------------------------------------------------------------
// Get Invoice History
// ----------------------------------------------------------------

export async function getInvoiceHistory(
  businessId: string
): Promise<{ success: boolean; invoices?: Awaited<ReturnType<typeof BillingService.getInvoices>>; error?: string }> {
  try {
    await requireBusinessAccess(businessId)

    const invoices = await BillingService.getInvoices(businessId)
    return { success: true, invoices }
  } catch (err) {
    return { success: false, invoices: [], error: (err as Error).message }
  }
}
