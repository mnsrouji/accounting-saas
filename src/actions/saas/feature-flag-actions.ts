// =============================================================
// Feature Flag Server Actions — Admin Configuration & Rollouts
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import { FeatureFlagService, FeatureFlagRules } from '@/lib/services/feature-flag-service'

export async function listFeatureFlagsAction() {
  try {
    await requirePlatformAdmin()
    const flags = await FeatureFlagService.listFlags()
    return { success: true as const, data: flags }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Unauthorized' }
  }
}

export async function setFeatureFlagAction(
  key: string,
  params: {
    name: string
    description?: string
    isEnabled: boolean
    rules?: FeatureFlagRules
  }
) {
  try {
    const admin = await requirePlatformAdmin()
    const flag = await FeatureFlagService.setFlag(key, params, admin.id)
    revalidatePath('/admin/flags')
    return { success: true as const, data: flag }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update feature flag' }
  }
}
