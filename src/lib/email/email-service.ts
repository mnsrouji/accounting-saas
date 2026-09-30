// =============================================================
// Email Service — Central Dispatcher & Template Orchestration
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import {
  EmailProviderInterface,
  SendEmailParams,
  EmailDeliveryResult,
} from './email-provider.interface'
import { MockEmailProvider } from './providers/mock-email.provider'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { logger } from '@/lib/observability/logger'

class EmailRegistry {
  private static instance: EmailRegistry
  private provider: EmailProviderInterface

  private constructor() {
    this.provider = new MockEmailProvider()
  }

  static getInstance(): EmailRegistry {
    if (!EmailRegistry.instance) {
      EmailRegistry.instance = new EmailRegistry()
    }
    return EmailRegistry.instance
  }

  getProvider(): EmailProviderInterface {
    return this.provider
  }

  setProvider(provider: EmailProviderInterface) {
    this.provider = provider
  }
}

export class EmailService {
  static getProvider(): EmailProviderInterface {
    return EmailRegistry.getInstance().getProvider()
  }

  static setProvider(provider: EmailProviderInterface) {
    EmailRegistry.getInstance().setProvider(provider)
  }

  static async send(params: SendEmailParams): Promise<EmailDeliveryResult> {
    return this.sendEmail(params)
  }

  static async sendEmail(params: SendEmailParams): Promise<EmailDeliveryResult> {
    const provider = this.getProvider()
    try {
      const result = await provider.sendEmail(params)

      if (params.businessId) {
        await createAuditLog({
          action: 'create',
          module: 'email',
          recordId: result.id,
          recordType: 'email_delivery',
          businessId: params.businessId,
          newValues: {
            template: params.template,
            recipients: result.to,
            status: result.status,
            provider: provider.providerId,
          },
        })
      }

      return result
    } catch (err) {
      logger.error('Failed to dispatch email', err, {
        template: params.template,
      })
      throw err
    }
  }
}
