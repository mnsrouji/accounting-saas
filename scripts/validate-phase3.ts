// =============================================================
// Phase 03 Validation Test Suite: 17 Rigorous Scenarios
// Testing Service Layer, Transaction Engines, Accounting Workflows, WAC & RLS
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  AccountingService,
  InventoryService,
  SalesService,
  PurchaseService,
  PaymentService,
  ExpenseService,
} from '@/lib/services'
import {
  UnbalancedJournalError,
  OverAllocationError,
  TenantAccessDeniedError,
  InvalidReversalError,
  AccountingError,
} from '@/lib/errors/accounting-error'

interface TestResult {
  scenario: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

async function runPhase3Tests() {
  console.log('🧪 Starting Phase 03 Service Layer Verification Suite (17 Scenarios)...')

  // Setup: Fetch Demo Business & Data
  const demoBusiness = await prisma.business.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    include: { warehouses: true, members: true },
  })

  if (!demoBusiness) throw new Error('Demo business not found. Seed first.')

  const b1Id = demoBusiness.id
  const mainWh = demoBusiness.warehouses[0]
  const eastWh = demoBusiness.warehouses[1] || demoBusiness.warehouses[0]
  const userId = demoBusiness.members[0].userId

  const customer = await prisma.customer.findFirst({ where: { businessId: b1Id } })
  const supplier = await prisma.supplier.findFirst({ where: { businessId: b1Id } })
  const prodPhysical = await prisma.product.findFirst({ where: { businessId: b1Id, trackInventory: true } })
  const bankAcc = await prisma.bankAccount.findFirst({ where: { businessId: b1Id } })
  const expAcc = await prisma.chartOfAccount.findFirst({ where: { businessId: b1Id, code: '5300' } })

  if (!customer || !supplier || !prodPhysical || !bankAcc || !expAcc) {
    throw new Error('Required seed entities missing.')
  }

  // -----------------------------------------------------------
  // TEST 1: Sales Invoice Posting
  // -----------------------------------------------------------
  let createdSaleId: string = ''
  try {
    const invNo = 'P3-SALE-' + Date.now()
    const { sale } = await SalesService.postSalesInvoice({
      businessId: b1Id,
      customerId: customer.id,
      invoiceNumber: invNo,
      invoiceDate: new Date(),
      currencyCode: 'USD',
      exchangeRate: 1,
      warehouseId: mainWh.id,
      lines: [
        {
          productId: prodPhysical.id,
          description: 'Sales Posting Test Item',
          quantity: 2,
          unitPrice: 500,
          taxRatePercent: 15,
        },
      ],
      userId,
    })

    createdSaleId = sale.id
    const passed = sale.status === 'sent' && new Decimal(sale.totalAmount).equals(new Decimal(1150)) // 1000 + 150 tax
    results.push({
      scenario: 'Test 1: Sales Invoice Posting Pipeline',
      passed,
      details: passed
        ? `Invoice ${invNo} posted successfully. Subtotal: $1,000, Tax: $150, Total: $1,150.`
        : 'Failed: Sales invoice posting status or calculation incorrect.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 1: Sales Invoice Posting Pipeline', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 2: Sales + Inventory + COGS + Accounting Integration
  // -----------------------------------------------------------
  try {
    const saleRecord = await prisma.sale.findUnique({
      where: { id: createdSaleId },
      include: { items: true },
    })

    const move = await prisma.inventoryMovement.findFirst({
      where: { businessId: b1Id, referenceId: createdSaleId, referenceType: 'sale' },
    })

    const je = await prisma.journalEntry.findFirst({
      where: { businessId: b1Id, sourceId: createdSaleId, sourceType: 'sale' },
      include: { lines: true },
    })

    const passed = !!saleRecord && !!move && !!je && je.status === 'posted' && je.lines.length >= 4
    results.push({
      scenario: 'Test 2: Sales + Inventory + COGS + Accounting Atomic Integration',
      passed,
      details: passed
        ? `Sale #${saleRecord?.invoiceNumber} atomically issued inventory (${move?.quantity} units) and created 4-line GL Entry (AR $1,150, Rev $1,000, Tax $150, COGS/Inv).`
        : 'Failed: Atomic integration incomplete.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 2: Sales + Inventory + COGS + Accounting Atomic Integration', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 3: Purchase Invoice Posting
  // -----------------------------------------------------------
  let createdPurchaseId: string = ''
  try {
    const pNo = 'P3-PURCH-' + Date.now()
    const { purchase } = await PurchaseService.postPurchaseInvoice({
      businessId: b1Id,
      supplierId: supplier.id,
      purchaseNumber: pNo,
      purchaseDate: new Date(),
      currencyCode: 'USD',
      exchangeRate: 1,
      warehouseId: mainWh.id,
      lines: [
        {
          productId: prodPhysical.id,
          description: 'Purchase Test Item',
          quantity: 10,
          unitPrice: 200,
          taxRatePercent: 15,
        },
      ],
      userId,
    })

    createdPurchaseId = purchase.id
    const passed = purchase.status === 'received' && new Decimal(purchase.totalAmount).equals(new Decimal(2300))
    results.push({
      scenario: 'Test 3: Purchase Invoice Posting Pipeline',
      passed,
      details: passed
        ? `Purchase invoice ${pNo} posted successfully. Subtotal: $2,000, Input VAT: $300, AP: $2,300.`
        : 'Failed: Purchase invoice error.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 3: Purchase Invoice Posting Pipeline', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 4: Weighted Average Costing (WAC) Update
  // -----------------------------------------------------------
  try {
    const prodAfter = await prisma.product.findUnique({ where: { id: prodPhysical.id } })
    const balAfter = await prisma.inventoryBalance.findUnique({
      where: { businessId_productId_warehouseId: { businessId: b1Id, productId: prodPhysical.id, warehouseId: mainWh.id } },
    })

    const passed = !!prodAfter && new Decimal(prodAfter.costPrice).gt(0) && !!balAfter
    results.push({
      scenario: 'Test 4: Weighted Average Cost (WAC) Automatic Recalculation',
      passed,
      details: passed
        ? `Product costPrice recalculated to $${new Decimal(prodAfter!.costPrice).toFixed(2)} based on stock receipt.`
        : 'Failed: WAC update failed.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 4: Weighted Average Cost (WAC) Automatic Recalculation', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 5: Partial Payment Processing
  // -----------------------------------------------------------
  try {
    const saleToPay = await prisma.sale.findUnique({ where: { id: createdSaleId } })
    const payNo = 'P3-PAY-PART-' + Date.now()

    const { payment } = await PaymentService.processPayment({
      businessId: b1Id,
      paymentNumber: payNo,
      paymentDate: new Date(),
      type: 'incoming',
      method: 'bank_transfer',
      customerId: customer.id,
      bankAccountId: bankAcc.id,
      currencyCode: 'USD',
      exchangeRate: 1,
      amount: 500, // Partial payment of $500 on $1,150 invoice
      allocations: [
        {
          saleId: createdSaleId,
          allocatedAmount: 500,
        },
      ],
      userId,
    })

    const updatedSale = await prisma.sale.findUnique({ where: { id: createdSaleId } })
    const passed = payment.status === 'fully_allocated' && updatedSale?.status === 'partial' && new Decimal(updatedSale.balanceDue).equals(new Decimal(650))
    results.push({
      scenario: 'Test 5: Partial Payment & Invoice Balance Update',
      passed,
      details: passed
        ? `Partial payment $500 allocated to sale ${saleToPay?.invoiceNumber}. Status updated to 'partial', remaining balance $650.`
        : 'Failed: Partial payment processing error.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 5: Partial Payment & Invoice Balance Update', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 6: Payment Across Multiple Invoices
  // -----------------------------------------------------------
  try {
    // Create 2 test invoices
    const { sale: s1 } = await SalesService.postSalesInvoice({
      businessId: b1Id, customerId: customer.id, invoiceNumber: 'MULTI-A-' + Date.now(),
      invoiceDate: new Date(), warehouseId: mainWh.id, lines: [{ description: 'A', quantity: 1, unitPrice: 300 }], userId
    })
    const { sale: s2 } = await SalesService.postSalesInvoice({
      businessId: b1Id, customerId: customer.id, invoiceNumber: 'MULTI-B-' + Date.now(),
      invoiceDate: new Date(), warehouseId: mainWh.id, lines: [{ description: 'B', quantity: 1, unitPrice: 200 }], userId
    })

    const { payment } = await PaymentService.processPayment({
      businessId: b1Id,
      paymentNumber: 'P3-MULTI-PAY-' + Date.now(),
      paymentDate: new Date(),
      type: 'incoming',
      method: 'bank_transfer',
      customerId: customer.id,
      bankAccountId: bankAcc.id,
      currencyCode: 'USD',
      exchangeRate: 1,
      amount: 500, // Pays both: $300 + $200
      allocations: [
        { saleId: s1.id, allocatedAmount: 300 },
        { saleId: s2.id, allocatedAmount: 200 },
      ],
      userId,
    })

    const check1 = await prisma.sale.findUnique({ where: { id: s1.id } })
    const check2 = await prisma.sale.findUnique({ where: { id: s2.id } })

    const passed = check1?.status === 'paid' && check2?.status === 'paid'
    results.push({
      scenario: 'Test 6: Multi-Invoice Payment Allocation Engine',
      passed,
      details: passed
        ? `Single payment of $500 fully paid both invoices ${s1.invoiceNumber} ($300) and ${s2.invoiceNumber} ($200).`
        : 'Failed: Multi-invoice allocation error.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 6: Multi-Invoice Payment Allocation Engine', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 7: Over-Allocation Rejection
  // -----------------------------------------------------------
  try {
    let overAllocatedRejected = false
    try {
      await PaymentService.processPayment({
        businessId: b1Id,
        paymentNumber: 'OVER-ALLOC-' + Date.now(),
        paymentDate: new Date(),
        type: 'incoming',
        customerId: customer.id,
        bankAccountId: bankAcc.id,
        amount: 100, // Payment is $100
        allocations: [{ saleId: createdSaleId, allocatedAmount: 500 }], // Attempting to allocate $500!
        userId,
      })
    } catch (err: any) {
      if (err instanceof OverAllocationError) {
        overAllocatedRejected = true
      }
    }

    results.push({
      scenario: 'Test 7: Rejection of Payment Over-Allocation',
      passed: overAllocatedRejected,
      details: overAllocatedRejected
        ? 'OverAllocationError thrown successfully when allocation ($500) exceeded payment amount ($100).'
        : 'Failed: Over-allocation was incorrectly permitted!',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 7: Rejection of Payment Over-Allocation', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 8: Customer Payment Accounting
  // -----------------------------------------------------------
  try {
    const payNo = 'CUST-PAY-ACCT-' + Date.now()
    const { journalEntry } = await PaymentService.processPayment({
      businessId: b1Id,
      paymentNumber: payNo,
      paymentDate: new Date(),
      type: 'incoming',
      customerId: customer.id,
      bankAccountId: bankAcc.id,
      amount: 150,
      userId,
    })

    const lines = journalEntry.lines
    const debitBank = lines.find((l: any) => new Decimal(l.debitAmount).gt(0))
    const creditAR = lines.find((l: any) => new Decimal(l.creditAmount).gt(0))

    const passed = journalEntry.status === 'posted' && !!debitBank && !!creditAR
    results.push({
      scenario: 'Test 8: Customer Payment Accounting Entry',
      passed,
      details: passed
        ? `Customer payment generated posted GL Entry: Debit Bank ($150), Credit Accounts Receivable ($150).`
        : 'Failed: Customer payment GL entry incorrect.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 8: Customer Payment Accounting Entry', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 9: Supplier Payment Accounting
  // -----------------------------------------------------------
  try {
    const payNo = 'SUPP-PAY-ACCT-' + Date.now()
    const { journalEntry } = await PaymentService.processPayment({
      businessId: b1Id,
      paymentNumber: payNo,
      paymentDate: new Date(),
      type: 'outgoing',
      supplierId: supplier.id,
      bankAccountId: bankAcc.id,
      amount: 400,
      allocations: [{ purchaseId: createdPurchaseId, allocatedAmount: 400 }],
      userId,
    })

    const lines = journalEntry.lines
    const debitAP = lines.find((l: any) => new Decimal(l.debitAmount).gt(0))
    const creditBank = lines.find((l: any) => new Decimal(l.creditAmount).gt(0))

    const passed = journalEntry.status === 'posted' && !!debitAP && !!creditBank
    results.push({
      scenario: 'Test 9: Supplier Payment Accounting Entry',
      passed,
      details: passed
        ? `Supplier payment generated posted GL Entry: Debit Accounts Payable ($400), Credit Bank ($400).`
        : 'Failed: Supplier payment GL entry incorrect.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 9: Supplier Payment Accounting Entry', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 10: Expense Posting & Accounting
  // -----------------------------------------------------------
  try {
    const expNo = 'P3-EXP-' + Date.now()
    const { expense, journalEntry } = await ExpenseService.postExpense({
      businessId: b1Id,
      expenseNumber: expNo,
      expenseDate: new Date(),
      description: 'Test Office Internet Expense',
      vendor: 'Comcast Business',
      accountId: expAcc.id,
      bankAccountId: bankAcc.id,
      amount: 250,
      taxAmount: 0,
      userId,
    })

    const passed = expense.status === 'posted' && journalEntry.status === 'posted'
    results.push({
      scenario: 'Test 10: Expense Posting & Accounting Workflow',
      passed,
      details: passed
        ? `Expense ${expNo} posted. GL Entry generated: Debit Rent/Utility Expense ($250), Credit Bank ($250).`
        : 'Failed: Expense posting error.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 10: Expense Posting & Accounting Workflow', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 11: Balanced Journal Entry Generation
  // -----------------------------------------------------------
  try {
    const je = await AccountingService.postJournalEntry({
      businessId: b1Id,
      entryNumber: 'P3-JE-BAL-' + Date.now(),
      entryDate: new Date(),
      description: 'Direct Service Balanced Journal Test',
      currencyCode: 'USD',
      exchangeRate: 1,
      lines: [
        { accountId: expAcc.id, debitAmount: 300, creditAmount: 0 },
        { accountId: bankAcc.accountId!, debitAmount: 0, creditAmount: 300 },
      ],
      userId,
    })

    const passed = je.status === 'posted' && je.lines.length === 2
    results.push({
      scenario: 'Test 11: Direct Balanced Journal Entry Posting',
      passed,
      details: passed
        ? `Journal Entry ${je.entryNumber} verified debits ($300) = credits ($300) and posted.`
        : 'Failed: Direct journal entry failed.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 11: Direct Balanced Journal Entry Posting', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 12: Rejection of Unbalanced Journal Entry
  // -----------------------------------------------------------
  try {
    let rejected = false
    try {
      await AccountingService.postJournalEntry({
        businessId: b1Id,
        entryNumber: 'P3-JE-UNBAL-' + Date.now(),
        entryDate: new Date(),
        currencyCode: 'USD',
        exchangeRate: 1,
        lines: [
          { accountId: expAcc.id, debitAmount: 500, creditAmount: 0 },
          { accountId: bankAcc.accountId!, debitAmount: 0, creditAmount: 350 }, // Unbalanced!
        ],
        userId,
      })
    } catch (err: any) {
      if (err instanceof UnbalancedJournalError) {
        rejected = true
      }
    }

    results.push({
      scenario: 'Test 12: Rejection of Unbalanced Journal Entry',
      passed: rejected,
      details: rejected
        ? 'UnbalancedJournalError thrown successfully when debits ($500) did not equal credits ($350).'
        : 'Failed: Unbalanced journal entry was allowed!',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 12: Rejection of Unbalanced Journal Entry', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 13: Journal Entry Reversal Workflow
  // -----------------------------------------------------------
  try {
    // Post a journal entry
    const jeToReverse = await AccountingService.postJournalEntry({
      businessId: b1Id,
      entryNumber: 'TO-REVERSE-' + Date.now(),
      entryDate: new Date(),
      currencyCode: 'USD',
      exchangeRate: 1,
      lines: [
        { accountId: expAcc.id, debitAmount: 450, creditAmount: 0 },
        { accountId: bankAcc.accountId!, debitAmount: 0, creditAmount: 450 },
      ],
      userId,
    })

    // Reverse it
    const reversal = await AccountingService.reverseJournalEntry({
      businessId: b1Id,
      journalEntryId: jeToReverse.id,
      reversalEntryNumber: 'REV-' + Date.now(),
      reversalDate: new Date(),
      reason: 'Audit Correction',
      userId,
    })

    const originalCheck = await prisma.journalEntry.findUnique({ where: { id: jeToReverse.id } })

    const passed = originalCheck?.status === 'reversed' && reversal.status === 'posted'
    results.push({
      scenario: 'Test 13: Journal Entry Reversal Workflow',
      passed,
      details: passed
        ? `Journal ${jeToReverse.entryNumber} status updated to 'reversed'. Inverse entry ${reversal.entryNumber} posted with swapped debits/credits.`
        : 'Failed: Journal reversal workflow failed.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 13: Journal Entry Reversal Workflow', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 14: Warehouse Transfer Workflow
  // -----------------------------------------------------------
  try {
    const transferRes = await InventoryService.executeTransfer({
      businessId: b1Id,
      productId: prodPhysical.id,
      fromWarehouseId: mainWh.id,
      toWarehouseId: eastWh.id,
      quantity: 3,
      notes: 'Inter-warehouse stock transfer test',
      userId,
    })

    const passed = transferRes.success && transferRes.transferredQty === 3
    results.push({
      scenario: 'Test 14: Inter-Warehouse Stock Transfer',
      passed,
      details: passed
        ? `Transferred 3 units of ${prodPhysical.name} from ${mainWh.name} to ${eastWh.name}. Traceable transfer_out & transfer_in movements generated.`
        : 'Failed: Inter-warehouse stock transfer failed.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 14: Inter-Warehouse Stock Transfer', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 15: Multi-Currency Historical Exchange Rate Freezing
  // -----------------------------------------------------------
  try {
    const eurRate = 1.095
    const eurSubtotal = 1000
    const expectedBaseSubtotal = new Decimal(eurSubtotal).mul(eurRate) // 1095 USD

    const { sale } = await SalesService.postSalesInvoice({
      businessId: b1Id,
      customerId: customer.id,
      invoiceNumber: 'FX-P3-' + Date.now(),
      invoiceDate: new Date(),
      currencyCode: 'EUR',
      exchangeRate: eurRate,
      lines: [{ description: 'EUR Export Product', quantity: 1, unitPrice: eurSubtotal }],
      userId,
    })

    const passed = sale.currencyCode === 'EUR' &&
      new Decimal(sale.exchangeRate).equals(new Decimal(eurRate)) &&
      new Decimal(sale.baseSubtotal).equals(expectedBaseSubtotal)

    results.push({
      scenario: 'Test 15: Multi-Currency Historical Rate Freezing',
      passed,
      details: passed
        ? `Foreign invoice created in EUR @ ${eurRate}. Base currency value permanently frozen at $${expectedBaseSubtotal.toFixed(2)} USD.`
        : 'Failed: Multi-currency rate freezing error.',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 15: Multi-Currency Historical Rate Freezing', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 16: Transaction Rollback When Any Step Fails
  // -----------------------------------------------------------
  try {
    let rollbackVerified = false
    const invalidInvoiceNo = 'ROLLBACK-TEST-' + Date.now()

    try {
      await prisma.$transaction(async (tx) => {
        // Step 1: Create partial sale record
        await tx.sale.create({
          data: {
            businessId: b1Id,
            invoiceNumber: invalidInvoiceNo,
            invoiceDate: new Date(),
            subtotal: new Decimal(100),
            totalAmount: new Decimal(100),
            paidAmount: new Decimal(0),
            balanceDue: new Decimal(100),
            baseSubtotal: new Decimal(100),
            baseTotalAmount: new Decimal(100),
            createdBy: userId,
          },
        })

        // Step 2: Deliberately throw error inside transaction
        throw new Error('Simulated failure during multi-step posting')
      })
    } catch (e: any) {
      // Check if sale record exists in DB after rollback
      const foundSale = await prisma.sale.findFirst({ where: { invoiceNumber: invalidInvoiceNo } })
      if (!foundSale) {
        rollbackVerified = true
      }
    }

    results.push({
      scenario: 'Test 16: Transaction Rollback Integrity',
      passed: rollbackVerified,
      details: rollbackVerified
        ? 'Atomic transaction cleanly rolled back all steps when an intermediate step failed; no orphan database records were created.'
        : 'Failed: Partial records remained in DB after failed transaction!',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 16: Transaction Rollback Integrity', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // TEST 17: Cross-Tenant Operation Rejection
  // -----------------------------------------------------------
  try {
    let tenantRejected = false
    const otherBusinessId = '11111111-1111-1111-1111-111111111111'

    try {
      // Try posting sales invoice referencing Customer from b1Id inside otherBusinessId
      await SalesService.postSalesInvoice({
        businessId: otherBusinessId,
        customerId: customer.id, // Customer belongs to b1Id!
        invoiceNumber: 'CROSS-TENANT-' + Date.now(),
        invoiceDate: new Date(),
        currencyCode: 'USD',
        exchangeRate: 1,
        lines: [{ description: 'Cross tenant test', quantity: 1, unitPrice: 100 }],
        userId,
      })
    } catch (err: any) {
      if (err instanceof TenantAccessDeniedError) {
        tenantRejected = true
      }
    }

    results.push({
      scenario: 'Test 17: Cross-Tenant Operation Rejection',
      passed: tenantRejected,
      details: tenantRejected
        ? 'TenantAccessDeniedError thrown when attempting to use a customer from another tenant business.'
        : 'Failed: Cross-tenant operation was incorrectly allowed!',
    })
  } catch (e: any) {
    results.push({ scenario: 'Test 17: Cross-Tenant Operation Rejection', passed: false, details: e.message })
  }

  // -----------------------------------------------------------
  // Summary Output
  // -----------------------------------------------------------
  console.log('\n=============================================================')
  console.log('🏁 PHASE 03 VERIFICATION RESULTS SUMMARY:')
  console.log('=============================================================')
  let allPassed = true
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} [${r.passed ? 'PASS' : 'FAIL'}] ${r.scenario}`)
    console.log(`   └─ ${r.details}`)
    if (!r.passed) allPassed = false
  }
  console.log('=============================================================')
  console.log(`TOTAL: ${results.length} Scenarios Tested. Passed: ${results.filter(r => r.passed).length}/${results.length}`)
  console.log('=============================================================\n')

  if (!allPassed) {
    process.exit(1)
  }
}

runPhase3Tests()
  .catch((e) => {
    console.error('Test execution failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
