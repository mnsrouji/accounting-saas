// =============================================================
// Email Provider Interface — Provider-Agnostic Email Architecture
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

export type EmailTemplateName =
  | 'invitation'
  | 'welcome'
  | 'security_event'
  | 'subscription_confirmed'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'renewal_reminder'
  | 'usage_limit_warning'

export interface EmailRecipient {
  email: string
  name?: string
}

export interface SendEmailParams {
  to: string | EmailRecipient | (string | EmailRecipient)[]
  template: EmailTemplateName
  locale?: 'en' | 'ar' | 'tr'
  language?: 'en' | 'ar' | 'tr'
  variables?: Record<string, unknown>
  data?: Record<string, unknown>
  businessId?: string
  subject?: string
}

export interface EmailDeliveryResult {
  id: string
  success: boolean
  to: string[]
  template: EmailTemplateName
  status: 'sent' | 'queued' | 'simulated' | 'failed'
  deliveredAt: Date
  provider: string
  error?: string
}

export interface EmailProviderInterface {
  readonly providerId: string
  isConfigured(): boolean
  sendEmail(params: SendEmailParams): Promise<EmailDeliveryResult>
}
