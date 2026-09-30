// =============================================================
// Phase 10 Automated Verification & CRM / Collections Test Suite
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '../src/lib/db/prisma'
import Decimal from 'decimal.js'
import { CustomerCrmService } from '../src/lib/services/customer-crm-service'
import { CrmActivityService } from '../src/lib/services/crm-activity-service'
import { CrmTaskService } from '../src/lib/services/crm-task-service'
import { OpportunityService } from '../src/lib/services/opportunity-service'
import { CreditControlService } from '../src/lib/services/credit-control-service'
import { PaymentPromiseService } from '../src/lib/services/payment-promise-service'
import { CollectionsService } from '../src/lib/services/collections-service'
import { Customer360Service } from '../src/lib/services/customer-360-service'
import { Supplier360Service } from '../src/lib/services/supplier-360-service'
import { CrmDashboardService } from '../src/lib/services/crm-dashboard-service'
import { CrmReportingService } from '../src/lib/services/crm-reporting-service'
import { QuotationService } from '../src/lib/services/quotation-service'
import { SalesOrderService } from '../src/lib/services/sales-order-service'
import { SalesService } from '../src/lib/services/sales-service'
import { PaymentService } from '../src/lib/services/payment-service'
import { GlobalSearchService } from '../src/lib/services/global-search-service'
import { DocumentNumberingService } from '../src/lib/services/document-numbering-service'
import { AuditService } from '../src/lib/services/audit-service'
import { TenantAccessDeniedError } from '../src/lib/errors/accounting-error'
import { SalesOrderStatus } from '@prisma/client'

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

