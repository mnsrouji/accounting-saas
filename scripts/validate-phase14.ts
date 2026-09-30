// =============================================================
// Phase 14 Automated Verification & SaaS Platform Acceptance Suite
// Multi-Tenant SaaS Administration, Subscriptions & Infrastructure
// =============================================================

import { prisma } from '../src/lib/db/prisma'
import Decimal from 'decimal.js'
import { PlanService } from '../src/lib/services/plan-service'
import { SubscriptionService } from '../src/lib/services/subscription-service'
import { EntitlementService } from '../src/lib/services/entitlement-service'
import { UsageService } from '../src/lib/services/usage-service'
import { InvitationService } from '../src/lib/services/invitation-service'
import { PlatformDashboardService } from '../src/lib/services/platform-dashboard-service'
import { isPlatformAdmin, AccessDeniedError, ValidationError } from '../src/lib/auth/require-auth'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${message}`)
  } else {
    failed++
    console.error(`  ❌ FAIL: ${message}`)
  }
}

async function runPhase14Suite() {
  console.log('\n=============================================================')
  console.log('🚀 Starting PHASE 14 Suite: SaaS Platform, Subscriptions & Admin')
  console.log('=============================================================\n')

  // Setup Test Tenant
  const testEmail = `saas-admin-${Date.now()}@accountflow.io`
  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      fullName: 'SaaS Platform Test Lead',
      status: 'active',
    },
  })

  const testBusiness = await prisma.business.create({
    data: {
      name: `SaaS Apex Corp ${Date.now()}`,
      legalName: 'SaaS Apex Holdings LLC',
      defaultCurrency: 'USD',
      status: 'active',
    },
  })

  await prisma.businessUser.create({
    data: {
      userId: testUser.id,
      businessId: testBusiness.id,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    },
  })

  // -------------------------------------------------------------
  // 1. Subscription Plans & Tiers Architecture
  // -------------------------------------------------------------
  console.log('--- 1. Subscription Plans & Tiers Architecture ---')

  const plans = await PlanService.getPlans()
  assert(plans.length >= 4, `Predefined SaaS plans seeded (found ${plans.length} tiers)`)

  const starter = await PlanService.getPlanByCode('starter')
  const pro = await PlanService.getPlanByCode('professional')
  const enterprise = await PlanService.getPlanByCode('enterprise')
  const trial = await PlanService.getPlanByCode('trial')

  assert(Boolean(starter && pro && enterprise && trial), 'Starter, Professional, Enterprise, and Trial plans available')
  assert(Number(starter?.price) === 29 && Number(pro?.price) === 89 && Number(enterprise?.price) === 249, 'Tier pricing matches SaaS configuration ($29, $89, $249)')

  // -------------------------------------------------------------
  // 2. Subscription Lifecycle & Auto-Provisioning
  // -------------------------------------------------------------
  console.log('\n--- 2. Subscription Lifecycle & Auto-Provisioning ---')

  // Step 2.1: Auto-provision free trial on first lookup
  const initialSub = await SubscriptionService.getSubscription(testBusiness.id)
  assert(initialSub.isTrial === true, 'Free Trial automatically provisioned on organization setup')
  assert(initialSub.isUsable === true && (initialSub.daysRemainingInTrial ?? 0) > 0, `Trial active with ${initialSub.daysRemainingInTrial} days remaining`)

  // Step 2.2: Upgrade to Professional tier
  const proSub = await SubscriptionService.changePlan(testBusiness.id, 'professional', { userId: testUser.id })
  assert(proSub.plan.code === 'professional' && proSub.status === 'active', 'Successfully upgraded to Professional plan tier')
  assert(proSub.isTrial === false, 'Trial flag cleanly removed after plan activation')

  // Step 2.3: Upgrade to Enterprise tier
  const entSub = await SubscriptionService.changePlan(testBusiness.id, 'enterprise', { userId: testUser.id })
  assert(entSub.plan.code === 'enterprise' && entSub.plan.maxUsers === 100, 'Successfully upgraded to Enterprise plan (100 seats limit)')

  // Step 2.4: Schedule cancellation
  const canceledSub = await SubscriptionService.cancelSubscription(testBusiness.id, false, testUser.id)
  assert(canceledSub.cancelAtPeriodEnd === true, 'Cancellation scheduled at period end without immediately revoking access')

  // -------------------------------------------------------------
  // 3. Centralized Feature Entitlements & Gates
  // -------------------------------------------------------------
  console.log('\n--- 3. Centralized Feature Entitlements & Gates ---')

  // Enterprise has all features
  const hasTreasury = await EntitlementService.hasFeature(testBusiness.id, 'treasury')
  const hasRecon = await EntitlementService.hasFeature(testBusiness.id, 'bank_reconciliation')
  const hasApi = await EntitlementService.hasFeature(testBusiness.id, 'api_access')
  assert(hasTreasury && hasRecon && hasApi, 'Enterprise tenant entitled to Treasury, Bank Reconciliation, and REST API')

  // Switch to Starter and verify feature gating
  await SubscriptionService.changePlan(testBusiness.id, 'starter', { userId: testUser.id })
  const starterHasRecon = await EntitlementService.hasFeature(testBusiness.id, 'bank_reconciliation')
  const starterHasTreasury = await EntitlementService.hasFeature(testBusiness.id, 'treasury')
  const starterHasCRM = await EntitlementService.hasFeature(testBusiness.id, 'crm')

  assert(starterHasRecon === false, 'Starter tier correctly restricted from Bank Reconciliation')
  assert(starterHasTreasury === false, 'Starter tier correctly restricted from Treasury module')
  assert(starterHasCRM === true, 'Starter tier retains access to standard CRM features')

  let entitlementErrorCaught = false
  try {
    await EntitlementService.assertFeature(testBusiness.id, 'bank_reconciliation')
  } catch (err: any) {
    if (err instanceof AccessDeniedError) {
      entitlementErrorCaught = true
    }
  }
  assert(entitlementErrorCaught, 'Authoritative assertFeature throws AccessDeniedError on unentitled feature')

  // Restore to Professional for remainder of tests
  await SubscriptionService.changePlan(testBusiness.id, 'professional', { userId: testUser.id })

  // -------------------------------------------------------------
  // 4. Tenant Usage Tracking & Limit Enforcement
  // -------------------------------------------------------------
  console.log('\n--- 4. Tenant Usage Tracking & Limit Enforcement ---')

  const usageSummary = await UsageService.getTenantUsageSummary(testBusiness.id)
  assert(usageSummary.metrics.users.current === 1, `Live user quota tracking verified (${usageSummary.metrics.users.current} active user)`)
  assert(usageSummary.metrics.users.limit === 15, `Plan limit accurately reflected (${usageSummary.metrics.users.limit} seats)`)
  assert(usageSummary.hasExceeded === false, 'Usage remains within plan allocation limits')

  const canAddMoreUsers = await UsageService.canAddUser(testBusiness.id)
  assert(canAddMoreUsers === true, 'Quota validator permits additional user onboarding')

  // -------------------------------------------------------------
  // 5. User Invitations & Team Membership Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- 5. User Invitations & Team Membership Lifecycle ---')

  const inviteEmail = `member-${Date.now()}@saasapex.com`

  // Step 5.1: Send Invitation
  const invitation = await InvitationService.inviteUser({
    businessId: testBusiness.id,
    email: inviteEmail,
    fullName: 'Alex Finance',
    role: 'accountant',
    invitedById: testUser.id,
  })
  assert(invitation.status === 'invited' && invitation.role === 'accountant', 'User invitation dispatched with status "invited"')

  // Step 5.2: Accept Invitation
  const accepted = await InvitationService.acceptInvitation(testBusiness.id, invitation.userId)
  assert(accepted.status === 'active' && accepted.joinedAt !== null, 'Invitation accepted and membership activated')

  // Step 5.3: Update Role
  const roleUpdated = await InvitationService.updateMemberRole(testBusiness.id, invitation.userId, 'sales_user', testUser.id)
  assert(roleUpdated.role === 'sales_user', 'Member role updated to sales_user')

  // Step 5.4: Status toggle (deactivate / reactivate)
  const deactivated = await InvitationService.updateMemberStatus(testBusiness.id, invitation.userId, 'inactive', testUser.id)
  assert(deactivated.status === 'inactive', 'Member temporarily deactivated')

  const reactivated = await InvitationService.updateMemberStatus(testBusiness.id, invitation.userId, 'active', testUser.id)
  assert(reactivated.status === 'active', 'Member reactivated')

  // Step 5.5: Owner Protection Rule
  let ownerProtectionWorked = false
  try {
    await InvitationService.removeMember(testBusiness.id, testUser.id, testUser.id)
  } catch (err: any) {
    if (err instanceof AccessDeniedError) {
      ownerProtectionWorked = true
    }
  }
  assert(ownerProtectionWorked, 'Business owner protection enforced: Cannot remove the sole active owner')

  // Step 5.6: Clean removal of regular member
  const removalResult = await InvitationService.removeMember(testBusiness.id, invitation.userId, testUser.id)
  assert(removalResult.success === true, 'Non-owner member removed cleanly from organization')

  // -------------------------------------------------------------
  // 6. Platform Administration & Tenant Operations
  // -------------------------------------------------------------
  console.log('\n--- 6. Platform Administration & Tenant Operations ---')

  const platformOverview = await PlatformDashboardService.getPlatformOverview()
  assert(platformOverview.totalBusinesses > 0, `Platform overview aggregated ${platformOverview.totalBusinesses} organizations`)
  assert(platformOverview.estimatedMrr >= 0, `Estimated platform MRR calculated ($${platformOverview.estimatedMrr})`)
  assert(platformOverview.planDistribution.length > 0, 'Plan distribution analytics generated')

  const { tenants } = await PlatformDashboardService.listTenants({ search: 'SaaS Apex' })
  assert(tenants.length >= 1, 'Tenant search and filter operational')

  // Lifecycle status change: Suspend -> Reactivate
  const suspended = await PlatformDashboardService.updateTenantStatus(testBusiness.id, 'suspended', testUser.id, 'Payment audit')
  assert(suspended.status === 'suspended', 'Tenant suspended via Platform Admin lifecycle control')

  const reactivatedTenant = await PlatformDashboardService.updateTenantStatus(testBusiness.id, 'active', testUser.id, 'Verification complete')
  assert(reactivatedTenant.status === 'active', 'Tenant reactivated to normal operation')

  // -------------------------------------------------------------
  // 7. Security Boundaries & Authorization Whitelist
  // -------------------------------------------------------------
  console.log('\n--- 7. Security Boundaries & Authorization Whitelist ---')

  assert(isPlatformAdmin('admin@accountflow.io') === true, 'Default admin whitelist recognized')
  assert(isPlatformAdmin('random.user@external.com') === false, 'External tenant user rejected from platform administration')

  // -------------------------------------------------------------
  // 8. Health Monitoring & Database Telemetry
  // -------------------------------------------------------------
  console.log('\n--- 8. Health Monitoring & Database Telemetry ---')

  const t0 = Date.now()
  await prisma.$queryRaw`SELECT 1`
  const latency = Date.now() - t0
  assert(latency >= 0 && latency < 500, `Database round-trip query health verified (Latency: ${latency} ms)`)

  // -------------------------------------------------------------
  // 9. Platform Audit Trail & Compliance
  // -------------------------------------------------------------
  console.log('\n--- 9. Platform Audit Trail & Compliance ---')

  const auditLogs = await PlatformDashboardService.getPlatformAuditLogs(20)
  const hasSaasAudits = auditLogs.some((l) => l.module === 'subscription' || l.module === 'members' || l.module === 'platform_administration')
  assert(hasSaasAudits, 'Platform actions and subscription lifecycle events recorded in immutable AuditLog')

  // Clean up test data
  await prisma.subscription.deleteMany({ where: { businessId: testBusiness.id } })
  await prisma.businessUser.deleteMany({ where: { businessId: testBusiness.id } })
  await prisma.business.delete({ where: { id: testBusiness.id } })
  await prisma.user.delete({ where: { id: testUser.id } })

  console.log('\n=============================================================')
  console.log(`Phase 14 Acceptance Complete: ${passed} Passed, ${failed} Failed`)
  console.log('=============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase14Suite().catch((err) => {
  console.error('Fatal error during Phase 14 validation suite:', err)
  process.exit(1)
})
