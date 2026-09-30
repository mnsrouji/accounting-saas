// =============================================================
// Onboarding Service — Multi-Step Guided Tenant Onboarding
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { SubscriptionService } from './subscription-service'
import { InvitationService } from './invitation-service'
import { NotificationService } from './notification-service'
import { EmailService } from '@/lib/email/email-service'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { MemberRole } from '@prisma/client'

export interface OnboardingState {
  businessId: string
  currentStep: number
  isCompleted: boolean
  business: {
    id: string
    name: string
    legalName?: string | null
    defaultCurrency: string
    country?: string | null
    timezone: string
    fiscalYearStart: string
    taxNumber?: string | null
  }
  stepData: Record<string, unknown>
  totalSteps: number
}

export class OnboardingService {
  static readonly TOTAL_STEPS = 9

  /**
   * Retrieve current onboarding state for a business.
   */
  static async getOnboardingState(businessId: string): Promise<OnboardingState> {
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        legalName: true,
        defaultCurrency: true,
        country: true,
        timezone: true,
        fiscalYearStart: true,
        taxNumber: true,
        onboardingCompleted: true,
        onboardingStep: true,
        onboardingData: true,
      },
    })

    return {
      businessId: business.id,
      currentStep: business.onboardingStep || 1,
      isCompleted: business.onboardingCompleted || false,
      business: {
        id: business.id,
        name: business.name,
        legalName: business.legalName,
        defaultCurrency: business.defaultCurrency,
        country: business.country,
        timezone: business.timezone,
        fiscalYearStart: business.fiscalYearStart,
        taxNumber: business.taxNumber,
      },
      stepData: (business.onboardingData as Record<string, unknown>) || {},
      totalSteps: this.TOTAL_STEPS,
    }
  }

  /**
   * Save progress for a specific onboarding step.
   */
  static async saveStep(
    businessId: string,
    step: number,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<OnboardingState> {
    const current = await this.getOnboardingState(businessId)
    const mergedData = { ...current.stepData, [`step_${step}`]: data }

    // Apply immediate business model updates depending on step
    const businessUpdates: Record<string, unknown> = {
      onboardingStep: Math.min(this.TOTAL_STEPS, Math.max(step + 1, current.currentStep)),
      onboardingData: mergedData,
    }

    if (step === 1) {
      if (data.name) businessUpdates.name = data.name
      if (data.legalName) businessUpdates.legalName = data.legalName
      if (data.taxNumber) businessUpdates.taxNumber = data.taxNumber
    }

    if (step === 2) {
      if (data.defaultCurrency) businessUpdates.defaultCurrency = data.defaultCurrency
      if (data.currency) businessUpdates.defaultCurrency = data.currency
      if (data.country) businessUpdates.country = data.country
      if (data.timezone) businessUpdates.timezone = data.timezone
    }

    if (step === 3 && data.fiscalYearStart) {
      businessUpdates.fiscalYearStart = data.fiscalYearStart
    }

    if (step === 4 && data.defaultTaxRate) {
      // Create or update default tax record
      const existingTax = await prisma.tax.findFirst({
        where: { businessId, isDefault: true },
      })
      if (!existingTax) {
        await prisma.tax.create({
          data: {
            businessId,
            name: (data.taxName as string) || 'Standard VAT',
            code: (data.taxCode as string) || 'VAT',
            rate: Number(data.defaultTaxRate),
            isDefault: true,
            isActive: true,
          },
        })
      }
    }

    if (step === 6 && data.warehouseName) {
      // Ensure default warehouse exists
      const existingWarehouse = await prisma.warehouse.findFirst({
        where: { businessId, isDefault: true },
      })
      if (!existingWarehouse) {
        await prisma.warehouse.create({
          data: {
            businessId,
            name: (data.warehouseName as string) || 'Main Warehouse',
            code: (data.warehouseCode as string) || 'WH-MAIN',
            isDefault: true,
            isActive: true,
          },
        })
      }
    }

    if (step === 7 && Array.isArray(data.invitations) && userId) {
      for (const inv of data.invitations as Array<{ email: string; role: MemberRole }>) {
        if (inv.email) {
          try {
            await InvitationService.inviteUser({
              businessId,
              email: inv.email,
              role: inv.role || 'viewer',
              invitedById: userId,
            })
          } catch {
            // Duplicate invitation ignored safely
          }
        }
      }
    }

    if (step === 8 && data.planCode) {
      await SubscriptionService.changePlan(businessId, data.planCode as string, { userId })
    }

    await prisma.business.update({
      where: { id: businessId },
      data: businessUpdates,
    })

    await createAuditLog({
      businessId,
      userId,
      action: 'update',
      module: 'onboarding',
      recordType: 'onboarding_step',
      recordId: `${businessId}_step_${step}`,
      newValues: { step, data },
    })

    return this.getOnboardingState(businessId)
  }

  /**
   * Finalize and mark onboarding as complete.
   */
  static async completeOnboarding(businessId: string, userId?: string): Promise<OnboardingState> {
    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingCompleted: true,
        onboardingStep: this.TOTAL_STEPS,
      },
    })

    // Send Welcome Notification & Email
    if (userId) {
      await NotificationService.sendNotification({
        businessId,
        userId,
        title: '🎉 Setup Complete!',
        message: `Welcome to ${business.name}. Your workspace is ready for real-world accounting operations.`,
        type: 'success',
        category: 'system',
        priority: 'high',
        link: `/b/${businessId}/dashboard`,
      })
    }

    if (business.email) {
      await EmailService.sendEmail({
        to: { email: business.email },
        template: 'welcome',
        businessId,
        variables: {
          organizationName: business.name,
          appUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/b/${businessId}/dashboard`,
        },
      })
    }

    await createAuditLog({
      businessId,
      userId,
      action: 'update',
      module: 'onboarding',
      recordType: 'onboarding_complete',
      recordId: businessId,
      newValues: { onboardingCompleted: true },
    })

    return this.getOnboardingState(businessId)
  }

  /**
   * Reset onboarding state for testing/reconfiguration.
   */
  static async resetOnboarding(businessId: string, userId?: string): Promise<OnboardingState> {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingCompleted: false,
        onboardingStep: 1,
        onboardingData: {},
      },
    })

    await createAuditLog({
      businessId,
      userId,
      action: 'update',
      module: 'onboarding',
      recordType: 'onboarding_reset',
      recordId: businessId,
      newValues: { onboardingCompleted: false, onboardingStep: 1 },
    })

    return this.getOnboardingState(businessId)
  }
}
