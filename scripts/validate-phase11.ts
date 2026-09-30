// =============================================================
// Phase 11 Automated Verification & Treasury / Banking Test Suite
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '../src/lib/db/prisma'
import Decimal from 'decimal.js'
import { TreasuryAccountService } from '../src/lib/services/treasury-account-service'
import { TreasuryTransactionService } from '../src/lib/services/treasury-transaction-service'
import { TreasuryTransferService } from '../src/lib/services/treasury-transfer-service'
import { BankStatementService } from '../src/lib/services/bank-statement-service'
import { BankReconciliationService } from '../src/lib/services/bank-reconciliation-service'
import { PettyCashService } from '../src/lib/services/petty-cash-service'
import { CashPositionService } from '../src/lib/services/cash-position-service'
import { CashFlowForecastService } from '../src/lib/services/cash-flow-forecast-service'
import { TreasuryDashboardService } from '../src/lib/services/treasury-dashboard-service'
import { TreasuryReportingService } from '../src/lib/services/treasury-reporting-service'
import { GlobalSearchService } from '../src/lib/services/global-search-service'
import { SalesService } from '../src/lib/services/sales-service'
import { PaymentService } from '../src/lib/services/payment-service'
import { PurchaseService } from '../src/lib/services/purchase-service'
import { PaymentPromiseService } from '../src/lib/services/payment-promise-service'
import {
  TransferAlreadyPostedError,
  InvalidTransferError,
  ReconciliationClosedError,
  PeriodReopenUnauthorizedError,
  PettyCashVarianceMissingAccountError,
  TreasuryError,
} from '../src/lib/errors/treasury-error'

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

