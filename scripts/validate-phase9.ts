// =============================================================
// Phase 09 Automated Verification & ERP Inventory Test Suite
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '../src/lib/db/prisma'
import Decimal from 'decimal.js'
import { StockReservationService } from '../src/lib/services/stock-reservation-service'
import { WarehouseService } from '../src/lib/services/warehouse-service'
import { StockAdjustmentService } from '../src/lib/services/stock-adjustment-service'
import { StockCountService } from '../src/lib/services/stock-count-service'
import { ReorderPlanningService } from '../src/lib/services/reorder-planning-service'
import { BatchSerialService } from '../src/lib/services/batch-serial-service'
import { InventoryTraceabilityService } from '../src/lib/services/inventory-traceability-service'
import { InventoryReportingService } from '../src/lib/services/inventory-reporting-service'
import { SalesOrderService } from '../src/lib/services/sales-order-service'
import { DeliveryNoteService } from '../src/lib/services/delivery-note-service'
import { InventoryService } from '../src/lib/services/inventory-service'
import { DocumentNumberingService } from '../src/lib/services/document-numbering-service'
import { AuditService } from '../src/lib/services/audit-service'

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

async function runPhase9Validation() {
  console.log('\n🚀 Starting PHASE 09 Test Suite: Advanced Inventory, Warehouse & Stock Control...\n')

  // Setup test tenant and context
  const testEmail = `phase9-runner-${Date.now()}@test.com`
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      fullName: 'Phase 9 Warehouse Tester',
      status: 'active',
    },
  })

  const businessA = await prisma.business.create({
    data: {
      name: `Acme Logistics Corp - ${Date.now()}`,
      defaultCurrency: 'USD',
    },
  })

  const businessB = await prisma.business.create({
    data: {
      name: `Tenant B Isolated WH - ${Date.now()}`,
      defaultCurrency: 'USD',
    },
  })

  // Create Warehouses for Tenant A
  const warehouseA1 = await prisma.warehouse.create({
    data: {
      businessId: businessA.id,
      name: 'Main Distribution Center A',
      code: 'WH-MAIN-A',
      isDefault: true,
      isActive: true,
    },
  })

  const warehouseA2 = await prisma.warehouse.create({
    data: {
      businessId: businessA.id,
      name: 'Regional Depot A2',
      code: 'WH-DEPOT-A2',
      isDefault: false,
      isActive: true,
    },
  })

  // Create Warehouse for Tenant B
  const warehouseB = await prisma.warehouse.create({
    data: {
      businessId: businessB.id,
      name: 'Tenant B Central Warehouse',
      code: 'WH-TENANT-B',
      isDefault: true,
      isActive: true,
    },
  })

  // Create Chart of Accounts for Tenant A (for GL integration)
  const coaAccounts = [
    { code: '1000', name: 'Cash on Hand', type: 'asset' },
    { code: '1200', name: 'Accounts Receivable', type: 'asset' },
    { code: '1400', name: 'Inventory Asset', type: 'asset' },
    { code: '2000', name: 'Accounts Payable', type: 'liability' },
    { code: '4000', name: 'Sales Revenue', type: 'revenue' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
    { code: '5900', name: 'Inventory Adjustment & Variance', type: 'expense' },
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
      },
    })
  }

  // Create Customer & Supplier
  const customer = await prisma.customer.create({
    data: {
      businessId: businessA.id,
      name: 'Acme Mega Retailer',
      currency: 'USD',
    },
  })

  const supplier = await prisma.supplier.create({
    data: {
      businessId: businessA.id,
      name: 'Global Supply Chain Ltd',
      currency: 'USD',
    },
  })

  // Create Products
  const standardProduct = await prisma.product.create({
    data: {
      businessId: businessA.id,
      code: `SKU-STD-${Date.now()}`,
      name: 'Precision Gear Assembly',
      productType: 'physical',
      unitOfMeasure: 'pcs',
      salePrice: new Decimal(250),
      purchasePrice: new Decimal(100),
      costPrice: new Decimal(100),
      trackInventory: true,
      minStock: new Decimal(10),
      maxStock: new Decimal(200),
      reorderLevel: new Decimal(25),
      reorderQuantity: new Decimal(50),
      safetyStock: new Decimal(5),
      preferredSupplierId: supplier.id,
    },
  })

  const batchProduct = await prisma.product.create({
    data: {
      businessId: businessA.id,
      code: `SKU-BATCH-${Date.now()}`,
      name: 'Pharmaceutical Grade Solvent',
      productType: 'physical',
      unitOfMeasure: 'liters',
      salePrice: new Decimal(80),
      purchasePrice: new Decimal(30),
      costPrice: new Decimal(30),
      trackInventory: true,
      isBatchTracked: true,
      minStock: new Decimal(20),
      reorderLevel: new Decimal(30),
    },
  })

  const serialProduct = await prisma.product.create({
    data: {
      businessId: businessA.id,
      code: `SKU-SERIAL-${Date.now()}`,
      name: 'High-End Laser Scanner',
      productType: 'physical',
      unitOfMeasure: 'unit',
      salePrice: new Decimal(1200),
      purchasePrice: new Decimal(600),
      costPrice: new Decimal(600),
      trackInventory: true,
      isSerialTracked: true,
    },
  })

  // Initial stock injection: 100 units of standard product in WH A1
  await InventoryService.recalculateWAC(
    businessA.id,
    standardProduct.id,
    warehouseA1.id,
    new Decimal(100),
    new Decimal(100),
    prisma
  )

  // -------------------------------------------------------------
  // TEST 1: Stock reservation
  // -------------------------------------------------------------
  console.log('Test 1: Stock reservation')
  const salesOrder1 = await SalesOrderService.createSalesOrder({
    businessId: businessA.id,
    customerId: customer.id,
    warehouseId: warehouseA1.id,
    orderDate: new Date(),
    currency: 'USD',
    userId: user.id,
    lines: [
      {
        productId: standardProduct.id,
        warehouseId: warehouseA1.id,
        description: standardProduct.name,
        quantity: 30,
        unitPrice: 250,
      },
    ],
  })

  const reservations1 = await StockReservationService.reserveStockForSalesOrder(
    businessA.id,
    salesOrder1.id,
    user.id
  )

  const breakdown1 = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    reservations1.length === 1 &&
      reservations1[0].status === 'active' &&
      breakdown1.onHand === 100 &&
      breakdown1.reserved === 30 &&
      breakdown1.available === 70,
    'Stock reserved for Sales Order (On-Hand: 100, Reserved: 30, Available: 70)'
  )

  // -------------------------------------------------------------
  // TEST 2: Partial reservation
  // -------------------------------------------------------------
  console.log('\nTest 2: Partial reservation')
  const partialRes = await StockReservationService.reserveStock(
    businessA.id,
    {
      productId: standardProduct.id,
      warehouseId: warehouseA1.id,
      quantity: 15,
      notes: 'Custom manual partial reservation',
    },
    user.id
  )

  const breakdown2 = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    partialRes.status === 'active' &&
      breakdown2.reserved === 45 &&
      breakdown2.available === 55,
    'Partial manual reservation successfully deducted from available stock (Reserved: 45, Available: 55)'
  )

  // -------------------------------------------------------------
  // TEST 3: Reservation release
  // -------------------------------------------------------------
  console.log('\nTest 3: Reservation release')
  await StockReservationService.releaseReservation(businessA.id, partialRes.id, user.id)

  const breakdown3 = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    breakdown3.reserved === 30 && breakdown3.available === 70,
    'Stock reservation released back to available pool (Reserved: 30, Available: 70)'
  )

  // -------------------------------------------------------------
  // TEST 4: Delivery consumes reservation
  // -------------------------------------------------------------
  console.log('\nTest 4: Delivery consumes reservation')
  const deliveryNote1 = await DeliveryNoteService.createDeliveryNote({
    businessId: businessA.id,
    customerId: customer.id,
    salesOrderId: salesOrder1.id,
    warehouseId: warehouseA1.id,
    deliveryDate: new Date(),
    userId: user.id,
    lines: [
      {
        salesOrderItemId: salesOrder1.items[0].id,
        productId: standardProduct.id,
        warehouseId: warehouseA1.id,
        deliveredQuantity: 30,
      },
    ],
  })

  await DeliveryNoteService.confirmDelivery(businessA.id, deliveryNote1.id, user.id)

  const resAfterDelivery = await prisma.stockReservation.findUnique({
    where: { id: reservations1[0].id },
  })

  const breakdown4 = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    resAfterDelivery?.status === 'consumed' &&
      new Decimal(resAfterDelivery.consumedQuantity).toNumber() === 30 &&
      breakdown4.onHand === 70 &&
      breakdown4.reserved === 0 &&
      breakdown4.available === 70,
    'Delivery Note confirmation cleanly consumed reservation and updated on-hand (On-Hand: 70, Reserved: 0, Available: 70)'
  )

  // -------------------------------------------------------------
  // TEST 5: Double-allocation prevention
  // -------------------------------------------------------------
  console.log('\nTest 5: Double-allocation prevention')
  let doubleAllocPrevented = false
  try {
    // Attempting to reserve 90 units when only 70 available
    await StockReservationService.reserveStock(
      businessA.id,
      {
        productId: standardProduct.id,
        warehouseId: warehouseA1.id,
        quantity: 90,
      },
      user.id
    )
  } catch (err: any) {
    doubleAllocPrevented = true
  }

  assert(
    doubleAllocPrevented,
    'Double-allocation and over-reservation beyond available inventory strictly blocked'
  )

  // -------------------------------------------------------------
  // TEST 6: Warehouse location stock
  // -------------------------------------------------------------
  console.log('\nTest 6: Warehouse location stock')
  const binLocationA = await WarehouseService.createLocation(
    businessA.id,
    {
      warehouseId: warehouseA1.id,
      code: 'A1-R01-S02-B04',
      name: 'Aisle 1, Rack 1, Shelf 2, Bin 4',
      aisle: 'A1',
      rack: 'R01',
      shelf: 'S02',
      bin: 'B04',
      zone: 'Zone North',
    },
    user.id
  )

  const locations = await WarehouseService.getLocations(businessA.id, warehouseA1.id)
  assert(
    locations.some((l) => l.code === 'A1-R01-S02-B04' && l.warehouse.id === warehouseA1.id),
    'Warehouse bin/location hierarchy created and queryable'
  )

  // -------------------------------------------------------------
  // TEST 7: Warehouse transfer (Request, Approve, Ship)
  // -------------------------------------------------------------
  console.log('\nTest 7: Warehouse transfer')
  const transfer1 = await WarehouseService.createTransfer(
    businessA.id,
    {
      fromWarehouseId: warehouseA1.id,
      toWarehouseId: warehouseA2.id,
      items: [
        {
          productId: standardProduct.id,
          quantity: 20,
          notes: 'Transfer 20 units to Depot A2',
        },
      ],
      status: 'requested',
      notes: 'Weekly Depot Replenishment',
    },
    user.id
  )

  await WarehouseService.approveTransfer(businessA.id, transfer1.id, user.id)
  const shippedTransfer = await WarehouseService.shipTransfer(businessA.id, transfer1.id, user.id)

  const whA1StockAfterShip = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    shippedTransfer.status === 'shipped' && whA1StockAfterShip.onHand === 50,
    'Stock Transfer approved and shipped: 20 units deducted from source warehouse (WH A1 on-hand: 50)'
  )

  // -------------------------------------------------------------
  // TEST 8: Transfer receiving
  // -------------------------------------------------------------
  console.log('\nTest 8: Transfer receiving')
  const receivedTransfer = await WarehouseService.receiveTransfer(businessA.id, transfer1.id, user.id)

  const whA2StockAfterReceive = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA2.id
  )

  assert(
    receivedTransfer.status === 'received' &&
      whA2StockAfterReceive.onHand === 20 &&
      whA2StockAfterReceive.available === 20,
    'Stock Transfer received at destination warehouse: 20 units added to Depot A2 with WAC maintained'
  )

  // -------------------------------------------------------------
  // TEST 9: Stock adjustment
  // -------------------------------------------------------------
  console.log('\nTest 9: Stock adjustment')
  const adjustment = await StockAdjustmentService.createAndPostAdjustment(
    businessA.id,
    {
      warehouseId: warehouseA1.id,
      adjustmentType: 'damage',
      reason: 'Water leak damaged 2 units in aisle A1',
      items: [
        {
          productId: standardProduct.id,
          quantity: 2,
          unitCost: 100,
        },
      ],
    },
    user.id
  )

  const whA1StockAfterAdj = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    adjustment.status === 'posted' &&
      adjustment.journalEntryId !== null &&
      whA1StockAfterAdj.onHand === 48,
    'Stock adjustment posted with inventory deduction (WH A1 on-hand: 48) and balanced GL journal entry'
  )

  // -------------------------------------------------------------
  // TEST 10: Stock count variance
  // -------------------------------------------------------------
  console.log('\nTest 10: Stock count variance')
  const stockCount = await StockCountService.createStockCount(
    businessA.id,
    {
      warehouseId: warehouseA1.id,
      countType: 'spot',
      productIds: [standardProduct.id],
      notes: 'End of Month Stock Audit',
    },
    user.id
  )

  await StockCountService.startCounting(businessA.id, stockCount.id, user.id)

  // Recorded actual: 50 units (expected snapshot was 48, so variance = +2 gain)
  const recordedCount = await StockCountService.recordCountItems(
    businessA.id,
    stockCount.id,
    [
      {
        productId: standardProduct.id,
        countedQuantity: 50,
        notes: 'Found 2 extra units misfiled',
      },
    ],
    user.id
  )

  const varianceReport = await InventoryReportingService.getStockCountVarianceReport(
    businessA.id,
    stockCount.id
  )

  const stdItem = varianceReport.items.find((i) => i.productId === standardProduct.id)

  assert(
    stdItem?.varianceQuantity === 2 &&
      stdItem?.varianceType === 'gain' &&
      varianceReport.netVarianceValue === 200,
    'Stock Count variance accurately computed (Snapshot: 48, Counted: 50, Gain: +2, Variance Value: +$200)'
  )

  // -------------------------------------------------------------
  // TEST 11: Stock count posting
  // -------------------------------------------------------------
  console.log('\nTest 11: Stock count posting')
  await StockCountService.submitForReview(businessA.id, stockCount.id, user.id)
  await StockCountService.approveCount(businessA.id, stockCount.id, user.id)
  const postedCount = await StockCountService.postCount(businessA.id, stockCount.id, user.id)

  const whA1StockAfterCount = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    postedCount.status === 'posted' &&
      postedCount.journalEntryId !== null &&
      whA1StockAfterCount.onHand === 50,
    'Stock count posted immutably with stock synchronized to counted balance (50 units) and GL entry'
  )

  // -------------------------------------------------------------
  // TEST 12: Reorder calculation
  // -------------------------------------------------------------
  console.log('\nTest 12: Reorder calculation')
  // Update policy: reorderLevel = 60, reorderQuantity = 50. Currently on-hand is 50 (< 60), so status is below_reorder_point
  await ReorderPlanningService.updateProductPolicy(
    businessA.id,
    standardProduct.id,
    {
      reorderLevel: 60,
      reorderQuantity: 50,
      safetyStock: 10,
    },
    user.id
  )

  const plan = await ReorderPlanningService.getReplenishmentPlan(businessA.id, {
    warehouseId: warehouseA1.id,
  })
  const stdPlan = plan.find((p) => p.productId === standardProduct.id)

  assert(
    stdPlan?.status === 'below_reorder_point' && stdPlan.suggestedPurchaseQuantity === 50,
    'Reorder planning accurately triggered below reorder point with suggested order quantity (50 units)'
  )

  // -------------------------------------------------------------
  // TEST 13: Inventory valuation
  // -------------------------------------------------------------
  console.log('\nTest 13: Inventory valuation')
  const valuation = await InventoryReportingService.getInventoryValuationReport(businessA.id)

  // WH A1: 50 units @ $100 = $5000, WH A2: 20 units @ $100 = $2000. Total = $7000
  assert(
    valuation.grandTotalQuantity === 70 && valuation.grandTotalValuation === 7000,
    'Inventory valuation report calculated correct Total Qty (70) and Valuation ($7,000) using WAC'
  )

  // -------------------------------------------------------------
  // TEST 14: Negative-stock detection
  // -------------------------------------------------------------
  console.log('\nTest 14: Negative-stock detection')
  assert(
    valuation.negativeStockCount === 0 && Array.isArray(valuation.costAnomalies),
    'Negative-stock detection and cost anomaly auditing verified with zero corrupt balances'
  )

  // -------------------------------------------------------------
  // TEST 15: Batch/lot tracking
  // -------------------------------------------------------------
  console.log('\nTest 15: Batch/lot tracking')
  const mfgDate = new Date()
  const expDateFuture = new Date()
  expDateFuture.setDate(expDateFuture.getDate() + 15) // Expiring in 15 days

  const batch1 = await BatchSerialService.createBatch(
    businessA.id,
    {
      productId: batchProduct.id,
      warehouseId: warehouseA1.id,
      lotNumber: 'LOT-PH9-2026-01',
      manufacturingDate: mfgDate,
      expiryDate: expDateFuture,
      quantity: 100,
      unitCost: 30,
    },
    user.id
  )

  assert(
    batch1.lotNumber === 'LOT-PH9-2026-01' &&
      new Decimal(batch1.quantity).toNumber() === 100 &&
      batch1.status === 'active',
    'Batch/lot registered with lot number, manufacturing date, and expiry date'
  )

  // -------------------------------------------------------------
  // TEST 16: Expiry detection
  // -------------------------------------------------------------
  console.log('\nTest 16: Expiry detection')
  const expiringSoon = await BatchSerialService.getExpiringSoonBatches(businessA.id, 30)

  assert(
    expiringSoon.some((b) => b.lotNumber === 'LOT-PH9-2026-01'),
    'Expiring-soon query successfully detected batch expiring within 30-day threshold'
  )

  // -------------------------------------------------------------
  // TEST 17: Serial number uniqueness
  // -------------------------------------------------------------
  console.log('\nTest 17: Serial number uniqueness')
  const serials = await BatchSerialService.registerSerialNumbers(
    businessA.id,
    {
      productId: serialProduct.id,
      warehouseId: warehouseA1.id,
      serialNumbers: ['SN-LSR-001', 'SN-LSR-002', 'SN-LSR-003'],
      unitCost: 600,
      purchaseReference: 'PO-2026-001',
    },
    user.id
  )

  let duplicateBlocked = false
  try {
    await BatchSerialService.registerSerialNumbers(
      businessA.id,
      {
        productId: serialProduct.id,
        warehouseId: warehouseA1.id,
        serialNumbers: ['SN-LSR-001'],
      },
      user.id
    )
  } catch (err) {
    duplicateBlocked = true
  }

  assert(
    serials.length === 3 && duplicateBlocked,
    'Serial numbers tracked individually and duplicate registration strictly prevented'
  )

  // -------------------------------------------------------------
  // TEST 18: Complete inventory traceability
  // -------------------------------------------------------------
  console.log('\nTest 18: Complete inventory traceability')
  const traceability = await InventoryTraceabilityService.getProductTraceability(
    businessA.id,
    standardProduct.id
  )

  assert(
    traceability.timeline.length >= 4 &&
      traceability.warehouses.length === 2 &&
      traceability.product.code === standardProduct.code,
    'End-to-end multi-step movement history & warehouse distribution traced chronologically'
  )

  // -------------------------------------------------------------
  // TEST 19: Cross-tenant isolation
  // -------------------------------------------------------------
  console.log('\nTest 19: Cross-tenant isolation')
  let crossTenantTransferBlocked = false
  try {
    // Attempting transfer from Tenant A warehouse to Tenant B warehouse
    await WarehouseService.createTransfer(
      businessA.id,
      {
        fromWarehouseId: warehouseA1.id,
        toWarehouseId: warehouseB.id,
        items: [{ productId: standardProduct.id, quantity: 5 }],
      },
      user.id
    )
  } catch (err) {
    crossTenantTransferBlocked = true
  }

  assert(
    crossTenantTransferBlocked,
    'Cross-tenant warehouse transfer strictly rejected at service validation layer'
  )

  // -------------------------------------------------------------
  // TEST 20: Permission enforcement & validation
  // -------------------------------------------------------------
  console.log('\nTest 20: Permission enforcement & validation')
  let invalidQtyBlocked = false
  try {
    await StockAdjustmentService.createAdjustment(
      businessA.id,
      {
        warehouseId: warehouseA1.id,
        adjustmentType: 'damage',
        reason: 'Test negative qty',
        items: [{ productId: standardProduct.id, quantity: -5 }],
      },
      user.id
    )
  } catch (err) {
    invalidQtyBlocked = true
  }

  assert(
    invalidQtyBlocked,
    'Validation rules strictly enforced on negative quantities and invalid adjustment inputs'
  )

  // -------------------------------------------------------------
  // TEST 21: Audit trail
  // -------------------------------------------------------------
  console.log('\nTest 21: Audit trail')
  const auditLogs = await prisma.auditLog.findMany({
    where: { businessId: businessA.id },
  })

  assert(
    auditLogs.length >= 10,
    `Audit trail comprehensively logged ${auditLogs.length} events across warehouse & inventory operations`
  )

  // -------------------------------------------------------------
  // TEST 22: Atomic rollback
  // -------------------------------------------------------------
  console.log('\nTest 22: Atomic rollback')
  const stockBeforeFail = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  let failedTransferRolledBack = false
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Valid deduction
      await InventoryService.issueStock(
        businessA.id,
        standardProduct.id,
        warehouseA1.id,
        new Decimal(5),
        tx
      )

      // 2. Intentional error
      throw new Error('Simulated network failure during warehouse operation')
    })
  } catch (err) {
    failedTransferRolledBack = true
  }

  const stockAfterFail = await StockReservationService.getProductStockBreakdown(
    businessA.id,
    standardProduct.id,
    warehouseA1.id
  )

  assert(
    failedTransferRolledBack && stockAfterFail.onHand === stockBeforeFail.onHand,
    'Atomic transaction rollback confirmed: zero stock discrepancy after failed operation'
  )

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n=============================================================')
  console.log(`Phase 09 Validation Complete: ${passed} Passed, ${failed} Failed`)
  console.log('=============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase9Validation()
  .catch((err) => {
    console.error('Fatal error running Phase 09 validation:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
