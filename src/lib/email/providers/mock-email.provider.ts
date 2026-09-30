// =============================================================
// Mock Email Provider — Dev/CI Simulation
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import {
  EmailProviderInterface,
  SendEmailParams,
  EmailDeliveryResult,
} from '../email-provider.interface'
import { renderEmailTemplate } from '../templates'
import { logger } from '@/lib/observability/logger'

export class MockEmailProvider implements EmailProviderInterface {
  readonly providerId = 'mock'
  private sentLog: EmailDeliveryResult[] = []

  isConfigured(): boolean {
    return true
  }

  async sendEmail(params: SendEmailParams): Promise<EmailDeliveryResult> {
    const rawTo = Array.isArray(params.to) ? params.to : [params.to]
    const emailAddresses = rawTo.map((r) => (typeof r === 'string' ? r : r.email))
    const locale = params.locale || params.language || 'en'
    const variables = params.variables || params.data || {}

    const rendered = renderEmailTemplate(params.template, locale, variables)

    const deliveryId = `mock_email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    const result: EmailDeliveryResult = {
      id: deliveryId,
      success: true,
      to: emailAddresses,
      template: params.template,
      status: 'sent',
      deliveredAt: new Date(),
      provider: this.providerId,
    }

    this.sentLog.push(result)

    logger.info(`[Email][Mock] Template "${params.template}" dispatched`, {
      id: deliveryId,
      to: emailAddresses,
      subject: rendered.subject,
      locale,
    })

    return result
  }

  getSentLog(): EmailDeliveryResult[] {
    return [...this.sentLog]
  }

  getSentEmails(): EmailDeliveryResult[] {
    return [...this.sentLog]
  }

  getLastEmail(): EmailDeliveryResult | undefined {
    return this.sentLog[this.sentLog.length - 1]
  }

  clearLog(): void {
    this.sentLog = []
  }
}