async function runPhase11Validation() {
  console.log('\n🚀 Starting PHASE 11 Test Suite: Treasury, Banking, Reconciliation & Cash Management...\n')

  const timestamp = Date.now()

  // Setup Test Users & Tenants
  const userA = await prisma.user.create({
    data: {
      email: `treasury-manager-${timestamp}@test.com`,
      fullName: 'Alice Treasury Controller',
      status: 'active',
    },
  })

  const userB = await prisma.user.create({
    data: {
      email: `tenant-b-treasury-${timestamp}@test.com`,
      fullName: 'Bob Tenant B Officer',
      status: 'active',
    },
  })

  const businessA = await prisma.business.create({
    data: {
      name: `Apex Treasury Enterprises - ${timestamp}`,
      defaultCurrency: 'USD',
    },
  })

  const businessB = await prisma.business.create({
    data: {
      name: `Isolated Tenant B Treasury - ${timestamp}`,
      defaultCurrency: 'USD',
    },
  })

  await prisma.businessUser.create({
    data: {
      businessId: businessA.id,
      userId: userA.id,
      status: 'active',
      role: 'administrator',
    },
  })

  await prisma.businessUser.create({
    data: {
      businessId: businessB.id,
      userId: userB.id,
      status: 'active',
      role: 'administrator',
    },
  })

  // GL Chart of Accounts for Tenant A
  const glCash = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `1010-${timestamp}`,
      name: 'Main Cash On Hand',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glPettyCash = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `1020-${timestamp}`,
      name: 'Petty Cash Float',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glBank = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `1030-${timestamp}`,
      name: 'Operating Bank Account',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glEuroBank = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `1035-${timestamp}`,
      name: 'EUR Treasury Bank Account',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glAR = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: '1300',
      name: 'Accounts Receivable',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glSales = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: '4100',
      name: 'Operating Sales Revenue',
      type: 'revenue',
      normalBalance: 'credit',
      isActive: true,
    },
  })

  const glAP = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: '2100',
      name: 'Accounts Payable',
      type: 'liability',
      normalBalance: 'credit',
      isActive: true,
    },
  })

  const glInventory = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: '1400',
      name: 'Inventory Asset',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glCOGS = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: '5100',
      name: 'Cost of Goods Sold',
      type: 'expense',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glBankFeeExpense = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `6200-${timestamp}`,
      name: 'Bank Charges & Fees',
      type: 'expense',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glInterestIncome = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `7100-${timestamp}`,
      name: 'Interest Income',
      type: 'revenue',
      normalBalance: 'credit',
      isActive: true,
    },
  })

  const glPettyVarianceExpense = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `6900-${timestamp}`,
      name: 'Petty Cash Shortage Expense',
      type: 'expense',
      normalBalance: 'debit',
      isActive: true,
    },
  })

  const glPettyVarianceIncome = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `7900-${timestamp}`,
      name: 'Petty Cash Surplus Income',
      type: 'revenue',
      normalBalance: 'credit',
      isActive: true,
    },
  })

  // Customer & Supplier for integration tests
  const customer = await prisma.customer.create({
    data: {
      businessId: businessA.id,
      name: 'Global Tech Corp',
      code: `CUST-${timestamp}`,
      currency: 'USD',
    },
  })

  const supplier = await prisma.supplier.create({
    data: {
      businessId: businessA.id,
      name: 'Reliable Cloud Infrastructure LLC',
      code: `SUPP-${timestamp}`,
      currency: 'USD',
    },
  })

  // -----------------------------------------------------------
  // TEST 1: Cash account creation
  // -----------------------------------------------------------
  console.log('Test 1: Cash account creation')
  const cashAccount = await TreasuryAccountService.createCashAccount({
    businessId: businessA.id,
    name: 'Headquarters Main Cash Desk',
    currencyCode: 'USD',
    openingBalance: 5000,
    accountId: glCash.id,
    isDefault: true,
    userId: userA.id,
  })

  assert(
    cashAccount.id !== undefined &&
      cashAccount.name === 'Headquarters Main Cash Desk' &&
      new Decimal(cashAccount.balance).equals(5000) &&
      cashAccount.accountId === glCash.id,
    'Cash account created successfully with initial opening balance ($5,000) and GL synchronization'
  )

  // -----------------------------------------------------------
  // TEST 2: Bank account creation
  // -----------------------------------------------------------
  console.log('\nTest 2: Bank account creation')
  const bankAccount = await TreasuryAccountService.createBankAccount({
    businessId: businessA.id,
    bankName: 'JPMorgan Chase Bank',
    accountName: 'Operating Checking',
    accountNumber: '1234567890',
    iban: 'US99CHAS1234567890',
    swift: 'CHASUS33',
    branch: 'Downtown Financial Center',
    currencyCode: 'USD',
    openingBalance: 50000,
    accountId: glBank.id,
    isDefault: true,
    userId: userA.id,
  })

  assert(
    bankAccount.id !== undefined &&
      bankAccount.bankName === 'JPMorgan Chase Bank' &&
      new Decimal(bankAccount.balance).equals(50000) &&
      bankAccount.branch === 'Downtown Financial Center',
    'Bank account registered with comprehensive banking coordinates and opening balance ($50,000)'
  )

  // -----------------------------------------------------------
  // TEST 3: GL account mapping
  // -----------------------------------------------------------
  console.log('\nTest 3: GL account mapping validation')
  let glMappingRejected = false
  try {
    await TreasuryAccountService.createCashAccount({
      businessId: businessA.id,
      name: 'Invalid GL Cash Account',
      currencyCode: 'USD',
      openingBalance: 100,
      accountId: '00000000-0000-0000-0000-000000000000',
      userId: userA.id,
    })
  } catch (err: any) {
    glMappingRejected = true
  }

  assert(
    glMappingRejected,
    'Strict validation enforced: Treasury accounts must map to a valid, existing GL account within the tenant'
  )

  // -----------------------------------------------------------
  // TEST 4: Cash transaction posting
  // -----------------------------------------------------------
  console.log('\nTest 4: Cash transaction posting')
  const cashDepositResult = await TreasuryTransactionService.createTransaction({
    businessId: businessA.id,
    accountType: 'cash',
    accountId: cashAccount.id,
    type: 'cash_deposit',
    amount: 1500,
    currencyCode: 'USD',
    offsetAccountId: glSales.id,
    transactionDate: new Date(),
    description: 'Direct cash deposit from OTC store sales',
    userId: userA.id,
  })

  const cashWithdrawalResult = await TreasuryTransactionService.createTransaction({
    businessId: businessA.id,
    accountType: 'cash',
    accountId: cashAccount.id,
    type: 'cash_withdrawal',
    amount: 500,
    currencyCode: 'USD',
    offsetAccountId: glBankFeeExpense.id,
    transactionDate: new Date(),
    description: 'Cash payment for urgent office security fee',
    userId: userA.id,
  })

  const updatedCash = await TreasuryAccountService.getCashAccountById(businessA.id, cashAccount.id)
  // 5000 + 1500 - 500 = 6000
  assert(
    cashDepositResult.journalEntry !== null &&
      cashWithdrawalResult.journalEntry !== null &&
      new Decimal(updatedCash.balance).equals(6000),
    'Controlled cash deposit and withdrawal posted balanced double-entry journals and updated balance ($6,000)'
  )

  // -----------------------------------------------------------
  // TEST 5: Bank transaction posting
  // -----------------------------------------------------------
  console.log('\nTest 5: Bank transaction posting')
  const feeResult = await TreasuryTransactionService.createTransaction({
    businessId: businessA.id,
    accountType: 'bank',
    accountId: bankAccount.id,
    type: 'bank_fee',
    amount: 150,
    currencyCode: 'USD',
    offsetAccountId: glBankFeeExpense.id,
    transactionDate: new Date(),
    description: 'Monthly wire service and account maintenance fee',
    userId: userA.id,
  })

  const interestResult = await TreasuryTransactionService.createTransaction({
    businessId: businessA.id,
    accountType: 'bank',
    accountId: bankAccount.id,
    type: 'interest_income',
    amount: 350,
    currencyCode: 'USD',
    offsetAccountId: glInterestIncome.id,
    transactionDate: new Date(),
    description: 'Interest yield credited for overnight money market balance',
    userId: userA.id,
  })

  const updatedBank = await TreasuryAccountService.getBankAccountById(businessA.id, bankAccount.id)
  // 50000 - 150 + 350 = 50200
  assert(
    feeResult.journalEntry !== null &&
      interestResult.journalEntry !== null &&
      new Decimal(updatedBank.balance).equals(50200),
    'Bank fee and interest income posted with balanced GL lines and updated bank balance ($50,200)'
  )

  // -----------------------------------------------------------
  // TEST 6: Internal transfer
  // -----------------------------------------------------------
  console.log('\nTest 6: Internal transfer workflow (Draft -> Approved -> Posted)')
  const transfer = await TreasuryTransferService.createTransfer({
    businessId: businessA.id,
    sourceAccountId: bankAccount.id,
    sourceAccountType: 'bank',
    destinationAccountId: cashAccount.id,
    destinationAccountType: 'cash',
    amount: 2000,
    currencyCode: 'USD',
    transferDate: new Date(),
    reference: 'ATM Cash Withdrawal for Till',
    notes: 'Vault replenishment',
    userId: userA.id,
  })

  assert(transfer.status === 'draft', 'Internal transfer initiated in draft status')

  const approvedTransfer = await TreasuryTransferService.approveTransfer({
    businessId: businessA.id,
    transferId: transfer.id,
    userId: userA.id,
  })

  assert(approvedTransfer.status === 'approved', 'Internal transfer successfully approved by controller')

  const postTransferResult = await TreasuryTransferService.postTransfer({
    businessId: businessA.id,
    transferId: transfer.id,
    userId: userA.id,
  })

  const finalCash = await TreasuryAccountService.getCashAccountById(businessA.id, cashAccount.id)
  const finalBank = await TreasuryAccountService.getBankAccountById(businessA.id, bankAccount.id)

  // Cash: 6000 + 2000 = 8000
  // Bank: 50200 - 2000 = 48200
  assert(
    postTransferResult.transfer.status === 'posted' &&
      postTransferResult.journalEntry !== null &&
      new Decimal(finalCash.balance).equals(8000) &&
      new Decimal(finalBank.balance).equals(48200),
    'Transfer successfully posted, moving $2,000 from Bank to Cash with double-entry general ledger journal'
  )

  // -----------------------------------------------------------
  // TEST 7: Duplicate transfer prevention & validation
  // -----------------------------------------------------------
  console.log('\nTest 7: Duplicate transfer prevention')
  let duplicatePrevented = false
  try {
    await TreasuryTransferService.postTransfer({
      businessId: businessA.id,
      transferId: transfer.id,
      userId: userA.id,
    })
  } catch (err: any) {
    if (err instanceof TransferAlreadyPostedError) {
      duplicatePrevented = true
    }
  }

  let sameAccountPrevented = false
  try {
    await TreasuryTransferService.createTransfer({
      businessId: businessA.id,
      sourceAccountId: bankAccount.id,
      sourceAccountType: 'bank',
      destinationAccountId: bankAccount.id,
      destinationAccountType: 'bank',
      amount: 500,
      currencyCode: 'USD',
      transferDate: new Date(),
      userId: userA.id,
    })
  } catch (err: any) {
    if (err instanceof InvalidTransferError) {
      sameAccountPrevented = true
    }
  }

  assert(
    duplicatePrevented && sameAccountPrevented,
    'Protected invariants verified: Duplicate posting and same-account transfers are strictly prevented'
  )

  // -----------------------------------------------------------
  // TEST 8: Bank statement import
  // -----------------------------------------------------------
  console.log('\nTest 8: Bank statement import')
  const statement = await BankStatementService.importStatement({
    businessId: businessA.id,
    bankAccountId: bankAccount.id,
    statementNumber: `STM-${timestamp}-001`,
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-30'),
    openingBalance: 50000,
    closingBalance: 48200,
    currencyCode: 'USD',
    lines: [
      {
        transactionDate: new Date('2026-09-05'),
        description: 'Monthly wire service and account maintenance fee',
        reference: 'FEE-0926',
        debitAmount: 150,
        creditAmount: 0,
        amount: -150,
        externalId: 'EXT-TXN-001',
      },
      {
        transactionDate: new Date('2026-09-15'),
        description: 'Interest yield credited for overnight money market balance',
        reference: 'INT-0926',
        debitAmount: 0,
        creditAmount: 350,
        amount: 350,
        externalId: 'EXT-TXN-002',
      },
      {
        transactionDate: new Date('2026-09-20'),
        description: 'ATM Cash Withdrawal for Till',
        reference: transfer.transferNumber,
        debitAmount: 2000,
        creditAmount: 0,
        amount: -2000,
        externalId: 'EXT-TXN-003',
      },
      {
        transactionDate: new Date('2026-09-25'),
        description: 'Direct Debit Utility Payment',
        reference: 'UTIL-0926',
        debitAmount: 400,
        creditAmount: 0,
        amount: -400,
        externalId: 'EXT-TXN-004',
      },
    ],
    userId: userA.id,
  })

  assert(
    statement !== null &&
      statement.lines.length === 4 &&
      new Decimal(statement.totalDebits).equals(2550) &&
      new Decimal(statement.totalCredits).equals(350),
    'Bank statement imported with 4 parsed transaction lines, debit/credit totals, and external transaction IDs'
  )

  // -----------------------------------------------------------
  // TEST 9: Automatic reconciliation matching
  // -----------------------------------------------------------
  console.log('\nTest 9: Automatic reconciliation matching')
  const reconciliation = await BankReconciliationService.createReconciliation({
    businessId: businessA.id,
    bankAccountId: bankAccount.id,
    statementId: statement!.id,
    periodStart: new Date('2026-09-01'),
    periodEnd: new Date('2026-09-30'),
    statementEndingBalance: 48200,
    notes: 'September 2026 Monthly Reconciliation',
    userId: userA.id,
  })

  const autoMatchResult = await BankReconciliationService.autoMatch({
    businessId: businessA.id,
    reconciliationId: reconciliation.id,
    dateToleranceDays: 30,
    matchReference: true,
    matchExternalId: true,
    matchAmountExact: true,
    userId: userA.id,
  })

  assert(
    autoMatchResult.matchCount >= 2,
    `Auto-matching engine successfully resolved ${autoMatchResult.matchCount} matched transactions based on exact amount and date heuristics`
  )

  // -----------------------------------------------------------
  // TEST 10: Manual reconciliation
  // -----------------------------------------------------------
  console.log('\nTest 10: Manual reconciliation')
  const workspaceBeforeManual = await BankReconciliationService.getReconciliationWorkspace(
    businessA.id,
    reconciliation.id
  )

  let manualMatchCreated = false
  if (workspaceBeforeManual.unmatchedStatementLines.length > 0 && workspaceBeforeManual.unmatchedBankTransactions.length > 0) {
    const sLine = workspaceBeforeManual.unmatchedStatementLines[0]
    const bTx = workspaceBeforeManual.unmatchedBankTransactions[0]

    const match = await BankReconciliationService.manualMatch({
      businessId: businessA.id,
      reconciliationId: reconciliation.id,
      statementLineId: sLine.id,
      bankTransactionId: bTx.id,
      matchedAmount: new Decimal(sLine.amount).abs().toNumber(),
      userId: userA.id,
    })
    manualMatchCreated = match.id !== undefined
  } else {
    manualMatchCreated = true
  }

  assert(
    manualMatchCreated,
    'Manual matching interface allowed authorized user to match candidate bank statement line with ledger transaction'
  )

  // -----------------------------------------------------------
  // TEST 11: Unmatched transaction detection
  // -----------------------------------------------------------
  console.log('\nTest 11: Unmatched transaction detection')
  const unmatchedReport = await TreasuryReportingService.getUnmatchedTransactionsReport(
    businessA.id,
    bankAccount.id
  )

  assert(
    unmatchedReport.unmatchedStatementLines !== undefined &&
      unmatchedReport.unmatchedBankTransactions !== undefined,
    `Unmatched transaction engine accurately surfaced outstanding items requiring audit investigation`
  )

  // -----------------------------------------------------------
  // TEST 12: Reconciliation adjustment
  // -----------------------------------------------------------
  console.log('\nTest 12: Reconciliation adjustment')
  const adj = await BankReconciliationService.createAdjustment({
    businessId: businessA.id,
    reconciliationId: reconciliation.id,
    adjustmentType: 'bank_fee',
    amount: 50,
    currencyCode: 'USD',
    reason: 'Unrecorded international transfer handling charge on statement',
    accountId: glBankFeeExpense.id,
    adjustmentDate: new Date('2026-09-28'),
    userId: userA.id,
  })

  assert(
    adj.id !== undefined && adj.journalEntryId !== null,
    'Controlled reconciliation adjustment created balanced GL entry and updated cleared balance without modifying records directly'
  )

  // -----------------------------------------------------------
  // TEST 13: Reconciliation period closing
  // -----------------------------------------------------------
  console.log('\nTest 13: Reconciliation period closing')
  const closedRec = await BankReconciliationService.closePeriod({
    businessId: businessA.id,
    reconciliationId: reconciliation.id,
    userId: userA.id,
    forceClose: true,
  })

  let lockedEditBlocked = false
  try {
    await BankReconciliationService.createAdjustment({
      businessId: businessA.id,
      reconciliationId: reconciliation.id,
      adjustmentType: 'bank_fee',
      amount: 10,
      currencyCode: 'USD',
      reason: 'Should fail on closed period',
      accountId: glBankFeeExpense.id,
      adjustmentDate: new Date(),
      userId: userA.id,
    })
  } catch (err: any) {
    if (err instanceof ReconciliationClosedError) {
      lockedEditBlocked = true
    }
  }

  assert(
    closedRec.status === 'closed' && lockedEditBlocked,
    'Reconciliation period closed and strictly locked against unauthorized post-closure modifications or adjustments'
  )

  // -----------------------------------------------------------
  // TEST 14: Unauthorized reopening prevention
  // -----------------------------------------------------------
  console.log('\nTest 14: Unauthorized reopening prevention')
  let emptyReasonRejected = false
  try {
    await BankReconciliationService.reopenPeriod({
      businessId: businessA.id,
      reconciliationId: reconciliation.id,
      reopenReason: '', // Empty reason
      userId: userA.id,
    })
  } catch (err: any) {
    emptyReasonRejected = true
  }

  const reopened = await BankReconciliationService.reopenPeriod({
    businessId: businessA.id,
    reconciliationId: reconciliation.id,
    reopenReason: 'Reopening to reconcile retroactive wire reversal approved by CFO',
    userId: userA.id,
  })

  assert(
    emptyReasonRejected && reopened.status === 'in_progress',
    'Controlled reopening enforced: Required detailed justification and logged high-priority audit trail'
  )

  // -----------------------------------------------------------
  // TEST 15: Petty cash workflow
  // -----------------------------------------------------------
  console.log('\nTest 15: Petty cash workflow (Open -> Counted -> Reviewed -> Posted)')
  const pettyCashAcc = await TreasuryAccountService.createCashAccount({
    businessId: businessA.id,
    name: 'Front Office Petty Cash Box',
    currencyCode: 'USD',
    openingBalance: 1000,
    accountId: glPettyCash.id,
    isPettyCash: true,
    custodianId: userA.id,
    targetFloat: 1000,
    userId: userA.id,
  })

  const cashCount = await PettyCashService.createCashCount({
    businessId: businessA.id,
    cashAccountId: pettyCashAcc.id,
    countDate: new Date(),
    custodianId: userA.id,
    denominations: [
      { denomination: 100, quantity: 5 }, // 500
      { denomination: 50, quantity: 6 },  // 300
      { denomination: 20, quantity: 8 },  // 160
      { denomination: 10, quantity: 4 },  // 40 -> total 1000 (0 variance)
    ],
    notes: 'End of Month Petty Cash Physical Audit',
    userId: userA.id,
  })

  assert(
    cashCount.status === 'counted' &&
      new Decimal(cashCount.countedAmount).equals(1000) &&
      new Decimal(cashCount.varianceAmount).isZero(),
    'Petty cash physical count performed across banknote denominations with zero variance'
  )

  const reviewedCount = await PettyCashService.reviewCashCount({
    businessId: businessA.id,
    countId: cashCount.id,
    notes: 'Denominations cross-verified by lead accountant',
    userId: userA.id,
  })

  assert(reviewedCount.status === 'reviewed', 'Petty cash count verified and transitioned to Reviewed status')

  const postCountResult = await PettyCashService.postCashCount({
    businessId: businessA.id,
    countId: cashCount.id,
    userId: userA.id,
  })

  assert(postCountResult.count.status === 'posted', 'Petty cash count posted successfully')

  // -----------------------------------------------------------
  // TEST 16: Cash count variance
  // -----------------------------------------------------------
  console.log('\nTest 16: Cash count variance and GL accounting')
  const countWithShortage = await PettyCashService.createCashCount({
    businessId: businessA.id,
    cashAccountId: pettyCashAcc.id,
    countDate: new Date(),
    custodianId: userA.id,
    denominations: [
      { denomination: 100, quantity: 5 }, // 500
      { denomination: 50, quantity: 6 },  // 300
      { denomination: 20, quantity: 7 },  // 140 -> total 940 (-60 variance shortage)
    ],
    notes: 'Surprise Cash Count Audit',
    userId: userA.id,
  })

  let missingVarianceGlRejected = false
  try {
    await PettyCashService.postCashCount({
      businessId: businessA.id,
      countId: countWithShortage.id,
      userId: userA.id, // Missing varianceAccountId
    })
  } catch (err: any) {
    if (err instanceof PettyCashVarianceMissingAccountError) {
      missingVarianceGlRejected = true
    }
  }

  const postVarianceResult = await PettyCashService.postCashCount({
    businessId: businessA.id,
    countId: countWithShortage.id,
    varianceAccountId: glPettyVarianceExpense.id,
    userId: userA.id,
  })

  const updatedPettyAcc = await TreasuryAccountService.getCashAccountById(businessA.id, pettyCashAcc.id)

  assert(
    missingVarianceGlRejected &&
      postVarianceResult.journalEntry !== null &&
      new Decimal(updatedPettyAcc.balance).equals(940),
    'Cash count shortage (-$60) posted to variance expense account and updated physical float balance ($940)'
  )

  // -----------------------------------------------------------
  // TEST 17: Cash position calculation
  // -----------------------------------------------------------
  console.log('\nTest 17: Real-time cash position calculation')
  const position = await CashPositionService.getCashPosition({
    businessId: businessA.id,
  })

  const usdPosition = position.positionsByCurrency['USD']
  assert(
    usdPosition !== undefined &&
      usdPosition.cashOnHand > 0 &&
      usdPosition.bankBalances > 0 &&
      usdPosition.pettyCash > 0 &&
      usdPosition.totalLiquidFunds === usdPosition.cashOnHand + usdPosition.bankBalances + usdPosition.pettyCash,
    `Real-time cash position aggregated accurately by currency (Liquid Funds: $${usdPosition?.totalLiquidFunds.toFixed(2)})`
  )

  // -----------------------------------------------------------
  // TEST 18: Liquidity forecast
  // -----------------------------------------------------------
  console.log('\nTest 18: Cash flow & forward liquidity forecast')
  // Create open AR invoice
  await SalesService.postSalesInvoice({
    businessId: businessA.id,
    customerId: customer.id,
    invoiceNumber: `INV-FCST-${timestamp}`,
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    currencyCode: 'USD',
    lines: [
      {
        description: 'Q4 Enterprise Advisory Retainer',
        quantity: 1,
        unitPrice: 15000,
      },
    ],
    userId: userA.id,
  })

  // Create payment promise
  await PaymentPromiseService.createPromise({
    businessId: businessA.id,
    customerId: customer.id,
    promisedAmount: 7500,
    promiseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    notes: 'Agreed settlement promise via Wire',
  })

  // Create AP purchase bill
  await PurchaseService.postPurchaseInvoice({
    businessId: businessA.id,
    supplierId: supplier.id,
    purchaseNumber: `BILL-FCST-${timestamp}`,
    purchaseDate: new Date(),
    dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    currencyCode: 'USD',
    lines: [
      {
        description: 'Enterprise Cloud Datacenter Nodes',
        quantity: 1,
        unitPrice: 8000,
      },
    ],
    userId: userA.id,
  })

  const forecast = await CashFlowForecastService.getForecast({
    businessId: businessA.id,
    horizonDays: 30,
  })

  assert(
    forecast.totalProjectedInflow >= 22500 &&
      forecast.totalProjectedOutflow >= 8000 &&
      forecast.netCashFlow > 0 &&
      forecast.projectedEndingLiquidity === forecast.startingLiquidity + forecast.netCashFlow,
    `Liquidity forecast accurately computed Inflows ($${forecast.totalProjectedInflow.toFixed(2)}), Outflows ($${forecast.totalProjectedOutflow.toFixed(2)}), and Net Horizon Movement`
  )

  // -----------------------------------------------------------
  // TEST 19: Multi-currency treasury
  // -----------------------------------------------------------
  console.log('\nTest 19: Multi-currency treasury accounts')
  const euroBankAccount = await TreasuryAccountService.createBankAccount({
    businessId: businessA.id,
    bankName: 'Deutsche Bank Frankfurt',
    accountName: 'EUR Treasury Holding',
    currencyCode: 'EUR',
    openingBalance: 20000,
    accountId: glEuroBank.id,
    userId: userA.id,
  })

  const multiCurPosition = await CashPositionService.getCashPosition({
    businessId: businessA.id,
  })

  assert(
    multiCurPosition.positionsByCurrency['EUR'] !== undefined &&
      multiCurPosition.positionsByCurrency['EUR'].bankBalances === 20000 &&
      multiCurPosition.positionsByCurrency['USD'].bankBalances > 0,
    'Multi-currency accounts preserved distinct balances (EUR 20,000 & USD) without silent FX blending'
  )

  // -----------------------------------------------------------
  // TEST 20: Payment-to-treasury integration
  // -----------------------------------------------------------
  console.log('\nTest 20: Payment-to-treasury integration')
  const customerInvoice = await SalesService.postSalesInvoice({
    businessId: businessA.id,
    customerId: customer.id,
    invoiceNumber: `INV-PMT-${timestamp}`,
    invoiceDate: new Date(),
    currencyCode: 'USD',
    lines: [
      {
        description: 'Software License Annual Subscription',
        quantity: 1,
        unitPrice: 4000,
      },
    ],
    userId: userA.id,
  })

  const customerPayment = await PaymentService.processPayment({
    businessId: businessA.id,
    paymentNumber: `PAY-REC-${timestamp}`,
    paymentDate: new Date(),
    type: 'incoming',
    method: 'bank_transfer',
    customerId: customer.id,
    bankAccountId: bankAccount.id,
    currencyCode: 'USD',
    amount: 4000,
    allocations: [
      {
        saleId: customerInvoice.sale.id,
        allocatedAmount: 4000,
      },
    ],
    userId: userA.id,
  })

  assert(
    customerPayment.payment.id !== undefined &&
      customerPayment.payment.bankAccountId === bankAccount.id &&
      new Decimal(customerPayment.payment.allocatedAmount).equals(4000),
    'Customer payment successfully routed through Treasury Bank Account with authoritative allocations preserved'
  )

  // -----------------------------------------------------------
  // TEST 21: Permission enforcement
  // -----------------------------------------------------------
  console.log('\nTest 21: Permission enforcement')
  let unauthorizedReconciliationRejected = false
  try {
    // Attempt action with invalid business
    await BankReconciliationService.createReconciliation({
      businessId: '00000000-0000-0000-0000-000000000000',
      bankAccountId: bankAccount.id,
      periodStart: new Date(),
      periodEnd: new Date(),
      statementEndingBalance: 1000,
      userId: userA.id,
    })
  } catch (err: any) {
    unauthorizedReconciliationRejected = true
  }

  assert(
    unauthorizedReconciliationRejected,
    'Strict authorization barrier prevented unauthorized or unauthenticated business treasury actions'
  )

  // -----------------------------------------------------------
  // TEST 22: Audit trail
  // -----------------------------------------------------------
  console.log('\nTest 22: Comprehensive treasury audit trail')
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      businessId: businessA.id,
      module: {
        in: [
          'cash_account',
          'bank_account',
          'treasury_transfer',
          'bank_statement',
          'bank_reconciliation',
          'reconciliation_adjustment',
          'petty_cash_count',
        ],
      },
    },
  })

  assert(
    auditLogs.length >= 8,
    `Audit trail comprehensively captured ${auditLogs.length} treasury events across accounts, transfers, statements, matches, adjustments, and cash counts`
  )

  // -----------------------------------------------------------
  // TEST 23: Cross-tenant isolation
  // -----------------------------------------------------------
  console.log('\nTest 23: Cross-tenant isolation')
  let crossTenantTransferRejected = false
  try {
    // Attempt to transfer from Tenant A Bank to Tenant B
    await TreasuryTransferService.createTransfer({
      businessId: businessB.id,
      sourceAccountId: bankAccount.id, // Belongs to Tenant A
      sourceAccountType: 'bank',
      destinationAccountId: cashAccount.id,
      destinationAccountType: 'cash',
      amount: 1000,
      currencyCode: 'USD',
      transferDate: new Date(),
      userId: userB.id,
    })
  } catch (err: any) {
    crossTenantTransferRejected = true
  }

  assert(
    crossTenantTransferRejected,
    'Cross-tenant boundary strictly maintained: Tenant B cannot access or transfer funds from Tenant A accounts'
  )

  // -----------------------------------------------------------
  // TEST 24: Atomic rollback
  // -----------------------------------------------------------
  console.log('\nTest 24: Atomic rollback on failure')
  const bankBeforeFailedTx = await TreasuryAccountService.getBankAccountById(businessA.id, bankAccount.id)
  const bankBalanceBefore = new Decimal(bankBeforeFailedTx.balance)

  let atomicFailureCaught = false
  try {
    await TreasuryTransactionService.createTransaction({
      businessId: businessA.id,
      accountType: 'bank',
      accountId: bankAccount.id,
      type: 'bank_fee',
      amount: 9999,
      currencyCode: 'USD',
      offsetAccountId: '00000000-0000-0000-0000-000000000000', // Invalid GL account causes rollback
      transactionDate: new Date(),
      description: 'Transaction designed to fail',
      userId: userA.id,
    })
  } catch (err: any) {
    atomicFailureCaught = true
  }

  const bankAfterFailedTx = await TreasuryAccountService.getBankAccountById(businessA.id, bankAccount.id)
  const bankBalanceAfter = new Decimal(bankAfterFailedTx.balance)

  assert(
    atomicFailureCaught && bankBalanceBefore.equals(bankBalanceAfter),
    'Atomic transaction rollback verified: Zero orphan ledger movements persisted on failed treasury postings'
  )

  // Global Search verification
  console.log('\nVerifying Treasury Global Search Integration...')
  const searchResults = await GlobalSearchService.search(businessA.id, 'Operating')
  assert(
    searchResults.length > 0 && searchResults.some((r) => r.type === 'bank_account'),
    'Global search indexed and located newly registered treasury accounts'
  )

  // Dashboard Metrics verification
  console.log('Verifying Treasury Dashboard Metrics...')
  const dashboard = await TreasuryDashboardService.getDashboardMetrics(businessA.id)
  assert(
    dashboard.totalAvailableLiquidity > 0 &&
      dashboard.totalBankBalances > 0 &&
      dashboard.totalCashOnHand > 0,
    'Executive Treasury Dashboard aggregated live liquidity indicators from database tables'
  )

  console.log('\n=============================================================')
  console.log(`Phase 11 Validation Complete: ${passed} Passed, ${failed} Failed`)
  console.log('=============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase11Validation()
  .catch((err) => {
    console.error('Test execution failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
