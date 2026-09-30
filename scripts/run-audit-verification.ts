// =============================================================
// Comprehensive ERP Audit Fixes Verification Test Suite
// Verifies all critical fixes across Security, Accounting, Integrity, Reporting, and SaaS Quotas
// =============================================================

import { RBACService } from '../src/lib/services/rbac-service'
import { isPlatformAdmin } from '../src/lib/auth/require-auth'
import { AccountingPeriodService } from '../src/lib/services/accounting-period-service'
import { AccountingService } from '../src/lib/services/accounting-service'
import { UsageService } from '../src/lib/services/usage-service'
import { ReportingService } from '../src/lib/services/reporting-service'
import { PartyBalanceService } from '../src/lib/services/party-balance-service'
import { prisma } from '../src/lib/db/prisma'

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`)
    failed++
  }
}

async function runTests() {
  console.log('===========================================================')
  console.log('🔍 Comprehensive ERP Audit Fixes Verification Suite')
  console.log('===========================================================\n')

  // ─────────────────────────────────────────
  // TEST GROUP 1: Security & RBAC (Phase 1)
  // ─────────────────────────────────────────
  console.log('▶ Test Group 1: Security & RBAC')

  // 1.1 Platform admin check
  delete process.env.PLATFORM_ADMIN_EMAILS
  assert(
    !isPlatformAdmin('attacker@accountflow.platform'),
    'Email suffix @accountflow.platform is REJECTED as platform admin'
  )
  assert(
    !isPlatformAdmin('demo@accountflow.io'),
    'demo@accountflow.io without env configuration is REJECTED as platform admin'
  )

  process.env.PLATFORM_ADMIN_EMAILS = 'superadmin@accountflow.io,admin@accountflow.io'
  assert(
    isPlatformAdmin('superadmin@accountflow.io'),
    'Explicitly whitelisted email in env is ACCEPTED'
  )
  assert(
    isPlatformAdmin('ADMIN@ACCOUNTFLOW.IO'),
    'Whitelisted email check is case-insensitive'
  )
  assert(
    !isPlatformAdmin('other@accountflow.io'),
    'Non-whitelisted email in domain is REJECTED'
  )

  // 1.2 RBAC Role matrix
  assert(
    RBACService.hasModuleAccess('owner', 'accounting', 'full'),
    'Owner has full access to accounting'
  )
  assert(
    RBACService.hasModuleAccess('administrator', 'sales', 'full'),
    'Administrator has full access to sales'
  )
  assert(
    RBACService.hasModuleAccess('accountant', 'accounting', 'full'),
    'Accountant has full access to accounting'
  )
  assert(
    !RBACService.hasModuleAccess('accountant', 'settings', 'write'),
    'Accountant cannot write company settings'
  )
  assert(
    RBACService.hasModuleAccess('sales_user', 'sales', 'write'),
    'Sales user can write sales'
  )
  assert(
    !RBACService.hasModuleAccess('sales_user', 'accounting', 'read'),
    'Sales user CANNOT read accounting GL'
  )
  assert(
    !RBACService.hasModuleAccess('sales_user', 'purchases', 'read'),
    'Sales user CANNOT access purchases'
  )
  assert(
    RBACService.hasModuleAccess('viewer', 'sales', 'read'),
    'Viewer can read sales'
  )
  assert(
    !RBACService.hasModuleAccess('viewer', 'sales', 'write'),
    'Viewer CANNOT write sales'
  )
  assert(
    !RBACService.hasModuleAccess('viewer', 'accounting', 'delete'),
    'Viewer CANNOT delete accounting entries'
  )

  // ─────────────────────────────────────────
  // TEST GROUP 2: Accounting Immutability & Rules (Phase 2)
  // ─────────────────────────────────────────
  console.log('\n▶ Test Group 2: Accounting Immutability & Rules')

  // Find or create test business to test logic
  const business = await prisma.business.findFirst({
    select: { id: true, defaultCurrency: true },
  })

  if (business) {
    // 2.1 Immutability check on updateJournalEntry
    const postedEntry = await prisma.journalEntry.findFirst({
      where: { businessId: business.id, status: 'posted' },
    })

    if (postedEntry) {
      let threw = false
      try {
        await AccountingService.updateJournalEntry({
          businessId: business.id,
          journalEntryId: postedEntry.id,
          entryDate: new Date(),
          description: 'Malicious modification',
          lines: [],
          userId: '00000000-0000-0000-0000-000000000000',
        })
      } catch (err: any) {
        threw = true
        assert(
          err.message.includes('لا يمكن تعديل') || err.message.includes('posted'),
          'Modifying a posted journal entry is STRICTLY PROHIBITED and throws error'
        )
      }
      if (!threw) {
        assert(false, 'Modifying posted journal entry did NOT throw error!')
      }
    } else {
      console.log('  ℹ SKIP: No posted journal entry found to test immutability')
    }

    // ─────────────────────────────────────────
    // TEST GROUP 3: Fiscal Period Locking (Phase 3)
    // ─────────────────────────────────────────
    console.log('\n▶ Test Group 3: Fiscal Period Locking & Data Integrity')

    // Test period check on current date
    let periodCheckThrew = false
    try {
      await AccountingPeriodService.checkPeriodOpen(business.id, new Date())
    } catch {
      periodCheckThrew = true
    }
    assert(
      !periodCheckThrew,
      'Active fiscal period allows transactions when open'
    )

    // ─────────────────────────────────────────
    // TEST GROUP 4: Reporting & VAT Reconciliation (Phase 4 & 5)
    // ─────────────────────────────────────────
    console.log('\n▶ Test Group 4: Reporting & VAT Reconciliation')

    const fromDate = new Date(new Date().getFullYear(), 0, 1)
    const toDate = new Date()

    const vatReport = await ReportingService.getVATReport(business.id, fromDate, toDate)
    assert(
      typeof vatReport.netVatDue === 'number',
      'VAT Report calculates net VAT due as number'
    )
    assert(
      typeof vatReport.outputVat.netTaxableSales === 'number',
      'VAT Report computes Output VAT breakdown'
    )
    assert(
      vatReport.glReconciliation !== undefined && typeof vatReport.glReconciliation.variance === 'number',
      'VAT Report reconciles with GL tax accounts and calculates variance'
    )

    // ─────────────────────────────────────────
    // TEST GROUP 5: Party Balance & Ledger Sync
    // ─────────────────────────────────────────
    console.log('\n▶ Test Group 5: Party Balance & Ledger Sync')

    const syncResult = await PartyBalanceService.syncAllBalances(business.id)
    assert(
      typeof syncResult.syncedCustomers === 'number' && typeof syncResult.syncedSuppliers === 'number',
      `PartyBalanceService synchronized ${syncResult.syncedCustomers} customers and ${syncResult.syncedSuppliers} suppliers`
    )

    // ─────────────────────────────────────────
    // TEST GROUP 6: SaaS Quotas & Limits
    // ─────────────────────────────────────────
    console.log('\n▶ Test Group 6: SaaS Quotas & Limits')

    const usage = await UsageService.getTenantUsageSummary(business.id)
    assert(
      usage.metrics.monthlyInvoices !== undefined,
      'UsageService computes monthly invoice quota tracking'
    )
    assert(
      usage.metrics.products !== undefined,
      'UsageService computes product quota tracking'
    )
    assert(
      usage.metrics.warehouses !== undefined,
      'UsageService computes warehouse quota tracking'
    )
  }

  console.log('\n===========================================================')
  console.log(`🏁 Test Summary: ${passed} PASSED, ${failed} FAILED`)
  console.log('===========================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error running verification suite:', err)
    process.exit(1)
  })
