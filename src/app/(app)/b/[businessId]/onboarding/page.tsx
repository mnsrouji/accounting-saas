import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { OnboardingService } from '@/lib/services/onboarding-service'
import { PlanService } from '@/lib/services/plan-service'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  await requireBusinessAccess(businessId, 'settings', 'write')

  const [state, plans] = await Promise.all([
    OnboardingService.getOnboardingState(businessId),
    PlanService.getPlans(),
  ])

  return <OnboardingClient initialData={state} plans={plans} />
}
