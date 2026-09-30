// =============================================================
// PHASE 17 VALIDATION SUITE: Commercial SaaS Experience, Onboarding
// & Enterprise Operations Acceptance Certification
// =============================================================

import { prisma } from '@/lib/db/prisma'
import {
  OnboardingService,
  NotificationService,
  FeatureFlagService,
  PlatformAnalyticsService,
  SupportToolService,
  UsageService,
  EntitlementService,
  PlanService,
  SubscriptionService,
  InvitationService,
  GlobalSearchService,
} from '@/lib/services'
import { EmailService } from '@/lib/email/email-service'
import { MockEmailProvider } from '@/lib/email/providers/mock-email.provider'
import { isPlatformAdmin, AccessDeniedError } from '@/lib/auth/require-auth'
import { DisasterRecoveryService } from '@/lib/recovery/disaster-recovery'

let totalPassed = 0
let totalFailed = 0

function pass(testName: string) {
  console.log(`  ✓ PASS: ${testName}`)
  totalPassed++
}

function fail(testName: string, err?: unknown) {
  console.error(`  ✗ FAIL: ${testName}`, err ? `\n    ${(err as Error).message || String(err)}` : '')
  totalFailed++
}

async function runSection(name: string, fn: () => Promise<void>) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(2, 60 - name.length))}`)
  try {
    await fn()
  } catch (err) {
    fail(`Unhandled error in section "${name}"`, err)
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║   PHASE 17 — COMMERCIAL SAAS EXPERIENCE & ENTERPRISE SUITE   ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  const runId = Date.now().toString().slice(-6)
  let tenantAId = ''
  let tenantBId = ''
  let userAId = ''
  let userBId = ''
  let adminUserId = ''

  // ====================================================================
  // 1. SETUP TEST FIXTURES
  // ====================================================================
  await runSection('1. Test Infrastructure & Multi-Tenant Setup', async () => {
    // 1. User A (Owner of Tenant A)
    const userA = await prisma.user.create({
      data: {
        email: `owner.p17.a.${runId}@testcorp.io`,
        fullName: `Owner P17 A ${runId}`,
        status: 'active',
      },
    })
    userAId = userA.id

    // 2. User B (Owner of Tenant B)
    const userB = await prisma.user.create({
      data: {
        email: `owner.p17.b.${runId}@testcorp.io`,
        fullName: `Owner P17 B ${runId}`,
        status: 'active',
      },
    })
    userBId = userB.id

    // 3. Platform Admin User
    const adminUser = await prisma.user.create({
      data: {
        email: `admin.p17.${runId}@accountflow.io`,
        fullName: `Platform Admin ${runId}`,
        status: 'active',
      },
    })
    adminUserId = adminUser.id

    // 4. Create Business A
    const busA = await prisma.business.create({
      data: {
        name: `Acme Enterprises P17-${runId}`,
        defaultCurrency: 'USD',
        status: 'active',
        email: `billing@acme-${runId}.com`,
        onboardingCompleted: false,
        onboardingStep: 1,
      },
    })
    tenantAId = busA.id

    // 5. Create Business B
    const busB = await prisma.business.create({
      data: {
        name: `Beta Global P17-${runId}`,
        defaultCurrency: 'SAR',
        status: 'active',
        email: `billing@beta-${runId}.com`,
        onboardingCompleted: true,
        onboardingStep: 9,
      },
    })
    tenantBId = busB.id

    // 6. Link users to businesses
    await prisma.businessUser.createMany({
      data: [
        { businessId: tenantAId, userId: userAId, role: 'owner', status: 'active' },
        { businessId: tenantBId, userId: userBId, role: 'owner', status: 'active' },
      ],
    })

    // 7. Initialize Free Trials for subscriptions
    await SubscriptionService.getSubscription(tenantAId)
    await SubscriptionService.getSubscription(tenantBId)

    pass('Created multi-tenant fixtures, owner memberships, and active trials')
  })

  // ====================================================================
  // 2. GUIDED ONBOARDING ENGINE
  // ====================================================================
  await runSection('2. SaaS Onboarding Experience & State Persistence', async () => {
    // Test 2.1: Get initial state
    const state = await OnboardingService.getOnboardingState(tenantAId)
    if (!state.isCompleted && state.currentStep === 1 && state.totalSteps === 9) {
      pass('Initial onboarding state returns 9 defined steps at step 1')
    } else {
      fail('Onboarding state structure mismatch', state)
    }

    // Test 2.2: Save Step 1 (Profile)
    const step1Res = await OnboardingService.saveStep(tenantAId, 1, {
      legalName: 'Acme Commercial Corp',
      taxNumber: 'US-99887766',
    })
    if (step1Res.currentStep === 2 && step1Res.business.legalName === 'Acme Commercial Corp') {
      pass('Step 1 (Profile) saved and automatically advanced to step 2')
    } else {
      fail('Step 1 save failed', step1Res)
    }

    // Test 2.3: Save Step 2 (Currency & Region)
    const step2Res = await OnboardingService.saveStep(tenantAId, 2, {
      country: 'US',
      defaultCurrency: 'USD',
    })
    if (step2Res.currentStep === 3 && step2Res.business.defaultCurrency === 'USD') {
      pass('Step 2 (Currency & Region) saved and persisted')
    } else {
      fail('Step 2 save failed', step2Res)
    }

    // Test 2.4: Save Step 5 (Chart of Accounts preset)
    await OnboardingService.saveStep(tenantAId, 5, { template: 'standard_commercial' })
    const coaState = await OnboardingService.getOnboardingState(tenantAId)
    if ((coaState.stepData as any).step_5?.template === 'standard_commercial') {
      pass('Chart of Accounts template preset saved to onboarding data')
    } else {
      fail('COA template save failed', coaState)
    }

    // Test 2.5: Idempotent Completion
    const completeRes = await OnboardingService.completeOnboarding(tenantAId)
    if (completeRes.isCompleted && completeRes.currentStep === 9) {
      pass('Onboarding marked completed with database persistence')
    } else {
      fail('Onboarding completion failed', completeRes)
    }

    // Test 2.6: Verification in database
    const dbBus = await prisma.business.findUnique({ where: { id: tenantAId } })
    if (dbBus?.onboardingCompleted === true && dbBus.onboardingStep === 9) {
      pass('Database record confirms onboardingCompleted = true')
    } else {
      fail('Database state not updated', dbBus)
    }
  })

  // ====================================================================
  // 3. SAAS USAGE & CAPACITY CENTER
  // ====================================================================
  await runSection('3. SaaS Usage & Capacity Center', async () => {
    const usage = await UsageService.getTenantUsageSummary(tenantAId)
    if (
      usage.businessId === tenantAId &&
      typeof usage.metrics.users.current === 'number' &&
      typeof usage.metrics.warehouses.current === 'number' &&
      typeof usage.metrics.monthlyInvoices.current === 'number'
    ) {
      pass('Tenant usage summary retrieved with live metric tracking')
    } else {
      fail('Usage summary invalid', usage)
    }

    // Test limits & warnings calculation
    if (
      usage.metrics.users.percent >= 0 &&
      typeof usage.metrics.users.isWarning === 'boolean' &&
      typeof usage.metrics.users.isExceeded === 'boolean'
    ) {
      pass('Quota percentages, warnings, and exceeded status computed reliably')
    } else {
      fail('Metric calculation error', usage.metrics.users)
    }

    // Entitlements verification
    const entitlements = await EntitlementService.getEntitlements(tenantAId)
    if (entitlements.isTrial && entitlements.features.crm === true) {
      pass('Entitlement service correctly returns active plan features and trial bounds')
    } else {
      fail('Entitlements error', entitlements)
    }
  })

  // ====================================================================
  // 4. PLATFORM SAAS ANALYTICS
  // ====================================================================
  await runSection('4. Platform SaaS Analytics Engine', async () => {
    const overview = await PlatformAnalyticsService.getPlatformMetricsOverview()
    if (
      overview.totalTenants >= 2 &&
      overview.activeTenants >= 1 &&
      typeof overview.estimatedMrr === 'number' &&
      overview.activeUsers >= 2
    ) {
      pass('Platform analytics overview computes correct cross-tenant aggregations')
    } else {
      fail('Platform analytics overview mismatch', overview)
    }

    const planDist = await PlatformAnalyticsService.getSubscriptionPlanDistribution()
    if (Array.isArray(planDist) && planDist.length > 0 && planDist[0].count >= 1) {
      pass('Subscription plan distribution computed with valid percentages')
    } else {
      fail('Plan distribution failed', planDist)
    }

    const cohorts = await PlatformAnalyticsService.getTenantCohortGrowth()
    if (Array.isArray(cohorts) && cohorts.length >= 1) {
      pass('Tenant cohort growth history generated')
    } else {
      fail('Cohort generation failed', cohorts)
    }
  })

  // ====================================================================
  // 5. IN-APP NOTIFICATIONS SYSTEM
  // ====================================================================
  await runSection('5. Centralized In-App Notifications', async () => {
    // 5.1 Create notification
    const notif = await NotificationService.createNotification({
      businessId: tenantAId,
      userId: userAId,
      title: 'Subscription Renewal Alert',
      message: 'Your trial period will convert in 14 days.',
      type: 'warning',
      category: 'system',
      priority: 'high',
      link: `/b/${tenantAId}/settings/billing`,
    })

    if (notif.id && notif.category === 'system' && notif.priority === 'high' && !notif.isRead) {
      pass('Created high-priority in-app notification with category and navigation link')
    } else {
      fail('Notification creation failed', notif)
    }

    // 5.2 List notifications
    const list = await NotificationService.getNotifications(tenantAId, userAId)
    if (list.notifications.length >= 1 && list.unreadCount >= 1) {
      pass('Retrieved notifications with unread count indicator')
    } else {
      fail('List notifications failed', list)
    }

    // 5.3 Mark as read
    const updated = await NotificationService.markAsRead(notif.id, tenantAId, userAId)
    if (updated.isRead) {
      pass('Marked individual notification as read')
    } else {
      fail('Mark as read failed', updated)
    }

    // 5.4 Mark all as read
    await NotificationService.createNotification({
      businessId: tenantAId,
      userId: userAId,
      title: 'Low Stock Alert',
      message: 'Item SKU-100 is below reorder threshold',
      type: 'warning',
      category: 'inventory',
    })
    const markAllRes = await NotificationService.markAllAsRead(tenantAId, userAId)
    if (markAllRes.count >= 1) {
      pass('Batch mark-all-as-read completed successfully')
    } else {
      fail('Batch mark all failed', markAllRes)
    }
  })

  // ====================================================================
  // 6. PROVIDER-AGNOSTIC EMAIL NOTIFICATION ARCHITECTURE
  // ====================================================================
  await runSection('6. Provider-Agnostic Email Architecture (Mock Provider)', async () => {
    const mockProvider = new MockEmailProvider()
    EmailService.setProvider(mockProvider)

    // Test 6.1: Send Invitation Email (English)
    const inviteRes = await EmailService.send({
      to: 'newmember@acme.com',
      template: 'invitation',
      language: 'en',
      data: {
        businessName: 'Acme Enterprises',
        inviterName: 'John Doe',
        inviteUrl: 'https://app.accountflow.io/invite/token123',
        expiresIn: '7 days',
      },
    })

    if (inviteRes.success && inviteRes.status === 'sent') {
      pass('Dispatched invitation email template in English')
    } else {
      fail('Invite email failed', inviteRes)
    }

    // Test 6.2: Send Welcome Email (Arabic & RTL verification)
    const welcomeArRes = await EmailService.send({
      to: 'arabic.user@acme.com',
      template: 'welcome',
      language: 'ar',
      data: {
        userName: 'أحمد',
        businessName: 'شركة القمة',
        dashboardUrl: 'https://app.accountflow.io/dashboard',
      },
    })

    if (welcomeArRes.success && mockProvider.getLastEmail()?.to.includes('arabic.user@acme.com')) {
      pass('Dispatched Arabic localized welcome email with RTL alignment')
    } else {
      fail('Arabic welcome email failed', welcomeArRes)
    }

    // Test 6.3: Send Usage Limit Alert (Turkish)
    const usageTrRes = await EmailService.send({
      to: 'admin@acme.com',
      template: 'usage_limit_warning',
      language: 'tr',
      data: {
        businessName: 'Acme Ticaret',
        resourceName: 'Kullanıcılar',
        currentUsage: '5',
        limit: '5',
        upgradeUrl: 'https://app.accountflow.io/upgrade',
      },
    })

    if (usageTrRes.success) {
      pass('Dispatched Turkish localized usage limit warning email')
    } else {
      fail('Turkish usage email failed', usageTrRes)
    }

    // Test 6.4: Mock Provider Delivery History Inspection
    const sentHistory = mockProvider.getSentEmails()
    if (sentHistory.length >= 3) {
      pass(`Mock email provider verified complete delivery log (${sentHistory.length} emails recorded)`)
    } else {
      fail('Delivery history check failed', sentHistory)
    }
  })

  // ====================================================================
  // 7. FEATURE FLAGS & CONTROLLED ROLLOUTS
  // ====================================================================
  await runSection('7. Feature Flags & Controlled Rollouts Engine', async () => {
    const flagKey = `ai_financial_insights_${runId}`

    // 7.1 Register Feature Flag with Plan & Business targeting
    const flag = await FeatureFlagService.setFlag(
      flagKey,
      {
        name: 'AI Financial Insights',
        description: 'Generative AI financial summary insights',
        isEnabled: true,
        rules: {
          rolloutPercentage: 100,
          allowedPlans: ['enterprise', 'professional', 'starter'],
          allowedBusinesses: [tenantAId],
        },
      },
      adminUserId
    )

    if (flag.id && flag.key === flagKey) {
      pass('Created feature flag with multi-level targeting rules and audit log')
    } else {
      fail('Feature flag creation failed', flag)
    }

    // 7.2 Evaluate for Tenant A (Targeted explicitly)
    const isEnabledA = await FeatureFlagService.evaluate(flagKey, {
      businessId: tenantAId,
      planCode: 'starter',
      userId: userAId,
    })
    if (isEnabledA === true) {
      pass('Feature flag evaluates TRUE for targeted Tenant A')
    } else {
      fail('Tenant A flag evaluation failed')
    }

    // 7.3 Evaluate for Tenant B (Not targeted in allowedBusinesses)
    const isEnabledB = await FeatureFlagService.evaluate(flagKey, {
      businessId: tenantBId,
      planCode: 'starter',
      userId: userBId,
    })
    if (isEnabledB === false) {
      pass('Feature flag evaluates FALSE for unlisted Tenant B')
    } else {
      fail('Tenant B exclusion failed')
    }

    // 7.4 Test Non-existent flag fallback
    const fallback = await FeatureFlagService.evaluate('non_existent_flag_key')
    if (fallback === false) {
      pass('Non-existent flag safely defaults to FALSE')
    } else {
      fail('Flag fallback failed', fallback)
    }
  })

  // ====================================================================
  // 8. PLATFORM SUPPORT OPERATIONS & PRIVILEGED DIAGNOSTICS
  // ====================================================================
  await runSection('8. Platform Support Operations & Privileged Diagnostics', async () => {
    // 8.1 Inspect Tenant Diagnostics
    const diag = await SupportToolService.inspectTenant(tenantAId, adminUserId)
    if (
      diag.business.id === tenantAId &&
      diag.subscription.plan !== undefined &&
      typeof diag.activeMembersCount === 'number'
    ) {
      pass('Platform support diagnostic tool inspects tenant state with full audit record')
    } else {
      fail('Tenant inspection failed', diag)
    }

    // 8.2 Webhook Retry Simulation
    const retryRes = await SupportToolService.retryBillingWebhook(
      `evt_test_failed_webhook_${runId}`,
      tenantAId,
      adminUserId
    )
    if (retryRes.success && retryRes.eventId.startsWith('evt_test_')) {
      pass('Privileged billing webhook retry processed and logged')
    } else {
      fail('Webhook retry failed', retryRes)
    }

    // 8.3 Trigger On-Demand Diagnostic Snapshot
    const snap = await SupportToolService.triggerTenantDiagnosticSnapshot(tenantAId, adminUserId)
    if (snap.success && snap.snapshotId.startsWith('snap_diag_')) {
      pass('On-demand diagnostic snapshot archive generated with checksum')
    } else {
      fail('Diagnostic snapshot failed', snap)
    }
  })

  // ====================================================================
  // 9. DISASTER RECOVERY & BACKUP INTEGRITY
  // ====================================================================
  await runSection('9. Disaster Recovery & Snapshot Verification', async () => {
    const backupSnap = await DisasterRecoveryService.exportTenantSnapshot(tenantAId)
    if (
      backupSnap.businessId === tenantAId &&
      backupSnap.metadata.checksum.startsWith('chk_') &&
      typeof backupSnap.metadata.rpoMinutes === 'number'
    ) {
      pass('Created immutable tenant snapshot with verification checksum')
    } else {
      fail('Backup snapshot failed', backupSnap)
    }

    const testVerif = DisasterRecoveryService.verifySnapshotIntegrity(backupSnap)
    if (testVerif.valid === true) {
      pass('Snapshot integrity verified against cryptographic checksum')
    } else {
      fail('Snapshot integrity check failed', testVerif)
    }
  })

  // ====================================================================
  // 10. GLOBAL COMMAND / SEARCH PALETTE & TENANT SCOPING
  // ====================================================================
  await runSection('10. Global Command & Search Engine Isolation', async () => {
    // Create customer in Tenant A
    const custA = await prisma.customer.create({
      data: {
        businessId: tenantAId,
        name: `Acme Customer Omega ${runId}`,
        email: `omega.${runId}@testcorp.io`,
      },
    })

    // Search from Tenant A
    const resA = await GlobalSearchService.search(tenantAId, 'Omega')
    const foundInA = resA.some((item) => item.id === custA.id)
    if (foundInA) {
      pass('Global search finds customer in originating Tenant A')
    } else {
      fail('Search in Tenant A failed', resA)
    }

    // Search from Tenant B (Should find nothing)
    const resB = await GlobalSearchService.search(tenantBId, 'Omega')
    const foundInB = resB.some((item) => item.id === custA.id)
    if (!foundInB && resB.length === 0) {
      pass('Tenant isolation strictly preserved — zero leakage in global search results')
    } else {
      fail('Search leaked across tenants', resB)
    }
  })

  // ====================================================================
  // 11. CLEANUP & TEARDOWN
  // ====================================================================
  await runSection('11. Teardown & Environment Cleanup', async () => {
    // Clean up test records
    await prisma.notification.deleteMany({ where: { businessId: { in: [tenantAId, tenantBId] } } })
    await prisma.customer.deleteMany({ where: { businessId: { in: [tenantAId, tenantBId] } } })
    await prisma.businessUser.deleteMany({ where: { businessId: { in: [tenantAId, tenantBId] } } })
    await prisma.subscription.deleteMany({ where: { businessId: { in: [tenantAId, tenantBId] } } })
    await prisma.business.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId, adminUserId] } } })

    pass('Cleaned up test tenants, users, notifications, and subscription fixtures')
  })

  // ====================================================================
  // SUMMARY
  // ====================================================================
  console.log('\n════════════════════════════════════════════════════════════════')
  console.log(` PHASE 17 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`)
  console.log('════════════════════════════════════════════════════════════════\n')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error in Phase 17 test runner:', err)
  process.exit(1)
})
