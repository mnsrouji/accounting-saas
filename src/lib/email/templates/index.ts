// =============================================================
// Email Templates — Localized, RTL-Safe Notification Templates
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import { EmailTemplateName } from '../email-provider.interface'

export interface RenderedEmail {
  subject: string
  html: string
  text: string
  isRtl: boolean
}

export function renderEmailTemplate(
  template: EmailTemplateName,
  locale: 'en' | 'ar' | 'tr' = 'en',
  vars: Record<string, unknown> = {}
): RenderedEmail {
  const safeVars = vars || {}
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  const brandName = (safeVars.brandName as string) || 'AccountFlow ERP'

  switch (template) {
    case 'invitation': {
      const inviter = (vars.inviterName as string) || 'Your team'
      const orgName = (vars.organizationName as string) || 'the organization'
      const inviteUrl = (vars.inviteUrl as string) || '#'
      const role = (vars.role as string) || 'member'

      const subjects = {
        en: `You've been invited to join ${orgName} on ${brandName}`,
        ar: `تمت دعوتك للانضمام إلى ${orgName} على ${brandName}`,
        tr: `${brandName} üzerinde ${orgName} organizasyonuna davet edildiniz`,
      }

      const headings = {
        en: `Join ${orgName}`,
        ar: `انضم إلى ${orgName}`,
        tr: `${orgName} Organizasyonuna Katılın`,
      }

      const bodies = {
        en: `${inviter} has invited you to join ${orgName} as a <strong>${role}</strong>.`,
        ar: `قام ${inviter} بدعوتك للانضمام إلى ${orgName} بصلاحية <strong>${role}</strong>.`,
        tr: `${inviter}, sizi ${orgName} organizasyonuna <strong>${role}</strong> olarak davet etti.`,
      }

      const ctas = {
        en: 'Accept Invitation',
        ar: 'قبول الدعوة',
        tr: 'Daveti Kabul Et',
      }

      return {
        subject: subjects[locale],
        isRtl,
        text: `${headings[locale]}\n\n${bodies[locale].replace(/<[^>]*>/g, '')}\n\nLink: ${inviteUrl}`,
        html: `
          <div dir="${dir}" style="font-family: Arial, sans-serif; text-align: ${align}; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #6366f1; margin-bottom: 20px;">${brandName}</div>
            <h2 style="color: #ffffff; margin-bottom: 12px;">${headings[locale]}</h2>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">${bodies[locale]}</p>
            <div style="margin: 30px 0;">
              <a href="${inviteUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${ctas[locale]}</a>
            </div>
            <p style="color: #64748b; font-size: 12px;">If you did not expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
      }
    }

    case 'welcome': {
      const orgName = (vars.organizationName as string) || 'Your Organization'
      const appUrl = (vars.appUrl as string) || '#'

      const subjects = {
        en: `Welcome to ${brandName} — Let's get started!`,
        ar: `مرحبًا بك في ${brandName} — دعنا نبدأ!`,
        tr: `${brandName}'a Hoş Geldiniz — Başlayalım!`,
      }

      return {
        subject: subjects[locale],
        isRtl,
        text: `Welcome to ${brandName}! Your workspace ${orgName} is ready. Visit ${appUrl} to start.`,
        html: `
          <div dir="${dir}" style="font-family: Arial, sans-serif; text-align: ${align}; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #6366f1; margin-bottom: 20px;">${brandName}</div>
            <h2 style="color: #ffffff;">Welcome to ${brandName}!</h2>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">Your workspace <strong>${orgName}</strong> is fully configured and ready for accounting, sales, inventory, and treasury operations.</p>
            <div style="margin: 30px 0;">
              <a href="${appUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Dashboard</a>
            </div>
          </div>
        `,
      }
    }

    case 'payment_failed': {
      const planName = (vars.planName as string) || 'Subscription'
      const billingUrl = (vars.billingUrl as string) || '#'

      const subjects = {
        en: `Action Required: Payment failed for your ${brandName} subscription`,
        ar: `مطلوب اتخاذ إجراء: فشلت عملية الدفع لاشتراك ${brandName}`,
        tr: `İşlem Gerekli: ${brandName} abonelik ödemeniz başarısız oldu`,
      }

      return {
        subject: subjects[locale],
        isRtl,
        text: `Your recent payment for ${planName} failed. Please update your payment method at ${billingUrl}.`,
        html: `
          <div dir="${dir}" style="font-family: Arial, sans-serif; text-align: ${align}; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #ef4444; margin-bottom: 20px;">${brandName} — Payment Alert</div>
            <h2 style="color: #ffffff;">Payment Failed</h2>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">We could not process the renewal payment for your <strong>${planName}</strong> plan. Your services remain active during the grace period.</p>
            <div style="margin: 30px 0;">
              <a href="${billingUrl}" style="background: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Update Payment Method</a>
            </div>
          </div>
        `,
      }
    }

    case 'usage_limit_warning': {
      const resource = (vars.resource as string) || 'resources'
      const current = vars.currentUsage || 0
      const limit = vars.limit || 0
      const upgradeUrl = (vars.upgradeUrl as string) || '#'

      const subjects = {
        en: `Warning: You have reached 80% of your ${resource} limit`,
        ar: `تحذير: لقد وصلت إلى 80% من الحد المسموح لـ ${resource}`,
        tr: `Uyarı: ${resource} limitinizin %80'ine ulaştınız`,
      }

      return {
        subject: subjects[locale],
        isRtl,
        text: `You have used ${current} of ${limit} ${resource}. Upgrade your plan at ${upgradeUrl}.`,
        html: `
          <div dir="${dir}" style="font-family: Arial, sans-serif; text-align: ${align}; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #f59e0b; margin-bottom: 20px;">${brandName} — Usage Notice</div>
            <h2 style="color: #ffffff;">Approaching Plan Quota</h2>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">Your workspace has utilized <strong>${current} / ${limit}</strong> available ${resource}.</p>
            <div style="margin: 30px 0;">
              <a href="${upgradeUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Upgrade Plan Tier</a>
            </div>
          </div>
        `,
      }
    }

    default: {
      const title = (vars.title as string) || 'Notification from ' + brandName
      const message = (vars.message as string) || 'You have a new notification.'

      return {
        subject: title,
        isRtl,
        text: `${title}\n\n${message}`,
        html: `
          <div dir="${dir}" style="font-family: Arial, sans-serif; text-align: ${align}; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: bold; color: #6366f1; margin-bottom: 20px;">${brandName}</div>
            <h2 style="color: #ffffff;">${title}</h2>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">${message}</p>
          </div>
        `,
      }
    }
  }
}
