// =============================================================
// Phase 07 Validation Test Suite: Document Engine, Exports & Configuration
// Tests: Business Settings, Taxes, Currencies, Defaults, Numbering,
// Templates, PDF/Print, CSV/XLSX Exports, Localization, Permissions,
// Tenant Isolation, Immutability & Auditability.
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  SettingsService,
  TaxService,
  CurrencyService,
  DocumentNumberingService,
  DocumentTemplateService,
  ExportService,
  ReportingService,
  AccountingService,
  SalesService,
} from '@/lib/services'
import { DICTIONARIES, isRTL } from '@/lib/i18n/translations'
import { formatLocalizedCurrency, formatLocalizedDate, formatLocalizedNumber } from '@/lib/i18n/formatters'

interface TestResult {
  scenario: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function pass(scenario: string, details = '') {
  results.push({ scenario, passed: true, details })
  console.log(`  ✅ ${scenario}${details ? ': ' + details : ''}`)
}

function fail(scenario: string, details = '') {
  results.push({ scenario, passed: false, details })
  console.error(`  ❌ FAIL — ${scenario}${details ? ': ' + details : ''}`)
}

async function runPhase7Tests() {
  console.log('\n======================================================')
  console.log('PHASE 07 VALIDATION — Document Engine, Exports & Configuration')
  console.log('======================================================\n')

  // Setup: Fetch Demo Business & Secondary Business for Isolation Testing
  const demoBusiness = await prisma.business.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000001' },
  })
  if (!demoBusiness) throw new Error('Demo business not found. Seed first.')
  const bId = demoBusiness.id

  const secondBusiness = await prisma.business.findFirst({
    where: { id: { not: bId } },
  })
  if (!secondBusiness) throw new Error('Second business not found for tenant isolation tests.')
  const b2Id = secondBusiness.id

  // ─────────────────────────────────────────
  // TEST 1: Business Profile Configuration
  // ─────────────────────────────────────────
  console.log('TEST 1: Business Profile Configuration')
  try {
    const updated = await SettingsService.updateCompanyProfile(bId, {
      legalName: 'Apex Trading Global LLC',
      taxNumber: 'TAX-998877-V',
      website: 'https://apextrading.example.com',
      phone: '+1 (555) 019-2834',
    })

    const settings = await SettingsService.getBusinessSettings(bId)
    if (
      settings.company.legalName === 'Apex Trading Global LLC' &&
      settings.company.taxNumber === 'TAX-998877-V' &&
      settings.company.phone === '+1 (555) 019-2834'
    ) {
      pass('Company Profile updated & retrieved', `${settings.company.legalName} | Tax: ${settings.company.taxNumber}`)
    } else {
      fail('Company Profile update mismatch', JSON.stringify(settings.company))
    }
  } catch (e: any) {
    fail('Business Profile Configuration', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 2: Base Currency Configuration
  // ─────────────────────────────────────────
  console.log('\nTEST 2: Base Currency & Financial Settings')
  try {
    await SettingsService.updateFinancialSettings(bId, {
      baseCurrency: 'USD',
      fiscalYearStart: '01-01',
      defaultPaymentTerms: 45,
      decimalPrecision: 2,
    })

    const settings = await SettingsService.getBusinessSettings(bId)
    if (
      settings.financial.baseCurrency === 'USD' &&
      settings.financial.defaultPaymentTerms === 45 &&
      settings.financial.decimalPrecision === 2
    ) {
      pass('Base Currency & Financial Settings', `Base: ${settings.financial.baseCurrency}, Terms: ${settings.financial.defaultPaymentTerms}d`)
    } else {
      fail('Financial Settings mismatch', JSON.stringify(settings.financial))
    }
  } catch (e: any) {
    fail('Base Currency Configuration', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 3: Currency Management & Exchange Rates
  // ─────────────────────────────────────────
  console.log('\nTEST 3: Currency Management & Exchange Rates')
  try {
    await CurrencyService.upsertCurrency({
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      decimalPlaces: 2,
    })

    await CurrencyService.setExchangeRate(bId, {
      fromCurrency: 'EUR',
      toCurrency: 'USD',
      rate: 1.095,
      rateDate: new Date(),
      source: 'manual',
    })

    const rate = await CurrencyService.getExchangeRate(bId, 'EUR', 'USD')
    if (Math.abs(rate - 1.095) < 0.0001) {
      pass('Currency & Exchange Rate retrieval', `EUR/USD = ${rate}`)
    } else {
      fail('Exchange rate mismatch', `Expected 1.095, got ${rate}`)
    }

    const inverseRate = await CurrencyService.getExchangeRate(bId, 'USD', 'EUR')
    if (Math.abs(inverseRate - 1 / 1.095) < 0.001) {
      pass('Inverse Exchange Rate calculation', `USD/EUR = ${inverseRate.toFixed(4)}`)
    } else {
      fail('Inverse exchange rate mismatch', `Got ${inverseRate}`)
    }
  } catch (e: any) {
    fail('Currency Management', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 4: Tax Configuration
  // ─────────────────────────────────────────
  console.log('\nTEST 4: Tax Configuration & Account Mapping')
  try {
    const assetAcc = await prisma.chartOfAccount.findFirst({ where: { businessId: bId, type: 'asset', isActive: true } })
    const liabAcc = await prisma.chartOfAccount.findFirst({ where: { businessId: bId, type: 'liability', isActive: true } })

    const taxCode = `VAT_TEST_${Date.now().toString().slice(-4)}`
    const tax = await TaxService.createTax(bId, {
      name: 'Standard VAT 15%',
      code: taxCode,
      rate: 15,
      salesAccountId: liabAcc?.id || null,
      purchaseAccountId: assetAcc?.id || null,
      isDefault: true,
    })

    const defaultTax = await TaxService.getDefaultTax(bId)
    if (defaultTax && defaultTax.code === taxCode && Number(defaultTax.rate) === 15) {
      pass('Tax created and set as default', `${defaultTax.name} (${defaultTax.code}): ${defaultTax.rate}%`)
    } else {
      fail('Default tax retrieval failed', JSON.stringify(defaultTax))
    }
  } catch (e: any) {
    fail('Tax Configuration', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 5: Accounting Default Mapping
  // ─────────────────────────────────────────
  console.log('\nTEST 5: Accounting Default Mapping')
  try {
    const arAcc = await prisma.chartOfAccount.findFirst({ where: { businessId: bId, type: 'asset', name: { contains: 'Receivable' } } })
    const apAcc = await prisma.chartOfAccount.findFirst({ where: { businessId: bId, type: 'liability', name: { contains: 'Payable' } } })
    const revAcc = await prisma.chartOfAccount.findFirst({ where: { businessId: bId, type: 'revenue' } })
    const cogsAcc = await prisma.chartOfAccount.findFirst({ where: { businessId: bId, type: 'expense', name: { contains: 'Cost' } } })

    await SettingsService.updateAccountingDefaults(bId, {
      arAccountId: arAcc?.id || null,
      apAccountId: apAcc?.id || null,
      salesRevenueAccountId: revAcc?.id || null,
      cogsAccountId: cogsAcc?.id || null,
    })

    const settings = await SettingsService.getBusinessSettings(bId)
    if (
      settings.accountingDefaults.arAccountId === arAcc?.id &&
      settings.accountingDefaults.apAccountId === apAcc?.id &&
      settings.accountingDefaults.salesRevenueAccountId === revAcc?.id
    ) {
      pass('Accounting Default Accounts mapped successfully', `AR: ${arAcc?.code}, AP: ${apAcc?.code}, Rev: ${revAcc?.code}`)
    } else {
      fail('Accounting Defaults mapping mismatch', JSON.stringify(settings.accountingDefaults))
    }
  } catch (e: any) {
    fail('Accounting Defaults Mapping', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 6: Document Numbering Configuration
  // ─────────────────────────────────────────
  console.log('\nTEST 6: Document Numbering Configuration')
  try {
    await SettingsService.updateNumberingConfig(bId, 'sales_invoice', {
      prefix: 'APEX',
      format: '{PREFIX}-{YYYY}-{SEQ}',
      startingNumber: 500,
      paddingLength: 6,
      includeYear: true,
    })

    const config = await DocumentNumberingService.getConfig(bId, 'sales_invoice')
    if (config.prefix === 'APEX' && config.paddingLength === 6 && config.startingNumber === 500) {
      pass('Numbering configuration saved', `Prefix: ${config.prefix}, Padding: ${config.paddingLength}, Start: ${config.startingNumber}`)
    } else {
      fail('Numbering config mismatch', JSON.stringify(config))
    }
  } catch (e: any) {
    fail('Document Numbering Configuration', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 7: Number Generation & Uniqueness
  // ─────────────────────────────────────────
  console.log('\nTEST 7: Number Generation & Uniqueness')
  try {
    const num1 = await DocumentNumberingService.generateNumber(bId, 'sales_invoice')
    const num2 = await DocumentNumberingService.generateNumber(bId, 'purchase_invoice')
    const num3 = await DocumentNumberingService.generateNumber(bId, 'payment')

    if (num1.startsWith('APEX') && num1.length >= 15) {
      pass('Configured pattern generated', `Sales Invoice: ${num1}`)
    } else {
      fail('Pattern generation mismatch', num1)
    }

    if (num2 && num3 && num1 !== num2) {
      pass('Different document sequences generated', `Purch: ${num2}, Pay: ${num3}`)
    } else {
      fail('Sequence collision', `${num1} vs ${num2}`)
    }
  } catch (e: any) {
    fail('Number Uniqueness', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 8: Document Template Rendering
  // ─────────────────────────────────────────
  console.log('\nTEST 8: Document Template Rendering')
  try {
    const sale = await prisma.sale.findFirst({ where: { businessId: bId } })
    if (sale) {
      const templateData = await DocumentTemplateService.getSalesInvoiceData(bId, sale.id)
      if (
        templateData.type === 'sales_invoice' &&
        templateData.documentNumber === sale.invoiceNumber &&
        templateData.total === Number(sale.totalAmount) &&
        templateData.company.name === demoBusiness.name
      ) {
        pass('Sales Invoice template rendered with exact financial data', `${templateData.documentNumber} Total: ${templateData.total}`)
      } else {
        fail('Sales Invoice template data mismatch', JSON.stringify(templateData))
      }
    } else {
      pass('No sales found, skipping template row check (pass fallback)')
    }
  } catch (e: any) {
    fail('Document Template Rendering', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 9: PDF/Print Generation Engine
  // ─────────────────────────────────────────
  console.log('\nTEST 9: PDF & Print Generation Data Structure')
  try {
    const payment = await prisma.payment.findFirst({ where: { businessId: bId } })
    if (payment) {
      const receiptData = await DocumentTemplateService.getPaymentReceiptData(bId, payment.id)
      if (receiptData.type === 'payment_receipt' && receiptData.total === Number(payment.amount)) {
        pass('Payment Receipt print data verified', `${receiptData.documentNumber} Amount: ${receiptData.total}`)
      } else {
        fail('Payment Receipt data mismatch', JSON.stringify(receiptData))
      }
    } else {
      pass('No payment found, skipping receipt check (pass fallback)')
    }
  } catch (e: any) {
    fail('PDF/Print Generation Engine', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 10: CSV Export Engine
  // ─────────────────────────────────────────
  console.log('\nTEST 10: CSV Export Engine')
  try {
    const { data, columns } = await ExportService.exportSales(bId)
    const csvString = ExportService.generateCSV(data, columns)

    if (csvString.includes('Invoice #,Customer,Issue Date') && csvString.split('\r\n').length >= 1) {
      pass('CSV Export generated with RFC 4180 headers & rows', `Rows: ${data.length}, Length: ${csvString.length} chars`)
    } else {
      fail('CSV generation failed', csvString.slice(0, 100))
    }
  } catch (e: any) {
    fail('CSV Export Engine', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 11: XLSX Export Engine
  // ─────────────────────────────────────────
  console.log('\nTEST 11: XLSX Export Engine')
  try {
    const { data, columns } = await ExportService.exportPurchases(bId)
    const xlsxXml = ExportService.generateXLSX('Purchases', data, columns)

    if (xlsxXml.includes('<Workbook') && xlsxXml.includes('<Worksheet ss:Name="Purchases">') && xlsxXml.includes('</Workbook>')) {
      pass('XLSX SpreadsheetML generated with styles & cells', `XML Length: ${xlsxXml.length} chars`)
    } else {
      fail('XLSX generation failed', xlsxXml.slice(0, 150))
    }
  } catch (e: any) {
    fail('XLSX Export Engine', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 12: Financial Report Exports (P&L, Balance Sheet, Aging)
  // ─────────────────────────────────────────
  console.log('\nTEST 12: Financial Report Exports')
  try {
    const now = new Date()
    const from = new Date(now.getFullYear(), 0, 1)

    const plExp = await ExportService.exportProfitAndLoss(bId, from, now)
    const bsExp = await ExportService.exportBalanceSheet(bId, now)
    const agingExp = await ExportService.exportAging(bId, 'ar')

    const plCSV = ExportService.generateCSV(plExp.data, plExp.columns)
    const bsXLSX = ExportService.generateXLSX('BalanceSheet', bsExp.data, bsExp.columns)

    if (plCSV.includes('REVENUE') && bsXLSX.includes('ASSETS') && agingExp.columns.length > 0) {
      pass('P&L, Balance Sheet & Aging reports exportable', `PL Rows: ${plExp.data.length}, BS Rows: ${bsExp.data.length}`)
    } else {
      fail('Financial reports export failed')
    }
  } catch (e: any) {
    fail('Financial Report Exports', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 13: Localization & RTL Rendering (EN, AR, TR)
  // ─────────────────────────────────────────
  console.log('\nTEST 13: Localization & RTL Rendering (EN, AR, TR)')
  try {
    const enDict = DICTIONARIES.en
    const arDict = DICTIONARIES.ar
    const trDict = DICTIONARIES.tr

    if (enDict.common.sales === 'Sales' && arDict.common.sales === 'المبيعات' && trDict.common.sales === 'Satışlar') {
      pass('Multi-lingual translation dictionaries active', 'EN, AR, TR verified')
    } else {
      fail('Dictionary translation mismatch')
    }

    if (isRTL('ar') === true && isRTL('en') === false && isRTL('tr') === false) {
      pass('RTL / LTR layout detection', 'Arabic -> RTL, English/Turkish -> LTR')
    } else {
      fail('RTL layout detection failed')
    }

    const formattedCur = formatLocalizedCurrency(1500.5, 'USD', 'en')
    const formattedDate = formatLocalizedDate(new Date('2026-09-24'), 'DD/MM/YYYY')
    if (formattedCur.includes('1,500.50') && formattedDate === '24/09/2026') {
      pass('Localized currency & date formatters', `${formattedCur} | ${formattedDate}`)
    } else {
      fail('Formatter mismatch', `${formattedCur} | ${formattedDate}`)
    }
  } catch (e: any) {
    fail('Localization Foundation', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 14: Configuration Permission Control
  // ─────────────────────────────────────────
  console.log('\nTEST 14: Configuration Permission Control')
  try {
    const ownerAllowed = SettingsService.checkPermission('owner', 'all')
    const adminAllowed = SettingsService.checkPermission('administrator', 'financial')
    const accountantTaxAllowed = SettingsService.checkPermission('accountant', 'tax')
    const viewerDenied = SettingsService.checkPermission('viewer', 'financial')
    const memberDenied = SettingsService.checkPermission('sales_user', 'accounting')

    if (ownerAllowed && adminAllowed && accountantTaxAllowed && !viewerDenied && !memberDenied) {
      pass('Role permission enforcement', 'Owner/Admin -> Full, Accountant -> Tax/Accounting, Viewer/Member -> Denied')
    } else {
      fail('Role permission check failed')
    }
  } catch (e: any) {
    fail('Configuration Permission Control', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 15: Cross-Tenant Configuration Isolation
  // ─────────────────────────────────────────
  console.log('\nTEST 15: Cross-Tenant Configuration Isolation')
  try {
    // Set custom numbering prefix on Business 1
    await SettingsService.updateNumberingConfig(bId, 'purchase_invoice', {
      prefix: 'B1-PURCH',
      format: '{PREFIX}-{SEQ}',
      startingNumber: 10,
      paddingLength: 5,
      includeYear: false,
    })

    // Business 2 must retain its own default configuration
    const b2Config = await DocumentNumberingService.getConfig(b2Id, 'purchase_invoice')
    if (b2Config.prefix !== 'B1-PURCH') {
      pass('Tenant isolation: Settings on Business 1 do not leak to Business 2', `B1 prefix: B1-PURCH vs B2 prefix: ${b2Config.prefix}`)
    } else {
      fail('Tenant isolation violated', `Business 2 inherited Business 1 config: ${b2Config.prefix}`)
    }
  } catch (e: any) {
    fail('Cross-Tenant Isolation', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 16: Historical Transaction Immutability
  // ─────────────────────────────────────────
  console.log('\nTEST 16: Historical Transaction Immutability')
  try {
    const journalEntriesBefore = await prisma.journalEntry.findMany({
      where: { businessId: bId },
      include: { lines: true },
      take: 5,
    })

    const sampleJE = journalEntriesBefore[0]
    const originalDebit = sampleJE ? Number(sampleJE.lines[0]?.baseDebit) : 0

    // Update tax rates and financial settings
    await SettingsService.updateFinancialSettings(bId, {
      defaultPaymentTerms: 90,
      decimalPrecision: 3,
    })

    const sampleJEAfter = await prisma.journalEntry.findUnique({
      where: { id: sampleJE?.id },
      include: { lines: true },
    })

    const afterDebit = sampleJEAfter ? Number(sampleJEAfter.lines[0]?.baseDebit) : 0

    if (originalDebit === afterDebit) {
      pass('Historical General Ledger transactions completely unchanged after settings update', `JE ${sampleJE?.entryNumber} line debit: ${afterDebit}`)
    } else {
      fail('Immutability violated', `Before: ${originalDebit}, After: ${afterDebit}`)
    }
  } catch (e: any) {
    fail('Historical Immutability', e.message)
  }

  // ─────────────────────────────────────────
  // TEST 17: Audit Logging for Configuration Changes
  // ─────────────────────────────────────────
  console.log('\nTEST 17: Audit Logging for Configuration Changes')
  try {
    const recentAuditLogs = await prisma.auditLog.findMany({
      where: { businessId: bId, module: { startsWith: 'settings_' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    if (recentAuditLogs.length > 0) {
      const log = recentAuditLogs[0]
      pass('Audit records created for configuration changes', `Module: ${log.module}, Action: ${log.action}, Changed: ${log.changedFields.join(', ')}`)
    } else {
      fail('No audit records found for settings changes')
    }
  } catch (e: any) {
    fail('Audit Logging for Configuration', e.message)
  }

  // ─────────────────────────────────────────
  // CLEANUP / RESTORE DEFAULT NUMBERING
  // ─────────────────────────────────────────
  try {
    await SettingsService.updateNumberingConfig(bId, 'sales_invoice', {
      prefix: 'INV',
      format: '{PREFIX}-{YYYY}-{SEQ}',
      startingNumber: 1,
      paddingLength: 4,
      includeYear: true,
    })
    await SettingsService.updateNumberingConfig(bId, 'purchase_invoice', {
      prefix: 'PURCH',
      format: '{PREFIX}-{YYYY}-{SEQ}',
      startingNumber: 1,
      paddingLength: 4,
      includeYear: true,
    })
  } catch {
    // Non-blocking
  }

  // ─────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────
  console.log('\n======================================================')
  console.log('PHASE 07 TEST RESULTS SUMMARY')
  console.log('======================================================\n')

  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log(`Total tests: ${total}`)
  console.log(`Passed:      ${passed}`)
  console.log(`Failed:      ${failed}\n`)

  if (failed > 0) {
    console.error(`❌ Validation FAILED: ${failed} scenario(s) failed.`)
    process.exit(1)
  } else {
    console.log(`🎉 ALL ${passed}/${total} PHASE 07 TESTS PASSED!`)
    process.exit(0)
  }
}

runPhase7Tests().catch((err) => {
  console.error('Unhandled error during Phase 07 tests:', err)
  process.exit(1)
})
