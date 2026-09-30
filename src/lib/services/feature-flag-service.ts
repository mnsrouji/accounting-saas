// =============================================================
// Feature Flag Service — Server-Side Evaluation & Rollouts
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { createAuditLog } from '@/lib/audit/create-audit-log'

export interface FeatureFlagRules {
  allowedPlans?: string[]
  allowedBusinesses?: string[]
  allowedUsers?: string[]
  rolloutPercentage?: number
}

export interface EvaluationContext {
  businessId?: string
  userId?: string
  planCode?: string
}

export class FeatureFlagService {
  /**
   * Deterministic server-side evaluation of feature flags.
   */
  static async evaluate(key: string, context?: EvaluationContext): Promise<boolean> {
    return this.isEnabled(key, context)
  }

  static async isEnabled(key: string, context?: EvaluationContext): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
    })

    if (!flag) return false
    if (!flag.isEnabled) return false

    // If no targeting rules, flag is enabled globally
    if (!flag.rules) return true

    const rules = flag.rules as FeatureFlagRules

    // Plan check
    if (rules.allowedPlans && rules.allowedPlans.length > 0) {
      if (!context?.planCode || !rules.allowedPlans.includes(context.planCode)) {
        return false
      }
    }

    // Business check
    if (rules.allowedBusinesses && rules.allowedBusinesses.length > 0) {
      if (!context?.businessId || !rules.allowedBusinesses.includes(context.businessId)) {
        return false
      }
    }

    // User check
    if (rules.allowedUsers && rules.allowedUsers.length > 0) {
      if (!context?.userId || !rules.allowedUsers.includes(context.userId)) {
        return false
      }
    }

    // Percentage rollout (deterministic based on businessId or userId)
    if (typeof rules.rolloutPercentage === 'number') {
      const hashKey = context?.businessId || context?.userId || key
      let hash = 0
      for (let i = 0; i < hashKey.length; i++) {
        hash = (hash << 5) - hash + hashKey.charCodeAt(i)
        hash |= 0
      }
      const bucket = Math.abs(hash) % 100
      if (bucket >= rules.rolloutPercentage) {
        return false
      }
    }

    return true
  }

  /**
   * List all feature flags (Platform Admin).
   */
  static async listFlags() {
    return prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    })
  }

  /**
   * Create or update a feature flag with audit logging (Platform Admin).
   */
  static async setFlag(
    key: string,
    params: {
      name: string
      description?: string
      isEnabled: boolean
      rules?: FeatureFlagRules
    },
    adminUserId: string
  ) {
    const flag = await prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        name: params.name,
        description: params.description,
        isEnabled: params.isEnabled,
        rules: params.rules as object,
      },
      update: {
        name: params.name,
        description: params.description,
        isEnabled: params.isEnabled,
        rules: params.rules as object,
      },
    })

    await createAuditLog({
      userId: adminUserId,
      action: 'update',
      module: 'feature_flags',
      recordType: 'feature_flag',
      recordId: flag.id,
      newValues: {
        key,
        isEnabled: params.isEnabled,
        rules: params.rules,
      },
    })

    return flag
  }
}
