// =============================================================
// Onboarding Server Actions — Guided Tenant Setup
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { OnboardingService } from '@/lib/services/onboarding-service'

export async function getOnboardingStateAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId)
    const state = await OnboardingService.getOnboardingState(businessId)
    return { success: true as const, data: state }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch onboarding state' }
  }
}

export async function saveOnboardingStepAction(
  businessId: string,
  step: number,
  data: Record<string, unknown>
) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'write')
    const state = await OnboardingService.saveStep(businessId, step, data, userId)

    revalidatePath(`/b/${businessId}/onboarding`)
    revalidatePath(`/b/${businessId}/dashboard`)
    return { success: true as const, data: state }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to save onboarding step' }
  }
}

export async function completeOnboardingAction(businessId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'write')
    const state = await OnboardingService.completeOnboarding(businessId, userId)

    revalidatePath(`/b/${businessId}/dashboard`)
    revalidatePath(`/b/${businessId}/settings`)
    return { success: true as const, data: state }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to complete onboarding' }
  }
}

export async function resetOnboardingAction(businessId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'full')
    const state = await OnboardingService.resetOnboarding(businessId, userId)

    revalidatePath(`/b/${businessId}/onboarding`)
    revalidatePath(`/b/${businessId}/dashboard`)
    return { success: true as const, data: state }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to reset onboarding' }
  }
}
