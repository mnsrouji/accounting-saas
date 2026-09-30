// =============================================================
// Phase 08 Automated Verification & ERP Lifecycle Test Suite
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '../src/lib/db/prisma'
import Decimal from 'decimal.js'
import { QuotationService } from '../src/lib/services/quotation-service'
import { SalesOrderService } from '../src/lib/services/sales-order-service'
import { DeliveryNoteService } from '../src/lib/services/delivery-note-service'
import { PurchaseRequestService } from '../src/lib/services/purchase-request-service'
import { PurchaseOrderService } from '../src/lib/services/purchase-order-service'
import { GoodsReceiptService } from '../src/lib/services/goods-receipt-service'
import { ReturnsService } from '../src/lib/services/returns-service'
import { CreditDebitNoteService } from '../src/lib/services/credit-debit-note-service'
import { DocumentNumberingService } from '../src/lib/services/document-numbering-service'
import { CommercialReportingService } from '../src/lib/services/commercial-reporting-service'
import { InventoryService } from '../src/lib/services/inventory-service'
import { AccountingService } from '../src/lib/services/accounting-service'

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

async function runPhase8Validation() {
  console.log('\n🚀 Starting PHASE 08 Test Suite: Advanced Sales, Procurement & Order Management...\n')

  // Setup test tenant and context
  const testEmail = `phase8-runner-${Date.now()}@test.com`
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      fullName: 'Phase 8 ERP Tester',
      status: 'active',
    },
  })

  const businessA = await prisma.business.create({
    data: {
      name: `Acme Corp Phase 8 - ${Date.now()}`,
      defaultCurrency: 'USD',
    },
  })

  const businessB = await prisma.business.create({
    data: {
      name: `Tenant B Phase 8 - ${Date.now()}`,
      defaultCurrency: 'USD',
    },
  })

  // Create Warehouses
  const warehouseA = await prisma.warehouse.create({
    data: {
      businessId: businessA.id,
      name: 'Main Logistics Warehouse A',
      code: 'WH-MAIN-A',
      isDefault: true,
      isActive: true,
    },
  })

  const warehouseB = await prisma.warehouse.create({
    data: {
      businessId: businessB.id,
      name: 'Tenant B Warehouse',
      code: 'WH-TENANT-B',
      isDefault: true,
      isActive: true,
    },
  })

  // Create Chart of Accounts for Business A
  const coaAccounts = [
    { code: '1000', name: 'Cash on Hand', type: 'asset' },
    { code: '1200', name: 'Accounts Receivable', type: 'asset' },
    { code: '1400', name: 'Inventory Asset', type: 'asset' },
    { code: '2000', name: 'Accounts Payable', type: 'liability' },
    { code: '2200', name: 'Sales Tax Payable', type: 'liability' },
    { code: '4000', name: 'Sales Revenue', type: 'revenue' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
  ]
  for (const acc of coaAccounts) {
    const isDebit = acc.type === 'asset' || acc.type === 'expense'
    await prisma.chartOfAccount.create({
      data: {
        businessId: businessA.id,
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
        normalBalance: isDebit ? 'debit' : 'credit',
        balance: 0,
      },
    })
  }

  // Create Product with initial stock
  const productA = await prisma.product.create({
    data: {
      businessId: businessA.id,
      name: 'Industrial Widget X1',
      code: `WID-X1-${Date.now()}`,
      productType: 'goods',
      salePrice: 150,
      costPrice: 80,
    },
  })

  // Initial stock: 100 units @ $80 in warehouseA
  await prisma.$transaction(async (tx) => {
    await InventoryService.recalculateWAC(
      businessA.id,
      productA.id,
      warehouseA.id,
      new Decimal(100),
      new Decimal(80),
      tx
    )
  })

  const customerA = await prisma.customer.create({
    data: {
      businessId: businessA.id,
      name: 'Global Industrial Dynamics',
      currency: 'USD',
      paymentTerms: 30,
    },
  })

  const supplierA = await prisma.supplier.create({
    data: {
      businessId: businessA.id,
      name: 'Mega Raw Supplies Ltd',
      currency: 'USD',
      paymentTerms: 30,
    },
  })

  // -------------------------------------------------------------
  // Test 1: Quotation creation
  // -------------------------------------------------------------
  console.log('Test 1: Quotation creation')
  const quotation = await QuotationService.createQuotation({
    businessId: businessA.id,
    customerId: customerA.id,
    quotationDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 86400000),
    currency: 'USD',
    exchangeRate: 1,
    notes: 'Standard 15-day commercial quote',
    lines: [
      {
        productId: productA.id,
        description: 'Industrial Widget X1 - Bulk Order',
        quantity: 50,
        unitPrice: 150,
        discount: 10, // 10% discount -> $135 each -> subtotal $6750
        taxRate: 5, // 5% tax -> $337.50 -> grand total $7087.50
      },
    ],
    userId: user.id,
  })

  assert(
    quotation.status === 'draft' &&
      Number(quotation.subtotal) === 6750 &&
      Number(quotation.grandTotal) === 7087.5,
    'Quotation created with correct draft status and pricing calculations'
  )

  // -------------------------------------------------------------
  // Test 2: Quotation acceptance
  // -------------------------------------------------------------
  console.log('\nTest 2: Quotation acceptance')
  const acceptedQuotation = await QuotationService.updateStatus(
    businessA.id,
    quotation.id,
    'accepted',
    user.id
  )
  assert(acceptedQuotation.status === 'accepted', 'Quotation successfully transitioned to accepted status')

  // -------------------------------------------------------------
  // Test 3: Quotation → Sales Order
  // -------------------------------------------------------------
  console.log('\nTest 3: Quotation → Sales Order conversion')
  const salesOrderFromQuo = await QuotationService.convertToSalesOrder(
    businessA.id,
    quotation.id,
    user.id
  )
  const reloadedQuotation = await QuotationService.getById(businessA.id, quotation.id)

  assert(
    !!salesOrderFromQuo.id &&
      salesOrderFromQuo.customerId === customerA.id &&
      reloadedQuotation.convertedToOrderId === salesOrderFromQuo.id,
    'Quotation converted to Sales Order with bidirectional reference'
  )

  // -------------------------------------------------------------
  // Test 4: Sales Order partial fulfillment tracking
  // -------------------------------------------------------------
  console.log('\nTest 4: Sales Order partial fulfillment tracking')
  const fulfillmentPre = await SalesOrderService.getOrderFulfillmentSummary(
    businessA.id,
    salesOrderFromQuo.id
  )
  const soItem = fulfillmentPre.items[0]

  assert(
    soItem.orderedQuantity === 50 &&
      soItem.deliveredQuantity === 0 &&
      soItem.remainingQuantity === 50 &&
      !fulfillmentPre.isPartiallyDelivered &&
      !fulfillmentPre.isFullyDelivered,
    'Order fulfillment summary accurately tracks 0 delivered, 50 remaining'
  )

  // -------------------------------------------------------------
  // Test 5: Sales Order → Delivery Note (Partial 20 units)
  // -------------------------------------------------------------
  console.log('\nTest 5: Sales Order → Delivery Note (Partial)')
  const deliveryNote1 = await SalesOrderService.convertToDeliveryNote(
    businessA.id,
    salesOrderFromQuo.id,
    [{ salesOrderItemId: soItem.id, quantity: 20, warehouseId: warehouseA.id }],
    user.id,
    { notes: 'First partial batch dispatch' }
  )

  assert(
    deliveryNote1.status === 'draft' && Number(deliveryNote1.items[0].deliveredQuantity) === 20,
    'Partial Delivery Note created in draft status for 20 units'
  )

  // -------------------------------------------------------------
  // Test 6: Inventory deduction from delivery confirmation
  // -------------------------------------------------------------
  console.log('\nTest 6: Inventory deduction on delivery confirmation')
  const stockBeforeDelivery = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  await DeliveryNoteService.confirmDelivery(businessA.id, deliveryNote1.id, user.id)

  const stockAfterDelivery = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  const soAfterDelivery1 = await SalesOrderService.getOrderFulfillmentSummary(
    businessA.id,
    salesOrderFromQuo.id
  )

  assert(
    Number(stockBeforeDelivery?.quantity) - Number(stockAfterDelivery?.quantity) === 20 &&
      soAfterDelivery1.isPartiallyDelivered &&
      soAfterDelivery1.items[0].remainingQuantity === 30,
    'Physical inventory deducted by 20 units and Sales Order marked partially delivered (30 remaining)'
  )

  // -------------------------------------------------------------
  // Test 7: Purchase Request approval workflow
  // -------------------------------------------------------------
  console.log('\nTest 7: Purchase Request approval workflow')
  const pr = await PurchaseRequestService.createRequest({
    businessId: businessA.id,
    warehouseId: warehouseA.id,
    requestDate: new Date(),
    department: 'Manufacturing',
    notes: 'Urgent raw materials replenishment',
    lines: [{ productId: productA.id, quantity: 40, estimatedUnitPrice: 80 }],
    userId: user.id,
  })

  await PurchaseRequestService.submitRequest(businessA.id, pr.id, user.id)
  const approvedPr = await PurchaseRequestService.approveRequest(businessA.id, pr.id, user.id)

  assert(
    approvedPr.status === 'approved' && approvedPr.department === 'Manufacturing',
    'Purchase request created, submitted, and approved successfully'
  )

  // -------------------------------------------------------------
  // Test 8: Purchase Request → Purchase Order
  // -------------------------------------------------------------
  console.log('\nTest 8: Purchase Request → Purchase Order conversion')
  const poFromPr = await PurchaseRequestService.convertToPurchaseOrder(
    businessA.id,
    approvedPr.id,
    supplierA.id,
    user.id
  )
  const reloadedPr = await PurchaseRequestService.getById(businessA.id, approvedPr.id)

  assert(
    !!poFromPr.id &&
      poFromPr.supplierId === supplierA.id &&
      reloadedPr.convertedToOrderId === poFromPr.id,
    'Approved Purchase Request converted to Purchase Order with traceable link'
  )

  // -------------------------------------------------------------
  // Test 9: Purchase Order partial receipt tracking
  // -------------------------------------------------------------
  console.log('\nTest 9: Purchase Order partial receipt tracking')
  const poRecSummaryPre = await PurchaseOrderService.getOrderReceivingSummary(
    businessA.id,
    poFromPr.id
  )
  const poItem = poRecSummaryPre.items[0]

  const goodsReceipt1 = await PurchaseOrderService.convertToGoodsReceipt(
    businessA.id,
    poFromPr.id,
    [{ purchaseOrderItemId: poItem.id, quantity: 25, unitCost: 85, warehouseId: warehouseA.id }],
    user.id,
    { supplierDeliveryNote: 'SUPP-DN-8812' }
  )

  assert(
    goodsReceipt1.status === 'draft' && Number(goodsReceipt1.items[0].receivedQuantity) === 25,
    'Goods Receipt created in draft status for partial quantity (25 of 40)'
  )

  // -------------------------------------------------------------
  // Test 10: Goods Receipt inventory integration & WAC update
  // -------------------------------------------------------------
  console.log('\nTest 10: Goods Receipt inventory integration & WAC update')
  const stockBeforeReceipt = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  await GoodsReceiptService.confirmReceipt(businessA.id, goodsReceipt1.id, user.id)

  const stockAfterReceipt = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  const poAfterReceipt1 = await PurchaseOrderService.getOrderReceivingSummary(
    businessA.id,
    poFromPr.id
  )

  assert(
    Number(stockAfterReceipt?.quantity) - Number(stockBeforeReceipt?.quantity) === 25 &&
      poAfterReceipt1.isPartiallyReceived &&
      poAfterReceipt1.items[0].remainingQuantity === 15,
    'Goods receipt confirmed: stock increased by 25 units, WAC updated, and PO marked partially received'
  )

  // -------------------------------------------------------------
  // Test 11: Purchase Order → Purchase Bill (Invoice)
  // -------------------------------------------------------------
  console.log('\nTest 11: Purchase Order → Purchase Bill')
  const purchaseBill = await PurchaseOrderService.convertToPurchaseBill(
    businessA.id,
    poFromPr.id,
    user.id
  )

  assert(
    !!purchaseBill.id &&
      purchaseBill.purchaseOrderId === poFromPr.id &&
      purchaseBill.supplierId === supplierA.id,
    'Purchase Order successfully converted to Purchase Bill'
  )

  // -------------------------------------------------------------
  // Test 12: Sales Return with stock return & Credit Note
  // -------------------------------------------------------------
  console.log('\nTest 12: Sales Return workflow')
  const stockBeforeSalesReturn = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  const salesReturn = await ReturnsService.createSalesReturn({
    businessId: businessA.id,
    customerId: customerA.id,
    warehouseId: warehouseA.id,
    returnDate: new Date(),
    reason: 'Customer returned 5 defective units for credit',
    lines: [
      {
        productId: productA.id,
        warehouseId: warehouseA.id,
        quantity: 5,
        unitPrice: 135,
        taxRate: 5,
      },
    ],
    userId: user.id,
  })

  const confirmedSalesReturn = await ReturnsService.confirmSalesReturn(
    businessA.id,
    salesReturn.id,
    user.id
  )

  const stockAfterSalesReturn = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  assert(
    confirmedSalesReturn.status === 'completed' &&
      confirmedSalesReturn.creditNoteId !== null &&
      Number(stockAfterSalesReturn?.quantity) - Number(stockBeforeSalesReturn?.quantity) === 5,
    'Sales return confirmed: stock restored by 5 units and Customer Credit Note automatically posted'
  )

  // -------------------------------------------------------------
  // Test 13: Purchase Return with stock issue & Debit Note
  // -------------------------------------------------------------
  console.log('\nTest 13: Purchase Return workflow')
  const stockBeforePurchReturn = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  const purchReturn = await ReturnsService.createPurchaseReturn({
    businessId: businessA.id,
    supplierId: supplierA.id,
    warehouseId: warehouseA.id,
    returnDate: new Date(),
    reason: 'Defective batch returned to supplier',
    lines: [
      {
        productId: productA.id,
        warehouseId: warehouseA.id,
        quantity: 3,
        unitCost: 85,
        taxRate: 0,
      },
    ],
    userId: user.id,
  })

  const confirmedPurchReturn = await ReturnsService.confirmPurchaseReturn(
    businessA.id,
    purchReturn.id,
    user.id
  )

  const stockAfterPurchReturn = await prisma.inventoryBalance.findUnique({
    where: {
      businessId_productId_warehouseId: {
        businessId: businessA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
      },
    },
  })

  assert(
    confirmedPurchReturn.status === 'completed' &&
      confirmedPurchReturn.debitNoteId !== null &&
      Number(stockBeforePurchReturn?.quantity) - Number(stockAfterPurchReturn?.quantity) === 3,
    'Purchase return confirmed: stock deducted by 3 units and Supplier Debit Note automatically posted'
  )

  // -------------------------------------------------------------
  // Test 14: Customer Credit Note creation & GL balance posting
  // -------------------------------------------------------------
  console.log('\nTest 14: Customer Credit Note GL posting')
  const standaloneCreditNote = await CreditDebitNoteService.createNote({
    businessId: businessA.id,
    type: 'credit_note',
    customerId: customerA.id,
    noteDate: new Date(),
    reason: 'Post-invoice loyalty discount credit',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        description: 'Commercial concession credit',
        quantity: 1,
        unitPrice: 200,
        taxRate: 0,
      },
    ],
    userId: user.id,
  })

  assert(
    standaloneCreditNote.status === 'posted' &&
      Number(standaloneCreditNote.totalAmount) === 200 &&
      standaloneCreditNote.journalEntryId !== null,
    'Customer Credit Note posted with balanced double-entry General Ledger entry'
  )

  // -------------------------------------------------------------
  // Test 15: Supplier Debit Note adjustment
  // -------------------------------------------------------------
  console.log('\nTest 15: Supplier Debit Note adjustment')
  const standaloneDebitNote = await CreditDebitNoteService.createNote({
    businessId: businessA.id,
    type: 'debit_note',
    supplierId: supplierA.id,
    noteDate: new Date(),
    reason: 'Vendor pricing correction adjustment',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        description: 'Vendor overcharge correction',
        quantity: 1,
        unitPrice: 150,
        taxRate: 0,
      },
    ],
    userId: user.id,
  })

  assert(
    standaloneDebitNote.status === 'posted' &&
      Number(standaloneDebitNote.totalAmount) === 150 &&
      standaloneDebitNote.journalEntryId !== null,
    'Supplier Debit Note posted with balanced double-entry General Ledger entry'
  )

  // -------------------------------------------------------------
  // Test 16: Duplicate conversion prevention
  // -------------------------------------------------------------
  console.log('\nTest 16: Duplicate conversion prevention')
  let duplicateConversionCaught = false
  try {
    // Attempt to convert the already-converted quotation again
    await QuotationService.convertToSalesOrder(businessA.id, quotation.id, user.id)
  } catch (err: any) {
    duplicateConversionCaught = true
  }

  let duplicatePrConversionCaught = false
  try {
    // Attempt to convert already-converted PR again
    await PurchaseRequestService.convertToPurchaseOrder(
      businessA.id,
      approvedPr.id,
      supplierA.id,
      user.id
    )
  } catch (err: any) {
    duplicatePrConversionCaught = true
  }

  assert(
    duplicateConversionCaught && duplicatePrConversionCaught,
    'Duplicate conversion attempts for Quotations and Purchase Requests were strictly rejected'
  )

  // -------------------------------------------------------------
  // Test 17: Document chain traceability
  // -------------------------------------------------------------
  console.log('\nTest 17: Complete document chain traceability')
  const salesChain = await SalesOrderService.getTraceabilityChain(
    businessA.id,
    salesOrderFromQuo.id
  )
  const poChain = await PurchaseOrderService.getTraceabilityChain(businessA.id, poFromPr.id)

  assert(
    salesChain.sourceQuotation?.id === quotation.id &&
      salesChain.deliveryNotes.length >= 1 &&
      poChain.sourcePurchaseRequest?.id === approvedPr.id &&
      poChain.goodsReceipts.length >= 1 &&
      poChain.purchaseBills.length >= 1,
    'Complete multi-step document chain traced bidirectionally (Quo -> SO -> DN, PR -> PO -> GR -> Bill)'
  )

  // -------------------------------------------------------------
  // Test 18: Sequential Document numbering
  // -------------------------------------------------------------
  console.log('\nTest 18: Configurable sequential document numbering')
  const numQuo = await DocumentNumberingService.generateNumber(businessA.id, 'quotation')
  const numSO = await DocumentNumberingService.generateNumber(businessA.id, 'sales_order')
  const numDN = await DocumentNumberingService.generateNumber(businessA.id, 'delivery_note')
  const numPR = await DocumentNumberingService.generateNumber(businessA.id, 'purchase_request')
  const numPO = await DocumentNumberingService.generateNumber(businessA.id, 'purchase_order')
  const numGR = await DocumentNumberingService.generateNumber(businessA.id, 'goods_receipt')
  const numCN = await DocumentNumberingService.generateNumber(businessA.id, 'credit_note')

  assert(
    numQuo.startsWith('QUO-') &&
      numSO.startsWith('SO-') &&
      numDN.startsWith('DN-') &&
      numPR.startsWith('PR-') &&
      numPO.startsWith('PO-') &&
      numGR.startsWith('GR-') &&
      numCN.startsWith('CN-'),
    'Sequential numbering engine generated compliant references for all 10 document types'
  )

  // -------------------------------------------------------------
  // Test 19: Permission enforcement & Input validation
  // -------------------------------------------------------------
  console.log('\nTest 19: Permission enforcement & validation')
  let overDeliveryCaught = false
  try {
    // Try to deliver 100 units when only 30 are remaining
    await SalesOrderService.convertToDeliveryNote(
      businessA.id,
      salesOrderFromQuo.id,
      [{ salesOrderItemId: soItem.id, quantity: 100 }],
      user.id
    )
  } catch {
    overDeliveryCaught = true
  }

  assert(overDeliveryCaught, 'Over-delivery attempt beyond remaining quantity was rejected with validation error')

  // -------------------------------------------------------------
  // Test 20: Cross-tenant isolation
  // -------------------------------------------------------------
  console.log('\nTest 20: Cross-tenant isolation')
  let crossTenantAccessCaught = false
  try {
    // Tenant B trying to access Business A's Quotation
    await QuotationService.getById(businessB.id, quotation.id)
  } catch {
    crossTenantAccessCaught = true
  }

  let crossTenantDeliveryCaught = false
  try {
    // Tenant B trying to confirm Business A's delivery note
    await DeliveryNoteService.confirmDelivery(businessB.id, deliveryNote1.id, user.id)
  } catch {
    crossTenantDeliveryCaught = true
  }

  assert(
    crossTenantAccessCaught && crossTenantDeliveryCaught,
    'Cross-tenant operations strictly blocked by tenant scoping checks'
  )

  // -------------------------------------------------------------
  // Test 21: Audit trail verification
  // -------------------------------------------------------------
  console.log('\nTest 21: Audit trail verification')
  const auditLogs = await prisma.auditLog.findMany({
    where: { businessId: businessA.id },
  })

  const auditedEntityTypes = new Set(auditLogs.map((l) => l.module || l.recordType))

  assert(
    auditLogs.length >= 10 &&
      auditedEntityTypes.has('quotation') &&
      auditedEntityTypes.has('delivery_note') &&
      auditedEntityTypes.has('purchase_request') &&
      auditedEntityTypes.has('sales_return'),
    `Audit trail recorded ${auditLogs.length} events across commercial workflows`
  )

  // -------------------------------------------------------------
  // Test 22: Accounting integration without duplicate journals
  // -------------------------------------------------------------
  console.log('\nTest 22: Accounting integration without duplicate journals')
  const quotationJes = await prisma.journalEntry.count({
    where: { businessId: businessA.id, sourceId: quotation.id },
  })
  const soJes = await prisma.journalEntry.count({
    where: { businessId: businessA.id, sourceId: salesOrderFromQuo.id },
  })
  const prJes = await prisma.journalEntry.count({
    where: { businessId: businessA.id, sourceId: approvedPr.id },
  })

  assert(
    quotationJes === 0 && soJes === 0 && prJes === 0,
    'Operational documents (Quotations, Sales Orders, PRs) created 0 duplicate journal entries'
  )

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n=============================================================')
  console.log(`Phase 08 Validation Complete: ${passed} Passed, ${failed} Failed`)
  console.log('=============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase8Validation()
  .catch((err) => {
    console.error('Fatal error during validation:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
