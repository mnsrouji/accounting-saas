// =============================================================
// Billing Webhook API — Provider Event Ingestion
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// POST /api/billing/webhook
// =============================================================
// Security:
//   - Signature verified inside BillingService.processWebhookEvent()
//   - Raw body must be read before any parsing (required by Stripe)
//   - Idempotent: duplicate events are silently discarded
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { BillingService } from '@/lib/billing/billing-service'

// Raw body read is CRITICAL for Stripe signature verification
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Read raw body as text
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
  }

  // Extract signature header (Stripe uses 'stripe-signature', others vary)
  const signature =
    request.headers.get('stripe-signature') ||
    request.headers.get('x-billing-signature') ||
    request.headers.get('webhook-signature') ||
    ''

  try {
    await BillingService.processWebhookEvent(rawBody, signature)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed'
    const isSignatureError = message.includes('signature') || message.includes('verification')

    console.error('[Webhook] Error:', message)

    return NextResponse.json(
      { error: message },
      { status: isSignatureError ? 401 : 500 }
    )
  }
}

// Health probe for webhook endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/billing/webhook',
    status: 'listening',
    timestamp: new Date().toISOString(),
  })
}