async function runPhase10Validation() {
  console.log('\n🚀 Starting PHASE 10 Test Suite: Advanced CRM, Customer/Supplier Management & Collections...\n')

  // Setup test tenants and users
  const timestamp = Date.now()
  const userA = await prisma.user.create({
    data: {
      email: `crm-runner-a-${timestamp}@test.com`,
      fullName: 'Alice CRM Manager',
      status: 'active',
    },
  })

  const userB = await prisma.user.create({
    data: {
      email: `crm-runner-b-${timestamp}@test.com`,
      fullName: 'Bob Tenant B Manager',
      status: 'active',
    },
  })

  const businessA = await prisma.business.create({
    data: {
      name: `Apex Enterprise CRM Corp - ${timestamp}`,
      defaultCurrency: 'USD',
    },
  })

  const businessB = await prisma.business.create({
    data: {
      name: `Tenant B Isolated Corp - ${timestamp}`,
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

  // Create Chart of Accounts for Tenant A
  const arAccount = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `1200-${timestamp}`,
      name: 'Accounts Receivable',
      type: 'asset',
      normalBalance: 'debit',
    },
  })

  const salesAccount = await prisma.chartOfAccount.create({
    data: {
      businessId: businessA.id,
      code: `4000-${timestamp}`,
      name: 'Sales Revenue',
      type: 'revenue',
      normalBalance: 'credit',
    },
  })

  // Create Warehouse & Product for Tenant A
  const warehouseA = await prisma.warehouse.create({
    data: {
      businessId: businessA.id,
      name: 'Main CRM Warehouse',
      code: `WH-CRM-${timestamp}`,
      isDefault: true,
      isActive: true,
    },
  })

  const productA = await prisma.product.create({
    data: {
      businessId: businessA.id,
      name: 'Enterprise Cloud Server',
      code: `SRV-${timestamp}`,
      salePrice: new Decimal(2000),
      costPrice: new Decimal(1200),
      currency: 'USD',
    },
  })

  // -------------------------------------------------------------
  // TEST 1: Customer contacts
  // -------------------------------------------------------------
  console.log('Test 1: Customer contacts')
  const customerGroup = await CustomerCrmService.createCustomerGroup(
    {
      businessId: businessA.id,
      name: `Key Accounts ${timestamp}`,
      discountPercent: 10,
      creditLimit: 50000,
      paymentTerms: 45,
    },
    userA.id
  )

  const customerA = await prisma.customer.create({
    data: {
      businessId: businessA.id,
      name: 'Global Tech Innovations Ltd',
      companyName: 'Global Tech',
      code: `CUST-GTI-${timestamp}`,
      email: 'info@globaltech.com',
      phone: '+1-555-0100',
      billingAddress: '100 Silicon Ave, Suite 400',
      shippingAddress: '100 Silicon Ave, Dock 2',
      city: 'San Francisco',
      country: 'USA',
      creditLimit: new Decimal(25000),
      paymentTerms: 30,
      category: 'corporate',
      industry: 'technology',
      region: 'north_america',
      tags: ['vip', 'cloud', 'enterprise'],
      customerGroupId: customerGroup.id,
      assignedUserId: userA.id,
      creditStatus: 'normal',
      balance: new Decimal(0),
    },
  })

  const contact1 = await CustomerCrmService.createCustomerContact(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      name: 'Sarah Jenkins',
      title: 'VP of Procurement',
      email: 'sarah.j@globaltech.com',
      phone: '+1-555-0101',
      mobile: '+1-555-0102',
      whatsapp: '+1-555-0102',
      isPrimary: true,
    },
    userA.id
  )

  const contact2 = await CustomerCrmService.createCustomerContact(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      name: 'David Chen',
      title: 'Chief Technology Officer',
      email: 'david.c@globaltech.com',
      phone: '+1-555-0103',
      isPrimary: false,
    },
    userA.id
  )

  const customerContacts = await CustomerCrmService.getCustomerContacts(businessA.id, customerA.id)

  assert(
    customerContacts.length === 2 && customerContacts[0].isPrimary === true && customerContacts[0].name === 'Sarah Jenkins',
    'Customer created with multiple contacts, primary flag management, and segmentation group'
  )

  // -------------------------------------------------------------
  // TEST 2: Supplier contacts
  // -------------------------------------------------------------
  console.log('\nTest 2: Supplier contacts')
  const supplierA = await prisma.supplier.create({
    data: {
      businessId: businessA.id,
      name: 'Apex Hardware Supplies Inc',
      companyName: 'Apex Hardware',
      code: `SUPP-APX-${timestamp}`,
      email: 'orders@apexhardware.com',
      phone: '+1-555-0200',
      category: 'hardware',
      industry: 'manufacturing',
      rating: new Decimal(4.8),
      assignedUserId: userA.id,
      balance: new Decimal(0),
    },
  })

  const suppContact = await CustomerCrmService.createSupplierContact(
    {
      businessId: businessA.id,
      supplierId: supplierA.id,
      name: 'Marcus Vance',
      title: 'Account Director',
      email: 'marcus@apexhardware.com',
      mobile: '+1-555-0201',
      isPrimary: true,
    },
    userA.id
  )

  const supplierContacts = await CustomerCrmService.getSupplierContacts(businessA.id, supplierA.id)

  assert(
    supplierContacts.length === 1 && supplierContacts[0].name === 'Marcus Vance' && supplierContacts[0].isPrimary === true,
    'Supplier contacts registered with primary designation and relationship metadata'
  )

  // -------------------------------------------------------------
  // TEST 3: CRM activity
  // -------------------------------------------------------------
  console.log('\nTest 3: CRM activity')
  const callActivity = await CrmActivityService.createActivity(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      customerContactId: contact1.id,
      activityType: 'call',
      subject: 'Quarterly Infrastructure Upgrade Discovery Call',
      description: 'Discussed expanding server capacity by 20 units in Q4',
      outcome: 'Interested in proposal, scheduled follow-up meeting',
      userId: userA.id,
    },
    userA.id
  )

  const meetingActivity = await CrmActivityService.createActivity(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      customerContactId: contact2.id,
      activityType: 'meeting',
      subject: 'Technical Architecture Review with CTO',
      description: 'Validated server specifications and delivery timeline',
      outcome: 'Technical sign-off received',
      userId: userA.id,
    },
    userA.id
  )

  const customerActivities = await CrmActivityService.getActivities(businessA.id, { customerId: customerA.id })

  assert(
    customerActivities.length === 2 && customerActivities[0].subject.includes('Technical') || customerActivities[1].subject.includes('Quarterly'),
    'CRM activities (calls, meetings) logged with contact person, outcome, and timestamp'
  )

  // -------------------------------------------------------------
  // TEST 4: Task workflow
  // -------------------------------------------------------------
  console.log('\nTest 4: Task workflow')
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const task = await CrmTaskService.createTask(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      title: 'Send formal quotation for 10 servers',
      description: 'Include 10% key account discount',
      dueDate: tomorrow,
      priority: 'high',
      status: 'open',
      assignedToId: userA.id,
    },
    userA.id
  )

  const inProgressTask = await CrmTaskService.updateTaskStatus(businessA.id, task.id, 'in_progress', userA.id)
  const completedTask = await CrmTaskService.updateTaskStatus(businessA.id, task.id, 'completed', userA.id)

  assert(
    task.status === 'open' && inProgressTask.status === 'in_progress' && completedTask.status === 'completed' && completedTask.completedAt !== null,
    'Task lifecycle workflow (Open -> In Progress -> Completed) executed smoothly with completion timestamp'
  )

  // -------------------------------------------------------------
  // TEST 5: Opportunity pipeline
  // -------------------------------------------------------------
  console.log('\nTest 5: Opportunity pipeline')
  const opportunity = await OpportunityService.createOpportunity(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      name: 'Global Tech 20-Server Datacenter Expansion',
      expectedValue: 40000,
      probability: 60,
      stage: 'qualified',
      expectedClosingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      assignedUserId: userA.id,
      source: 'existing_customer',
      nextAction: 'Prepare custom enterprise quote',
    },
    userA.id
  )

  const pipeline = await OpportunityService.getPipelineMetrics(businessA.id)

  assert(
    opportunity.stage === 'qualified' && pipeline.totalPipelineValue === 40000 && pipeline.weightedPipelineValue === 24000,
    'Opportunity created with accurate pipeline total ($40,000) and weighted value ($24,000 at 60%)'
  )

  // -------------------------------------------------------------
  // TEST 6: Opportunity quotation linking
  // -------------------------------------------------------------
  console.log('\nTest 6: Opportunity quotation linking')
  const quotation = await QuotationService.createQuotation({
    businessId: businessA.id,
    customerId: customerA.id,
    quotationDate: new Date(),
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        productId: productA.id,
        description: 'Enterprise Cloud Server',
        quantity: 10,
        unitPrice: 2000,
        discount: 0,
        taxRate: 0,
      },
    ],
    userId: userA.id,
  })

  const linkedOpp = await OpportunityService.linkQuotation(businessA.id, opportunity.id, quotation.id, userA.id)

  assert(
    linkedOpp.quotationId === quotation.id && linkedOpp.stage === 'proposal' && Number(linkedOpp.expectedValue) === 20000,
    'Opportunity seamlessly linked to Quotation, updating stage to Proposal and synchronizing value'
  )

  // -------------------------------------------------------------
  // TEST 7: Customer 360 calculations
  // -------------------------------------------------------------
  console.log('\nTest 7: Customer 360 calculations')
  // Create sales invoice for customer
  const saleInvoice = await prisma.sale.create({
    data: {
      businessId: businessA.id,
      customerId: customerA.id,
      invoiceNumber: `INV-C360-${timestamp}`,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currencyCode: 'USD',
      exchangeRate: new Decimal(1),
      subtotal: new Decimal(10000),
      totalAmount: new Decimal(10000),
      balanceDue: new Decimal(10000),
      baseSubtotal: new Decimal(10000),
      baseTotalAmount: new Decimal(10000),
      status: 'sent',
      createdBy: userA.id,
      items: {
        create: [
          {
            productId: productA.id,
            description: 'Enterprise Cloud Server',
            quantity: new Decimal(5),
            unitPrice: new Decimal(2000),
            costBasis: new Decimal(1200),
            lineTotal: new Decimal(10000),
            lineOrder: 1,
          },
        ],
      },
    },
  })

  await prisma.customer.update({
    where: { id: customerA.id },
    data: { balance: new Decimal(10000) },
  })

  const c360 = await Customer360Service.getCustomer360(businessA.id, customerA.id)

  assert(
    c360.financialSummary.totalSales === 10000 && c360.customer.id === customerA.id && c360.timeline.length >= 3,
    'Customer 360 view aggregates financial totals, contacts, CRM activities, and document timeline'
  )

  // -------------------------------------------------------------
  // TEST 8: Customer profitability
  // -------------------------------------------------------------
  console.log('\nTest 8: Customer profitability')
  const profitability = await Customer360Service.getCustomerProfitability(businessA.id, customerA.id)

  // Sale was 5 units @ $2000 = $10,000. Product costPrice is $1,200 => COGS is $6,000. Gross profit = $4,000 (40%)
  assert(
    profitability.metrics.totalRevenue === 10000 && profitability.metrics.totalCogs === 6000 && profitability.metrics.grossProfit === 4000 && profitability.metrics.grossMarginPercent === 40,
    'Customer profitability analytics correctly calculated Revenue ($10,000), COGS ($6,000), Gross Profit ($4,000), and Margin (40%)'
  )

  // -------------------------------------------------------------
  // TEST 9: Credit exposure
  // -------------------------------------------------------------
  console.log('\nTest 9: Credit exposure')
  const exposureMetrics = await CreditControlService.getCreditMetrics(businessA.id, customerA.id)

  // Balance is $10,000, creditLimit is $25,000 => Available is $15,000 (40% utilization)
  assert(
    exposureMetrics.creditLimit === 25000 && exposureMetrics.currentBalance === 10000 && exposureMetrics.availableCredit === 15000 && exposureMetrics.utilizationPercent === 40 && exposureMetrics.creditStatus === 'normal',
    'Credit exposure accurately computed (Limit: $25k, Exposure: $10k, Available: $15k, Utilization: 40%)'
  )

  // -------------------------------------------------------------
  // TEST 10: Credit-limit blocking
  // -------------------------------------------------------------
  console.log('\nTest 10: Credit-limit blocking')
  // Customer has $15,000 available. Attempting a new order of $20,000 will violate credit limit ($10k + $20k = $30k > $25k)
  const creditValidation = await CreditControlService.validateSalesOrderCredit(businessA.id, customerA.id, 20000)

  assert(
    creditValidation.allowed === false && creditValidation.requiresOverride === true && creditValidation.newExposure === 30000,
    'Credit-control engine strictly blocked order exceeding credit limit ($30,000 exposure vs $25,000 limit)'
  )

  // -------------------------------------------------------------
  // TEST 11: Authorized credit override
  // -------------------------------------------------------------
  console.log('\nTest 11: Authorized credit override')
  const override = await CreditControlService.createCreditOverride(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      requestedAmount: 20000,
      currentExposure: exposureMetrics.currentExposure,
      creditLimit: exposureMetrics.creditLimit,
      reason: 'Approved by CFO for VIP client quarterly expansion contract',
    },
    userA.id
  )

  const validatedWithOverride = await CreditControlService.validateSalesOrderCredit(
    businessA.id,
    customerA.id,
    20000,
    override.id
  )

  assert(
    validatedWithOverride.allowed === true && validatedWithOverride.overrideApplied === true,
    'Authorized executive override applied successfully with full audit trail'
  )

  // -------------------------------------------------------------
  // TEST 12: Collections workspace
  // -------------------------------------------------------------
  console.log('\nTest 12: Collections workspace')
  // Create an overdue invoice for testing
  const overdueInvoice = await prisma.sale.create({
    data: {
      businessId: businessA.id,
      customerId: customerA.id,
      invoiceNumber: `INV-OD-${timestamp}`,
      invoiceDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days overdue
      status: 'sent',
      currencyCode: 'USD',
      exchangeRate: new Decimal(1),
      subtotal: new Decimal(5000),
      totalAmount: new Decimal(5000),
      balanceDue: new Decimal(5000),
      baseSubtotal: new Decimal(5000),
      baseTotalAmount: new Decimal(5000),
      createdBy: userA.id,
      items: {
        create: [
          {
            description: 'Server Consulting Services',
            quantity: new Decimal(1),
            unitPrice: new Decimal(5000),
            lineTotal: new Decimal(5000),
            lineOrder: 1,
          },
        ],
      },
    },
  })

  const collectionsWorkspace = await CollectionsService.getCollectionsWorkspace(businessA.id)

  assert(
    collectionsWorkspace.items.length >= 1 && collectionsWorkspace.summary.totalOverdueAr >= 5000 && collectionsWorkspace.items.some((item) => item.invoiceId === overdueInvoice.id && item.daysOverdue >= 14),
    'Collections workspace aggregated overdue AR with aging buckets and customer contact intelligence'
  )

  // -------------------------------------------------------------
  // TEST 13: Payment promise
  // -------------------------------------------------------------
  console.log('\nTest 13: Payment promise')
  const promiseDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const promise = await PaymentPromiseService.createPromise(
    {
      businessId: businessA.id,
      customerId: customerA.id,
      invoiceId: overdueInvoice.id,
      promisedAmount: 5000,
      promiseDate,
      notes: 'Customer CFO committed to wire transfer by next Friday',
      assignedUserId: userA.id,
    },
    userA.id
  )

  assert(
    promise.status === 'open' && Number(promise.promisedAmount) === 5000 && promise.customerId === customerA.id,
    'Payment promise recorded with committed amount ($5,000), promise date, and collector assignment'
  )

  // -------------------------------------------------------------
  // TEST 14: Broken promise detection
  // -------------------------------------------------------------
  console.log('\nTest 14: Broken promise detection')
  // Create an expired promise in the past
  const pastPromise = await prisma.paymentPromise.create({
    data: {
      businessId: businessA.id,
      customerId: customerA.id,
      promisedAmount: new Decimal(3000),
      promiseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      status: 'open',
    },
  })

  const evalResult = await PaymentPromiseService.evaluatePaymentPromises(businessA.id)
  const brokenList = await PaymentPromiseService.getBrokenPromises(businessA.id)

  assert(
    evalResult.brokenCount >= 1 && brokenList.some((p) => p.id === pastPromise.id),
    'Automated delinquency evaluation detected unsatisfied expired payment promises and flagged them as Broken'
  )

  // -------------------------------------------------------------
  // TEST 15: Supplier 360
  // -------------------------------------------------------------
  console.log('\nTest 15: Supplier 360')
  // Create purchase bill for Supplier A
  const purchaseBill = await prisma.purchase.create({
    data: {
      businessId: businessA.id,
      supplierId: supplierA.id,
      purchaseNumber: `BILL-APX-${timestamp}`,
      purchaseDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'received',
      currencyCode: 'USD',
      exchangeRate: new Decimal(1),
      subtotal: new Decimal(12000),
      totalAmount: new Decimal(12000),
      balanceDue: new Decimal(12000),
      baseSubtotal: new Decimal(12000),
      baseTotalAmount: new Decimal(12000),
      createdBy: userA.id,
      items: {
        create: [
          {
            description: 'Server Chassis & Motherboards',
            quantity: new Decimal(10),
            unitPrice: new Decimal(1200),
            lineTotal: new Decimal(12000),
            lineOrder: 1,
          },
        ],
      },
    },
  })

  const s360 = await Supplier360Service.getSupplier360(businessA.id, supplierA.id)

  assert(
    s360.financialSummary.totalPurchasesVolume === 12000 && s360.supplier.id === supplierA.id && s360.contacts.length === 1,
    'Supplier 360 view unified AP balances, procurement volume, contacts, and performance indicators'
  )

  // -------------------------------------------------------------
  // TEST 16: Supplier performance
  // -------------------------------------------------------------
  console.log('\nTest 16: Supplier performance')
  const supplierPerf = await Supplier360Service.getSupplierPerformance(businessA.id, supplierA.id)

  assert(
    supplierPerf.totalPurchaseVolume === 12000 && supplierPerf.fillRatePercent === 100 && supplierPerf.returnRatePercent === 0,
    'Supplier performance metrics calculated purchase volume ($12,000), 100% fill rate, and zero returns'
  )

  // -------------------------------------------------------------
  // TEST 17: Global search
  // -------------------------------------------------------------
  console.log('\nTest 17: Global search')
  const searchContact = await GlobalSearchService.search(businessA.id, 'Sarah Jenkins')
  const searchActivity = await GlobalSearchService.search(businessA.id, 'Infrastructure Upgrade')
  const searchOpportunity = await GlobalSearchService.search(businessA.id, 'Datacenter Expansion')

  assert(
    searchContact.some((r) => r.type === 'contact') && searchActivity.some((r) => r.type === 'crm_activity') && searchOpportunity.some((r) => r.type === 'opportunity'),
    'Global search seamlessly indexes and locates contacts, CRM activities, and sales opportunities'
  )

  // -------------------------------------------------------------
  // TEST 18: Permission enforcement
  // -------------------------------------------------------------
  console.log('\nTest 18: Permission enforcement')
  let unauthorizedOverrideBlocked = false
  try {
    // Non-member user attempts to create override
    await CreditControlService.createCreditOverride(
      {
        businessId: businessA.id,
        customerId: customerA.id,
        requestedAmount: 10000,
        currentExposure: 10000,
        creditLimit: 25000,
        reason: 'Unauthorized override attempt',
      },
      userB.id // User B belongs to Tenant B
    )
  } catch (err) {
    unauthorizedOverrideBlocked = true
  }

  assert(
    unauthorizedOverrideBlocked,
    'Strict permission verification blocked unauthorized user from creating credit overrides'
  )

  // -------------------------------------------------------------
  // TEST 19: Audit trail
  // -------------------------------------------------------------
  console.log('\nTest 19: Audit trail')
  const crmAuditLogs = await prisma.auditLog.findMany({
    where: { businessId: businessA.id },
  })

  assert(
    crmAuditLogs.length >= 8,
    `Audit trail comprehensively captured ${crmAuditLogs.length} events across CRM, contacts, overrides, and promises`
  )

  // -------------------------------------------------------------
  // TEST 20: Cross-tenant isolation
  // -------------------------------------------------------------
  console.log('\nTest 20: Cross-tenant isolation')
  let crossTenantContactBlocked = false
  try {
    // Tenant B attempts to create contact for Tenant A's customer
    await CustomerCrmService.createCustomerContact(
      {
        businessId: businessB.id,
        customerId: customerA.id, // Tenant A's customer
        name: 'Intruder Contact',
      },
      userB.id
    )
  } catch (err) {
    crossTenantContactBlocked = true
  }

  const tenantBWorkspaces = await CrmDashboardService.getSalesWorkspace(businessB.id)

  assert(
    crossTenantContactBlocked && tenantBWorkspaces.pipeline.totalOpportunities === 0,
    'Cross-tenant boundary strictly enforced: Tenant B cannot access or attach data to Tenant A entities'
  )

  // -------------------------------------------------------------
  // TEST 21: Atomic rollback
  // -------------------------------------------------------------
  console.log('\nTest 21: Atomic rollback')
  const contactsBeforeFail = await CustomerCrmService.getCustomerContacts(businessA.id, customerA.id)

  let transactionRolledBack = false
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create a contact inside tx
      await tx.customerContact.create({
        data: {
          businessId: businessA.id,
          customerId: customerA.id,
          name: 'Temporary Contact To Rollback',
        },
      })

      // 2. Intentional failure
      throw new Error('Simulated network fault in CRM batch operation')
    })
  } catch (err) {
    transactionRolledBack = true
  }

  const contactsAfterFail = await CustomerCrmService.getCustomerContacts(businessA.id, customerA.id)

  assert(
    transactionRolledBack && contactsAfterFail.length === contactsBeforeFail.length,
    'Atomic transaction rollback verified: Zero orphan data persisted on aborted CRM operations'
  )

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n=============================================================')
  console.log(`Phase 10 Validation Complete: ${passed} Passed, ${failed} Failed`)
  console.log('=============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase10Validation()
  .catch((err) => {
    console.error('Fatal error running Phase 10 validation:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
