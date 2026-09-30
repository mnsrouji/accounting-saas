// =============================================================
// Phase 02: Realistic Seed Data for Development & Testing
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { PrismaClient, Prisma } from '@prisma/client'
import Decimal from 'decimal.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting Phase 02 database seeding...')

  // 1. Currencies
  console.log('1. Seeding Currencies...')
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimalPlaces: 2 },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimalPlaces: 2 },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
    { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
  ]

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, symbol: c.symbol, decimalPlaces: c.decimalPlaces },
      create: c,
    })
  }

  // 2. Subscription Plans (SaaS Platform level)
  console.log('2. Seeding Subscription Plans...')
  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      name: 'Starter Tier',
      code: 'starter',
      description: 'Ideal for sole proprietors and freelancers',
      price: new Decimal('29.00'),
      currency: 'USD',
      billingInterval: 'month',
      maxUsers: 2,
      maxBusinesses: 1,
      maxInvoicesPerMonth: 100,
      features: { reports: 'standard', multiCurrency: false, auditLogs: false },
    },
  })

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'professional' },
    update: {},
    create: {
      name: 'Professional Tier',
      code: 'professional',
      description: 'Complete multi-user accounting for trading and growing businesses',
      price: new Decimal('79.00'),
      currency: 'USD',
      billingInterval: 'month',
      maxUsers: 10,
      maxBusinesses: 3,
      maxInvoicesPerMonth: 2000,
      features: { reports: 'advanced', multiCurrency: true, auditLogs: true, inventoryCosting: 'weighted_average' },
    },
  })

  // 3. Demo Users
  console.log('3. Seeding Demo Users...')
  const userOwner = await prisma.user.upsert({
    where: { email: 'demo.owner@demotrading.com' },
    update: {},
    create: {
      email: 'demo.owner@demotrading.com',
      fullName: 'John Owner',
      preferredLanguage: 'en',
      timezone: 'America/New_York',
      status: 'active',
    },
  })

  const userAccountant = await prisma.user.upsert({
    where: { email: 'demo.accountant@demotrading.com' },
    update: {},
    create: {
      email: 'demo.accountant@demotrading.com',
      fullName: 'Sarah Accountant',
      preferredLanguage: 'en',
      timezone: 'America/New_York',
      status: 'active',
    },
  })

  const userSales = await prisma.user.upsert({
    where: { email: 'demo.sales@demotrading.com' },
    update: {},
    create: {
      email: 'demo.sales@demotrading.com',
      fullName: 'David Sales',
      preferredLanguage: 'en',
      timezone: 'America/New_York',
      status: 'active',
    },
  })

  const userWarehouse = await prisma.user.upsert({
    where: { email: 'demo.warehouse@demotrading.com' },
    update: {},
    create: {
      email: 'demo.warehouse@demotrading.com',
      fullName: 'Mike Warehouse',
      preferredLanguage: 'en',
      timezone: 'America/New_York',
      status: 'active',
    },
  })

  // 4. Demo Business
  console.log('4. Seeding Demo Business: Demo Trading Company...')
  const demoBusiness = await prisma.business.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { name: 'Demo Trading Company', defaultCurrency: 'USD' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Trading Company',
      legalName: 'Demo Trading Company LLC',
      businessType: 'Wholesale & Enterprise Distribution',
      registrationNumber: 'REG-2026-US-8910',
      taxNumber: 'US-EIN-987654321',
      defaultCurrency: 'USD',
      fiscalYearStart: '01-01',
      country: 'US',
      timezone: 'America/New_York',
      address: '100 Wall Street, Suite 1400, New York, NY 10005',
      phone: '+1 (212) 555-0199',
      email: 'info@demotrading.com',
      status: 'active',
    },
  })

  const businessId = demoBusiness.id

  // 5. Subscription for Demo Business
  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      businessId,
      planId: proPlan.id,
      status: 'active',
      currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
      currentPeriodEnd: new Date('2027-01-01T00:00:00Z'),
    },
  })

  // 6. User Memberships in Business
  console.log('6. Seeding User Memberships...')
  const memberships = [
    { userId: userOwner.id, role: 'owner' as const },
    { userId: userAccountant.id, role: 'accountant' as const },
    { userId: userSales.id, role: 'sales_user' as const },
    { userId: userWarehouse.id, role: 'inventory_user' as const },
  ]

  for (const m of memberships) {
    await prisma.businessUser.upsert({
      where: { userId_businessId: { userId: m.userId, businessId } },
      update: { role: m.role, status: 'active' },
      create: {
        userId: m.userId,
        businessId,
        role: m.role,
        status: 'active',
        joinedAt: new Date(),
      },
    })
  }

  // 7. Granular Permissions & Roles
  console.log('7. Seeding Granular Permissions and Roles...')
  const permissionCodes = [
    { code: 'customers.view', module: 'customers', description: 'View customers' },
    { code: 'customers.create', module: 'customers', description: 'Create customers' },
    { code: 'customers.update', module: 'customers', description: 'Update customer records' },
    { code: 'customers.delete', module: 'customers', description: 'Archive/delete customers' },
    { code: 'sales.view', module: 'sales', description: 'View sales orders and invoices' },
    { code: 'sales.create', module: 'sales', description: 'Create sales orders and invoices' },
    { code: 'sales.update', module: 'sales', description: 'Update sales documents' },
    { code: 'sales.delete', module: 'sales', description: 'Void or cancel sales documents' },
    { code: 'purchases.view', module: 'purchases', description: 'View purchase documents' },
    { code: 'purchases.create', module: 'purchases', description: 'Create purchase documents' },
    { code: 'inventory.view', module: 'inventory', description: 'View stock levels' },
    { code: 'inventory.adjust', module: 'inventory', description: 'Adjust inventory and post movements' },
    { code: 'accounting.view', module: 'accounting', description: 'View chart of accounts and general ledger' },
    { code: 'accounting.post', module: 'accounting', description: 'Post and reverse journal entries' },
    { code: 'reports.view', module: 'reports', description: 'View balance sheet and P&L' },
    { code: 'settings.manage', module: 'settings', description: 'Manage business settings and taxes' },
  ]

  for (const p of permissionCodes) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    })
  }

  // 8. Chart of Accounts
  console.log('8. Seeding Chart of Accounts...')
  const accountsData = [
    // Assets (1000)
    { code: '1000', name: 'Assets', type: 'asset', normalBalance: 'debit', isHeader: true, sortOrder: 100 },
    { code: '1100', name: 'Cash and Cash Equivalents', type: 'asset', normalBalance: 'debit', isHeader: true, sortOrder: 110 },
    { code: '1110', name: 'Main Operating Cash', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 111 },
    { code: '1200', name: 'Bank Accounts', type: 'asset', normalBalance: 'debit', isHeader: true, sortOrder: 120 },
    { code: '1210', name: 'Silicon Valley Commercial Bank USD', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 121 },
    { code: '1300', name: 'Accounts Receivable (Trade Debtors)', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 130 },
    { code: '1400', name: 'Merchandise Inventory', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 140 },
    { code: '1500', name: 'Prepaid Expenses', type: 'asset', normalBalance: 'debit', sortOrder: 150 },

    // Liabilities (2000)
    { code: '2000', name: 'Liabilities', type: 'liability', normalBalance: 'credit', isHeader: true, sortOrder: 200 },
    { code: '2100', name: 'Accounts Payable (Trade Creditors)', type: 'liability', normalBalance: 'credit', isSystem: true, sortOrder: 210 },
    { code: '2200', name: 'Sales Tax / VAT Payable', type: 'liability', normalBalance: 'credit', isSystem: true, sortOrder: 220 },
    { code: '2210', name: 'Input VAT Recoverable', type: 'liability', normalBalance: 'debit', sortOrder: 221 },
    { code: '2300', name: 'Accrued Operating Liabilities', type: 'liability', normalBalance: 'credit', sortOrder: 230 },

    // Equity (3000)
    { code: '3000', name: 'Equity', type: 'equity', normalBalance: 'credit', isHeader: true, sortOrder: 300 },
    { code: '3100', name: "Owner's Contributed Capital", type: 'equity', normalBalance: 'credit', isSystem: true, sortOrder: 310 },
    { code: '3200', name: 'Retained Earnings', type: 'equity', normalBalance: 'credit', isSystem: true, sortOrder: 320 },

    // Revenue (4000)
    { code: '4000', name: 'Operating Revenue', type: 'revenue', normalBalance: 'credit', isHeader: true, sortOrder: 400 },
    { code: '4100', name: 'Hardware & Product Sales', type: 'revenue', normalBalance: 'credit', isSystem: true, sortOrder: 410 },
    { code: '4200', name: 'Consulting & Engineering Services', type: 'revenue', normalBalance: 'credit', sortOrder: 420 },
    { code: '4900', name: 'Foreign Exchange Gain/Loss', type: 'revenue', normalBalance: 'credit', sortOrder: 490 },

    // Expenses (5000)
    { code: '5000', name: 'Direct & Operating Expenses', type: 'expense', normalBalance: 'debit', isHeader: true, sortOrder: 500 },
    { code: '5100', name: 'Cost of Goods Sold (COGS)', type: 'expense', normalBalance: 'debit', isSystem: true, sortOrder: 510 },
    { code: '5200', name: 'Salaries & Staff Costs', type: 'expense', normalBalance: 'debit', sortOrder: 520 },
    { code: '5300', name: 'Facility Rent Expense', type: 'expense', normalBalance: 'debit', sortOrder: 530 },
    { code: '5400', name: 'Utilities & Internet Telecommunications', type: 'expense', normalBalance: 'debit', sortOrder: 540 },
    { code: '5500', name: 'Office Supplies & Logistics', type: 'expense', normalBalance: 'debit', sortOrder: 550 },
  ]

  const accountMap = new Map<string, string>()
  for (const acc of accountsData) {
    const record = await prisma.chartOfAccount.upsert({
      where: { businessId_code: { businessId, code: acc.code } },
      update: { name: acc.name, type: acc.type as any, normalBalance: acc.normalBalance as any },
      create: {
        businessId,
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
        normalBalance: acc.normalBalance as any,
        isHeader: acc.isHeader ?? false,
        isSystem: acc.isSystem ?? false,
        sortOrder: acc.sortOrder,
      },
    })
    accountMap.set(acc.code, record.id)
  }

  // 9. Cash and Bank Accounts
  console.log('9. Seeding Cash and Bank Accounts...')
  const mainCash = await prisma.cashAccount.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      businessId,
      name: 'Central Office Cash Drawer',
      code: 'CASH-01',
      currencyCode: 'USD',
      openingBalance: new Decimal('5000.00'),
      balance: new Decimal('5000.00'),
      accountId: accountMap.get('1110'),
      isDefault: true,
      isActive: true,
    },
  })

  const mainBank = await prisma.bankAccount.upsert({
    where: { id: '00000000-0000-0000-0000-000000000022' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000022',
      businessId,
      bankName: 'Silicon Valley Commercial Bank',
      accountName: 'Demo Trading Operating Checking',
      code: 'BANK-01',
      accountNumber: '9876543210',
      iban: 'US89SVBK00009876543210',
      swift: 'SVBKUS33',
      currencyCode: 'USD',
      openingBalance: new Decimal('75000.00'),
      balance: new Decimal('75000.00'),
      accountId: accountMap.get('1210'),
      isDefault: true,
      isActive: true,
    },
  })

  // 10. Taxes
  console.log('10. Seeding Tax configurations...')
  const standardVat = await prisma.tax.upsert({
    where: { businessId_code: { businessId, code: 'VAT15' } },
    update: {},
    create: {
      businessId,
      code: 'VAT15',
      name: 'Standard Value Added Tax 15%',
      rate: new Decimal('15.0000'),
      taxType: 'percentage',
      salesAccountId: accountMap.get('2200'),
      purchaseAccountId: accountMap.get('2210'),
      isDefault: true,
      isActive: true,
    },
  })

  // 11. Warehouses (2 warehouses)
  console.log('11. Seeding Warehouses...')
  const whCentral = await prisma.warehouse.upsert({
    where: { businessId_code: { businessId, code: 'WH-MAIN' } },
    update: {},
    create: {
      businessId,
      name: 'Central Logistics Fulfillment Hub',
      code: 'WH-MAIN',
      location: 'Building A, JFK Airport Logistics Park',
      address: '150 North Cargo Road, Jamaica, NY 11430',
      isDefault: true,
      isActive: true,
    },
  })

  const whEast = await prisma.warehouse.upsert({
    where: { businessId_code: { businessId, code: 'WH-EAST' } },
    update: {},
    create: {
      businessId,
      name: 'Eastern Distribution Center',
      code: 'WH-EAST',
      location: 'Zone 4, New Jersey Industrial Zone',
      address: '220 Turnpike Plaza, Edison, NJ 08817',
      isDefault: false,
      isActive: true,
    },
  })

  // 12. Categories & Products (11 products & services)
  console.log('12. Seeding Categories & 11 Products/Services...')
  const catHardware = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000031',
      businessId,
      name: 'Enterprise Networking & Hardware',
      description: 'Enterprise rack servers, switches, and high-speed cabling',
      type: 'product',
      status: 'active',
    },
  })

  const catServices = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000032' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000032',
      businessId,
      name: 'Professional Engineering Services',
      description: 'Network architecture, installation, and cloud setup',
      type: 'product',
      status: 'active',
    },
  })

  const rawProducts = [
    { code: 'PROD-101', barcode: '880912345001', name: 'Enterprise Server Rack 42U Heavy Duty', type: 'physical', unit: 'unit', purchase: '1200.00', sale: '1800.00', cost: '1200.00', reorder: '5', track: true, cat: catHardware.id },
    { code: 'PROD-102', barcode: '880912345002', name: 'High-Performance 48-Port Managed Switch', type: 'physical', unit: 'unit', purchase: '450.00', sale: '750.00', cost: '450.00', reorder: '10', track: true, cat: catHardware.id },
    { code: 'PROD-103', barcode: '880912345003', name: 'Commercial Wi-Fi 6 Access Point Pro', type: 'physical', unit: 'unit', purchase: '120.00', sale: '220.00', cost: '120.00', reorder: '15', track: true, cat: catHardware.id },
    { code: 'PROD-104', barcode: '880912345004', name: 'Cat6A Shielded Ethernet Bulk Cable 305m', type: 'physical', unit: 'roll', purchase: '85.00', sale: '150.00', cost: '85.00', reorder: '20', track: true, cat: catHardware.id },
    { code: 'PROD-105', barcode: '880912345005', name: 'Enterprise SSD 3.84TB NVMe Gen4 U.3', type: 'physical', unit: 'piece', purchase: '280.00', sale: '450.00', cost: '280.00', reorder: '10', track: true, cat: catHardware.id },
    { code: 'PROD-106', barcode: '880912345006', name: 'Server Memory 64GB DDR5 4800MHz ECC', type: 'physical', unit: 'piece', purchase: '190.00', sale: '310.00', cost: '190.00', reorder: '25', track: true, cat: catHardware.id },
    { code: 'PROD-107', barcode: '880912345007', name: '10Gbps SFP+ Optical Transceiver Multi-Mode', type: 'physical', unit: 'pair', purchase: '35.00', sale: '70.00', cost: '35.00', reorder: '30', track: true, cat: catHardware.id },
    { code: 'PROD-108', barcode: '880912345008', name: 'Smart Online UPS 3000VA Rackmount 2U', type: 'physical', unit: 'unit', purchase: '650.00', sale: '980.00', cost: '650.00', reorder: '4', track: true, cat: catHardware.id },
    { code: 'PROD-109', barcode: '880912345009', name: 'Dual Monitor Heavy Duty Gas Spring Arm', type: 'physical', unit: 'unit', purchase: '75.00', sale: '135.00', cost: '75.00', reorder: '15', track: true, cat: catHardware.id },
    { code: 'PROD-110', barcode: '880912345010', name: 'KVM Switch 8-Port USB HDMI with Cables', type: 'physical', unit: 'unit', purchase: '180.00', sale: '290.00', cost: '180.00', reorder: '8', track: true, cat: catHardware.id },
    { code: 'SERV-201', barcode: null, name: 'Enterprise Network Architecture Consultation', type: 'service', unit: 'hour', purchase: '0.00', sale: '175.00', cost: '0.00', reorder: '0', track: false, cat: catServices.id },
  ]

  const productMap = new Map<string, any>()
  for (const p of rawProducts) {
    const prod = await prisma.product.upsert({
      where: { businessId_code: { businessId, code: p.code } },
      update: { salePrice: new Decimal(p.sale), purchasePrice: new Decimal(p.purchase), costPrice: new Decimal(p.cost) },
      create: {
        businessId,
        code: p.code,
        barcode: p.barcode,
        name: p.name,
        productType: p.type,
        unitOfMeasure: p.unit,
        salePrice: new Decimal(p.sale),
        purchasePrice: new Decimal(p.purchase),
        costPrice: new Decimal(p.cost),
        trackInventory: p.track,
        reorderLevel: new Decimal(p.reorder),
        categoryId: p.cat,
        taxId: standardVat.id,
        taxRate: standardVat.rate,
        isActive: true,
      },
    })
    productMap.set(p.code, prod)

    // Initial stock in central warehouse for physical items
    if (p.track) {
      await prisma.inventoryBalance.upsert({
        where: { businessId_productId_warehouseId: { businessId, productId: prod.id, warehouseId: whCentral.id } },
        update: {},
        create: {
          businessId,
          productId: prod.id,
          warehouseId: whCentral.id,
          quantity: new Decimal('50.0000'),
          reservedQuantity: new Decimal('0.0000'),
          availableQuantity: new Decimal('50.0000'),
          averageCost: new Decimal(p.cost),
        },
      })
    }
  }

  // 13. Customers (5 customers)
  console.log('13. Seeding 5 Customers...')
  const customersData = [
    { code: 'CUST-001', name: 'Apex Global Logistics Corp', companyName: 'Apex Global Logistics LLC', email: 'billing@apexgl.com', phone: '+1 (212) 555-8811', creditLimit: '50000', currency: 'USD', terms: 30 },
    { code: 'CUST-002', name: 'Beacon Technologies Inc', companyName: 'Beacon Technologies Incorporated', email: 'finance@beacontech.io', phone: '+1 (415) 555-7722', creditLimit: '25000', currency: 'USD', terms: 15 },
    { code: 'CUST-003', name: 'Crescent Retailers Europe', companyName: 'Crescent Retailers B.V.', email: 'accounts@crescentretail.eu', phone: '+31 20 555 4433', creditLimit: '40000', currency: 'EUR', terms: 30 },
    { code: 'CUST-004', name: 'Delta Wholesale Distribution', companyName: 'Delta Distribution Partners', email: 'payables@deltadist.com', phone: '+1 (312) 555-9944', creditLimit: '100000', currency: 'USD', terms: 45 },
    { code: 'CUST-005', name: 'Echo Cloud Enterprises', companyName: 'Echo Cloud Systems Inc', email: 'procurement@echocloud.com', phone: '+1 (206) 555-3355', creditLimit: '30000', currency: 'USD', terms: 30 },
  ]

  const customerMap = new Map<string, any>()
  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { businessId_code: { businessId, code: c.code } },
      update: {},
      create: {
        businessId,
        code: c.code,
        name: c.name,
        companyName: c.companyName,
        email: c.email,
        phone: c.phone,
        creditLimit: new Decimal(c.creditLimit),
        currency: c.currency,
        paymentTerms: c.terms,
        isActive: true,
        createdBy: userOwner.id,
      },
    })
    customerMap.set(c.code, cust)
  }

  // 14. Suppliers (5 suppliers)
  console.log('14. Seeding 5 Suppliers...')
  const suppliersData = [
    { code: 'SUPP-001', name: 'Quantum Server Hardware Ltd', companyName: 'Quantum Hardware Global', email: 'sales@quantumhw.com', phone: '+1 (408) 555-1100', currency: 'USD', terms: 30 },
    { code: 'SUPP-002', name: 'Prime Network Components Corp', companyName: 'Prime Network Inc', email: 'orders@primenetworks.com', phone: '+1 (512) 555-2200', currency: 'USD', terms: 30 },
    { code: 'SUPP-003', name: 'EuroTech Optical Supplies GmbH', companyName: 'EuroTech Optical Supplies', email: 'verkauf@eurotechoptics.de', phone: '+49 89 555 3300', currency: 'EUR', terms: 30 },
    { code: 'SUPP-004', name: 'Pacific Heavy Packaging Co', companyName: 'Pacific Industrial Packaging LLC', email: 'support@pacificpack.com', phone: '+1 (206) 555-4400', currency: 'USD', terms: 15 },
    { code: 'SUPP-005', name: 'Horizon Cloud Data Centers', companyName: 'Horizon Facilities Inc', email: 'billing@horizonfacilities.com', phone: '+1 (703) 555-5500', currency: 'USD', terms: 30 },
  ]

  const supplierMap = new Map<string, any>()
  for (const s of suppliersData) {
    const supp = await prisma.supplier.upsert({
      where: { businessId_code: { businessId, code: s.code } },
      update: {},
      create: {
        businessId,
        code: s.code,
        name: s.name,
        companyName: s.companyName,
        email: s.email,
        phone: s.phone,
        currency: s.currency,
        paymentTerms: s.terms,
        isActive: true,
        createdBy: userOwner.id,
      },
    })
    supplierMap.set(s.code, supp)
  }

  // 15. Opening Balance Balanced Journal Entry
  console.log('15. Seeding Opening Balance Balanced Journal Entry...')
  const existingJe = await prisma.journalEntry.findUnique({
    where: { businessId_entryNumber: { businessId, entryNumber: 'JE-2026-0001' } },
  })

  if (!existingJe) {
    // 1. Create draft journal entry
    const je = await prisma.journalEntry.create({
      data: {
        businessId,
        entryNumber: 'JE-2026-0001',
        entryDate: new Date('2026-01-01'),
        description: 'Opening Balances — Initial Capital & Cash/Bank Accounts',
        sourceType: 'opening_balance',
        currencyCode: 'USD',
        exchangeRate: new Decimal('1.0000000000'),
        status: 'draft',
        createdBy: userAccountant.id,
      },
    })

    // 2. Insert lines (Debits: SVB Bank $75,000 + Cash $5,000 = $80,000; Credits: Owner Capital $80,000)
    await prisma.journalEntryLine.createMany({
      data: [
        {
          journalEntryId: je.id,
          businessId,
          accountId: accountMap.get('1210')!, // SVB Bank
          description: 'Opening balance in Silicon Valley Bank checking',
          debitAmount: new Decimal('75000.00'),
          creditAmount: new Decimal('0.00'),
          baseDebit: new Decimal('75000.00'),
          baseCredit: new Decimal('0.00'),
          lineOrder: 1,
        },
        {
          journalEntryId: je.id,
          businessId,
          accountId: accountMap.get('1110')!, // Cash
          description: 'Opening balance in Main Cash drawer',
          debitAmount: new Decimal('5000.00'),
          creditAmount: new Decimal('0.00'),
          baseDebit: new Decimal('5000.00'),
          baseCredit: new Decimal('0.00'),
          lineOrder: 2,
        },
        {
          journalEntryId: je.id,
          businessId,
          accountId: accountMap.get('3100')!, // Owner Equity
          description: 'Initial Contributed Capital by Owner',
          debitAmount: new Decimal('0.00'),
          creditAmount: new Decimal('80000.00'),
          baseDebit: new Decimal('0.00'),
          baseCredit: new Decimal('80000.00'),
          lineOrder: 3,
        },
      ],
    })

    // 3. Post the journal entry (triggers verify balance = 80000 == 80000)
    await prisma.journalEntry.update({
      where: { id: je.id },
      data: {
        status: 'posted',
        postedAt: new Date('2026-01-01T12:00:00Z'),
        postedBy: userAccountant.id,
      },
    })
  }

  // 16. Purchases & Inventory Movement with Weighted Average Costing
  console.log('16. Seeding Purchase Invoice and Inventory Movement...')
  const existingPurchase = await prisma.purchase.findUnique({
    where: { businessId_purchaseNumber: { businessId, purchaseNumber: 'PINV-2026-0001' } },
  })

  if (!existingPurchase) {
    const supp = supplierMap.get('SUPP-001')!
    const p101 = productMap.get('PROD-101')!

    const purchase = await prisma.purchase.create({
      data: {
        businessId,
        supplierId: supp.id,
        purchaseNumber: 'PINV-2026-0001',
        referenceNumber: 'QNT-INV-8901',
        purchaseDate: new Date('2026-01-10'),
        dueDate: new Date('2026-02-10'),
        currencyCode: 'USD',
        exchangeRate: new Decimal('1'),
        subtotal: new Decimal('12000.00'), // 10 units @ $1,200
        discountAmount: new Decimal('0.00'),
        taxAmount: new Decimal('0.00'),
        totalAmount: new Decimal('12000.00'),
        paidAmount: new Decimal('8000.00'),
        balanceDue: new Decimal('4000.00'),
        baseSubtotal: new Decimal('12000.00'),
        baseTotalAmount: new Decimal('12000.00'),
        status: 'partial',
        createdBy: userOwner.id,
        items: {
          create: [
            {
              productId: p101.id,
              warehouseId: whCentral.id,
              description: 'Enterprise Server Rack 42U Heavy Duty - Batch A',
              quantity: new Decimal('10.0000'),
              unitPrice: new Decimal('1200.00'),
              lineTotal: new Decimal('12000.00'),
              lineOrder: 1,
            },
          ],
        },
      },
    })

    // Traceable inventory movement
    await prisma.inventoryMovement.create({
      data: {
        businessId,
        productId: p101.id,
        warehouseId: whCentral.id,
        movementType: 'purchase',
        quantity: new Decimal('10.0000'),
        unitCost: new Decimal('1200.00'),
        totalCost: new Decimal('12000.00'),
        referenceType: 'purchase',
        referenceId: purchase.id,
        movementDate: new Date('2026-01-10'),
        createdBy: userWarehouse.id,
      },
    })

    // Payment to Supplier with Payment Allocation
    const suppPayment = await prisma.payment.create({
      data: {
        businessId,
        paymentNumber: 'SPAY-2026-0001',
        paymentDate: new Date('2026-01-15'),
        type: 'outgoing',
        direction: 'outbound',
        status: 'partially_allocated',
        supplierId: supp.id,
        bankAccountId: mainBank.id,
        amount: new Decimal('8000.00'),
        baseAmount: new Decimal('8000.00'),
        allocatedAmount: new Decimal('8000.00'),
        unallocatedAmount: new Decimal('0.00'),
        method: 'bank_transfer',
        reference: 'WIRE-QNT-8000',
        createdBy: userAccountant.id,
      },
    })

    // First-class PaymentAllocation entity
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: suppPayment.id,
        purchaseId: purchase.id,
        allocatedAmount: new Decimal('8000.00'),
        allocatedBaseAmount: new Decimal('8000.00'),
        notes: 'Partial payment on Batch A server racks',
        createdBy: userAccountant.id,
      },
    })
  }

  // 17. Sales Invoices and Multi-Invoice Payment Allocation
  console.log('17. Seeding Sales Invoices & Multi-Invoice Allocations...')
  const custApex = customerMap.get('CUST-001')!
  const p102 = productMap.get('PROD-102')!
  const p103 = productMap.get('PROD-103')!

  const existingSale1 = await prisma.sale.findUnique({
    where: { businessId_invoiceNumber: { businessId, invoiceNumber: 'SINV-2026-0001' } },
  })

  if (!existingSale1) {
    // Sale 1: Fully Paid ($3,750)
    const sale1 = await prisma.sale.create({
      data: {
        businessId,
        customerId: custApex.id,
        invoiceNumber: 'SINV-2026-0001',
        invoiceDate: new Date('2026-01-20'),
        dueDate: new Date('2026-02-20'),
        status: 'paid',
        currencyCode: 'USD',
        exchangeRate: new Decimal('1'),
        subtotal: new Decimal('3750.00'), // 5 units of PROD-102 @ $750
        totalAmount: new Decimal('3750.00'),
        paidAmount: new Decimal('3750.00'),
        balanceDue: new Decimal('0.00'),
        baseSubtotal: new Decimal('3750.00'),
        baseTotalAmount: new Decimal('3750.00'),
        createdBy: userSales.id,
        items: {
          create: [
            {
              productId: p102.id,
              warehouseId: whCentral.id,
              description: 'High-Performance 48-Port Managed Switch',
              quantity: new Decimal('5.0000'),
              unitPrice: new Decimal('750.00'),
              costBasis: new Decimal('450.00'),
              lineTotal: new Decimal('3750.00'),
              lineOrder: 1,
            },
          ],
        },
      },
    })

    // Inventory movement for Sale 1
    await prisma.inventoryMovement.create({
      data: {
        businessId,
        productId: p102.id,
        warehouseId: whCentral.id,
        movementType: 'sale',
        quantity: new Decimal('-5.0000'),
        unitCost: new Decimal('450.00'),
        totalCost: new Decimal('2250.00'),
        referenceType: 'sale',
        referenceId: sale1.id,
        movementDate: new Date('2026-01-20'),
        createdBy: userWarehouse.id,
      },
    })

    // Sale 2: Open/Partial ($4,400)
    const sale2 = await prisma.sale.create({
      data: {
        businessId,
        customerId: custApex.id,
        invoiceNumber: 'SINV-2026-0002',
        invoiceDate: new Date('2026-01-25'),
        dueDate: new Date('2026-02-25'),
        status: 'partial',
        currencyCode: 'USD',
        exchangeRate: new Decimal('1'),
        subtotal: new Decimal('4400.00'), // 20 units of PROD-103 @ $220
        totalAmount: new Decimal('4400.00'),
        paidAmount: new Decimal('1250.00'),
        balanceDue: new Decimal('3150.00'),
        baseSubtotal: new Decimal('4400.00'),
        baseTotalAmount: new Decimal('4400.00'),
        createdBy: userSales.id,
        items: {
          create: [
            {
              productId: p103.id,
              warehouseId: whCentral.id,
              description: 'Commercial Wi-Fi 6 Access Point Pro',
              quantity: new Decimal('20.0000'),
              unitPrice: new Decimal('220.00'),
              costBasis: new Decimal('120.00'),
              lineTotal: new Decimal('4400.00'),
              lineOrder: 1,
            },
          ],
        },
      },
    })

    // Single Payment applied to MULTIPLE Invoices ($5,000 received from Apex: $3,750 for INV-0001, $1,250 for INV-0002)
    const multiPayment = await prisma.payment.create({
      data: {
        businessId,
        paymentNumber: 'PAY-2026-0001',
        paymentDate: new Date('2026-01-28'),
        type: 'incoming',
        direction: 'inbound',
        status: 'fully_allocated',
        customerId: custApex.id,
        bankAccountId: mainBank.id,
        amount: new Decimal('5000.00'),
        baseAmount: new Decimal('5000.00'),
        allocatedAmount: new Decimal('5000.00'),
        unallocatedAmount: new Decimal('0.00'),
        method: 'bank_transfer',
        reference: 'WIRE-APEX-5000',
        createdBy: userAccountant.id,
      },
    })

    // Allocation 1: $3,750 to Sale 1
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: multiPayment.id,
        saleId: sale1.id,
        allocatedAmount: new Decimal('3750.00'),
        allocatedBaseAmount: new Decimal('3750.00'),
        notes: 'Full settlement of SINV-2026-0001',
        createdBy: userAccountant.id,
      },
    })

    // Allocation 2: $1,250 to Sale 2 (partial payment)
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: multiPayment.id,
        saleId: sale2.id,
        allocatedAmount: new Decimal('1250.00'),
        allocatedBaseAmount: new Decimal('1250.00'),
        notes: 'Partial payment on SINV-2026-0002',
        createdBy: userAccountant.id,
      },
    })

    // Balanced Journal Entry for Sales Payment
    const jePay = await prisma.journalEntry.create({
      data: {
        businessId,
        entryNumber: 'JE-2026-0002',
        entryDate: new Date('2026-01-28'),
        description: 'Customer Payment from Apex Global Logistics ($5,000 split across 2 invoices)',
        sourceType: 'payment',
        sourceId: multiPayment.id,
        status: 'draft',
        createdBy: userAccountant.id,
      },
    })

    await prisma.journalEntryLine.createMany({
      data: [
        {
          journalEntryId: jePay.id,
          businessId,
          accountId: accountMap.get('1210')!, // Bank Debit
          customerId: custApex.id,
          description: 'Payment receipt via SVB Bank wire',
          debitAmount: new Decimal('5000.00'),
          creditAmount: new Decimal('0.00'),
          baseDebit: new Decimal('5000.00'),
          baseCredit: new Decimal('0.00'),
          lineOrder: 1,
        },
        {
          journalEntryId: jePay.id,
          businessId,
          accountId: accountMap.get('1300')!, // Accounts Receivable Credit
          customerId: custApex.id,
          description: 'Credit Accounts Receivable for Apex Global Logistics',
          debitAmount: new Decimal('0.00'),
          creditAmount: new Decimal('5000.00'),
          baseDebit: new Decimal('0.00'),
          baseCredit: new Decimal('5000.00'),
          lineOrder: 2,
        },
      ],
    })

    await prisma.journalEntry.update({
      where: { id: jePay.id },
      data: {
        status: 'posted',
        postedAt: new Date('2026-01-28T15:00:00Z'),
        postedBy: userAccountant.id,
      },
    })
  }

  // 18. Multi-Currency Exchange Rate & Foreign Transaction
  console.log('18. Seeding Historical Exchange Rates...')
  await prisma.exchangeRate.createMany({
    data: [
      { businessId, fromCurrency: 'EUR', toCurrency: 'USD', rate: new Decimal('1.0850000000'), rateDate: new Date('2026-01-01'), source: 'central_bank' },
      { businessId, fromCurrency: 'EUR', toCurrency: 'USD', rate: new Decimal('1.0920000000'), rateDate: new Date('2026-02-01'), source: 'central_bank' },
      { businessId, fromCurrency: 'TRY', toCurrency: 'USD', rate: new Decimal('0.0280000000'), rateDate: new Date('2026-01-01'), source: 'central_bank' },
      { businessId, fromCurrency: 'SAR', toCurrency: 'USD', rate: new Decimal('0.2666000000'), rateDate: new Date('2026-01-01'), source: 'central_bank' },
    ],
  })

  // 19. Operating Expenses
  console.log('19. Seeding Operating Expenses with Journal Entries...')
  const existingExp = await prisma.expense.findUnique({
    where: { businessId_expenseNumber: { businessId, expenseNumber: 'EXP-2026-0001' } },
  })

  if (!existingExp) {
    const exp = await prisma.expense.create({
      data: {
        businessId,
        expenseNumber: 'EXP-2026-0001',
        expenseDate: new Date('2026-01-05'),
        description: 'Monthly Corporate Facility Rent - Wall Street Hub',
        vendor: 'Wall Street Property Management LLC',
        amount: new Decimal('3500.00'),
        taxAmount: new Decimal('0.00'),
        totalAmount: new Decimal('3500.00'),
        baseAmount: new Decimal('3500.00'),
        accountId: accountMap.get('5300'), // Rent Expense
        bankAccountId: mainBank.id,
        paymentStatus: 'paid',
        status: 'posted',
        createdBy: userAccountant.id,
      },
    })

    // Balanced Journal Entry for Rent Expense
    const jeExp = await prisma.journalEntry.create({
      data: {
        businessId,
        entryNumber: 'JE-2026-0003',
        entryDate: new Date('2026-01-05'),
        description: 'Facility Rent for January 2026',
        sourceType: 'expense',
        sourceId: exp.id,
        status: 'draft',
        createdBy: userAccountant.id,
      },
    })

    await prisma.journalEntryLine.createMany({
      data: [
        {
          journalEntryId: jeExp.id,
          businessId,
          accountId: accountMap.get('5300')!, // Rent Expense (Debit)
          description: 'January 2026 Facility Rent',
          debitAmount: new Decimal('3500.00'),
          creditAmount: new Decimal('0.00'),
          baseDebit: new Decimal('3500.00'),
          baseCredit: new Decimal('0.00'),
          lineOrder: 1,
        },
        {
          journalEntryId: jeExp.id,
          businessId,
          accountId: accountMap.get('1210')!, // Bank (Credit)
          description: 'Payment via SVB Bank ACH transfer',
          debitAmount: new Decimal('0.00'),
          creditAmount: new Decimal('3500.00'),
          baseDebit: new Decimal('0.00'),
          baseCredit: new Decimal('3500.00'),
          lineOrder: 2,
        },
      ],
    })

    await prisma.journalEntry.update({
      where: { id: jeExp.id },
      data: {
        status: 'posted',
        postedAt: new Date('2026-01-05T10:00:00Z'),
        postedBy: userAccountant.id,
      },
    })
  }

  console.log('✅ Phase 02 Seeding completed successfully!')
  console.log(`Demo Business ID: ${businessId}`)
  console.log('All entities, relationships, constraints, and audit trails established.')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
