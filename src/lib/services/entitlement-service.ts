// =============================================================
// Entitlement Service — Centralized Feature Entitlements & Gates
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { SubscriptionService } from './subscription-service'
import { AccessDeniedError } from '@/lib/auth/require-auth'

export type FeatureKey =
  | 'crm'
  | 'advanced_crm'
  | 'treasury'
  | 'bank_reconciliation'
  | 'advanced_inventory'
  | 'multi_currency'
  | 'financial_reports'
  | 'api_access'
  | 'custom_numbering'
  | 'exports'
  | 'priority_support'

export class EntitlementService {
  /**
   * Check if a business has access to a specific feature based on their active subscription plan.
   */
  static async hasFeature(businessId: string, feature: FeatureKey): Promise<boolean> {
    const subscription = await SubscriptionService.getSubscription(businessId)

    // Suspended or canceled subscriptions cannot access gated features
    if (!subscription.isUsable) {
      return false
    }

    const planFeatures = subscription.plan.features || {}

    // Check direct feature flag
    if (planFeatures[feature] === true) {
      return true
    }

    // Free trial has access to most core features
    if (subscription.isTrial) {
      const trialExcluded: FeatureKey[] = ['api_access', 'priority_support']
      return !trialExcluded.includes(feature)
    }

    return false
  }

  /**
   * Assert feature access server-side; throws AccessDeniedError if not entitled.
   */
  static async assertFeature(businessId: string, feature: FeatureKey, featureName?: string) {
    const allowed = await this.hasFeature(businessId, feature)
    if (!allowed) {
      const label = featureName || feature.replace(/_/g, ' ')
      throw new AccessDeniedError(
        `Feature "${label}" is not included in your current subscription plan. Please upgrade to access this feature.`
      )
    }
  }

  /**
   * Get full entitlement matrix and limits for a business.
   */
  static async getEntitlements(businessId: string) {
    const subscription = await SubscriptionService.getSubscription(businessId)

    const allFeatures: FeatureKey[] = [
      'crm',
      'advanced_crm',
      'treasury',
      'bank_reconciliation',
      'advanced_inventory',
      'multi_currency',
      'financial_reports',
      'api_access',
      'custom_numbering',
      'exports',
      'priority_support',
    ]

    const featureMap: Record<FeatureKey, boolean> = {} as any

    for (const f of allFeatures) {
      featureMap[f] = await this.hasFeature(businessId, f)
    }

    return {
      planName: subscription.plan.name,
      planCode: subscription.plan.code,
      subscriptionStatus: subscription.status,
      isTrial: subscription.isTrial,
      daysRemainingInTrial: subscription.daysRemainingInTrial,
      limits: {
        maxUsers: subscription.plan.maxUsers,
        maxInvoicesPerMonth: subscription.plan.maxInvoicesPerMonth,
      },
      features: featureMap,
    }
  }
}
