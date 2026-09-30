// =============================================================
// Settings Service — Business Configuration & Accounting Defaults
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { DocumentType } from './document-numbering-service'

export interface CompanyProfileInput {
  name?: string
  legalName?: string | null
  businessType?: string | null
  registrationNumber?: string | null
  taxNumber?: string | null
  country?: string | null
  timezone?: string
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
}

export interface FinancialSettingsInput {
  baseCurrency?: string
  fiscalYearStart?: string // MM-DD
  defaultPaymentTerms?: number
  decimalPrecision?: number
  dateFormat?: string
  numberFormat?: string
}

export interface AccountingDefaultsInput {
  arAccountId?: string | null
  apAccountId?: string | null
  salesRevenueAccountId?: string | null
  inventoryAccountId?: string | null
  cogsAccountId?: string | null
  salesTaxAccountId?: string | null
  purchaseTaxAccountId?: string | null
  cashAccountId?: string | null
  bankAccountId?: string | null
  retainedEarningsAccountId?: string | null
  defaultExpenseAccountId?: string | null
}

export interface NumberingConfigItem {
  prefix: string
  format: string // e.g. "{PREFIX}-{YYYY}-{SEQ}" or "{PREFIX}/{YYYY}/{SEQ}" or "{PREFIX}-{SEQ}"
  startingNumber: number
  paddingLength: number
  includeYear: boolean
}

export type NumberingSettingsInput = Partial<Record<DocumentType, NumberingConfigItem>>

export interface BusinessDefaultsInput {
  defaultWarehouseId?: string | null
  defaultTaxId?: string | null
  defaultPaymentAccountId?: string | null
  defaultPaymentTerms?: number
  defaultLanguage?: 'en' | 'ar' | 'tr'
}

export interface TemplateSettingsInput {
  accentColor?: string
  footerText?: string
  showTaxDetails?: boolean
  showBankingDetails?: boolean
  bankDetailsText?: string
  termsAndConditions?: string
  defaultLanguage?: 'en' | 'ar' | 'tr'
}

export interface LocalizationSettingsInput {
  defaultLanguage: 'en' | 'ar' | 'tr'
  direction: 'ltr' | 'rtl'
  dateFormat: string
  numberFormat: string
  timezone: string
}

export interface ResolvedBusinessSettings {
  businessId: string
  company: CompanyProfileInput & { name: string }
  financial: FinancialSettingsInput & { baseCurrency: string; fiscalYearStart: string }
  accountingDefaults: AccountingDefaultsInput
  numbering: Record<DocumentType, NumberingConfigItem>
  businessDefaults: BusinessDefaultsInput
  templates: TemplateSettingsInput
  localization: LocalizationSettingsInput
}

const DEFAULT_NUMBERING: Record<DocumentType, NumberingConfigItem> = {
  sales_invoice: { prefix: 'INV', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  purchase_invoice: { prefix: 'PURCH', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  payment: { prefix: 'PAY', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  expense: { prefix: 'EXP', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  journal_entry: { prefix: 'JE', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  inventory_transfer: { prefix: 'TRF', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  inventory_adjustment: { prefix: 'ADJ', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  quotation: { prefix: 'QUO', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  sales_order: { prefix: 'SO', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  delivery_note: { prefix: 'DN', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  purchase_request: { prefix: 'PR', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  purchase_order: { prefix: 'PO', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  goods_receipt: { prefix: 'GRN', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  sales_return: { prefix: 'SR', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  purchase_return: { prefix: 'PRTN', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  credit_note: { prefix: 'CN', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  debit_note: { prefix: 'DN', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  stock_transfer: { prefix: 'TRF', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  stock_adjustment: { prefix: 'ADJ', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  stock_count: { prefix: 'STC', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  stock_reservation: { prefix: 'RES', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  batch: { prefix: 'LOT', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  serial: { prefix: 'SN', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  opportunity: { prefix: 'OPP', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  crm_task: { prefix: 'TSK', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  crm_activity: { prefix: 'ACT', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  payment_promise: { prefix: 'PRM', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  treasury_transfer: { prefix: 'TTR', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  bank_statement: { prefix: 'STM', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  bank_reconciliation: { prefix: 'REC', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
  petty_cash_count: { prefix: 'PCC', format: '{PREFIX}-{YYYY}-{SEQ}', startingNumber: 1, paddingLength: 4, includeYear: true },
}

export class SettingsService {
  /**
   * Retrieve all business settings, merging defaults with stored JSON in Business.taxConfig.
   */
  static async getBusinessSettings(businessId: string): Promise<ResolvedBusinessSettings> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      throw new Error(`Business not found: ${businessId}`)
    }

    const config = (business.taxConfig as Record<string, any>) || {}

    const company: CompanyProfileInput & { name: string } = {
      name: business.name,
      legalName: business.legalName,
      businessType: business.businessType,
      registrationNumber: business.registrationNumber,
      taxNumber: business.taxNumber,
      country: business.country,
      timezone: business.timezone,
      logoUrl: business.logoUrl,
      address: business.address,
      phone: business.phone,
      email: business.email,
      website: business.website,
    }

    const financial: FinancialSettingsInput & { baseCurrency: string; fiscalYearStart: string } = {
      baseCurrency: business.defaultCurrency || 'USD',
      fiscalYearStart: business.fiscalYearStart || '01-01',
      defaultPaymentTerms: config.financial?.defaultPaymentTerms ?? 30,
      decimalPrecision: config.financial?.decimalPrecision ?? 2,
      dateFormat: config.financial?.dateFormat ?? 'YYYY-MM-DD',
      numberFormat: config.financial?.numberFormat ?? 'standard',
    }

    const accountingDefaults: AccountingDefaultsInput = {
      arAccountId: config.accountingDefaults?.arAccountId ?? null,
      apAccountId: config.accountingDefaults?.apAccountId ?? null,
      salesRevenueAccountId: config.accountingDefaults?.salesRevenueAccountId ?? null,
      inventoryAccountId: config.accountingDefaults?.inventoryAccountId ?? null,
      cogsAccountId: config.accountingDefaults?.cogsAccountId ?? null,
      salesTaxAccountId: config.accountingDefaults?.salesTaxAccountId ?? null,
      purchaseTaxAccountId: config.accountingDefaults?.purchaseTaxAccountId ?? null,
      cashAccountId: config.accountingDefaults?.cashAccountId ?? null,
      bankAccountId: config.accountingDefaults?.bankAccountId ?? null,
      retainedEarningsAccountId: config.accountingDefaults?.retainedEarningsAccountId ?? null,
      defaultExpenseAccountId: config.accountingDefaults?.defaultExpenseAccountId ?? null,
    }

    const numbering: Record<DocumentType, NumberingConfigItem> = {
      ...DEFAULT_NUMBERING,
      ...(config.numbering || {}),
    }

    const businessDefaults: BusinessDefaultsInput = {
      defaultWarehouseId: config.businessDefaults?.defaultWarehouseId ?? null,
      defaultTaxId: config.businessDefaults?.defaultTaxId ?? null,
      defaultPaymentAccountId: config.businessDefaults?.defaultPaymentAccountId ?? null,
      defaultPaymentTerms: config.businessDefaults?.defaultPaymentTerms ?? 30,
      defaultLanguage: config.businessDefaults?.defaultLanguage ?? 'en',
    }

    const templates: TemplateSettingsInput = {
      accentColor: config.templates?.accentColor ?? '#4f46e5',
      footerText: config.templates?.footerText ?? 'Thank you for your business!',
      showTaxDetails: config.templates?.showTaxDetails ?? true,
      showBankingDetails: config.templates?.showBankingDetails ?? true,
      bankDetailsText: config.templates?.bankDetailsText ?? '',
      termsAndConditions: config.templates?.termsAndConditions ?? 'Payment is due within payment terms.',
      defaultLanguage: config.templates?.defaultLanguage ?? 'en',
    }

    const localization: LocalizationSettingsInput = {
      defaultLanguage: config.localization?.defaultLanguage ?? (config.businessDefaults?.defaultLanguage || 'en'),
      direction: config.localization?.direction ?? (config.localization?.defaultLanguage === 'ar' ? 'rtl' : 'ltr'),
      dateFormat: config.localization?.dateFormat ?? financial.dateFormat ?? 'YYYY-MM-DD',
      numberFormat: config.localization?.numberFormat ?? financial.numberFormat ?? 'standard',
      timezone: business.timezone || 'UTC',
    }

    return {
      businessId,
      company,
      financial,
      accountingDefaults,
      numbering,
      businessDefaults,
      templates,
      localization,
    }
  }

  /**
   * Update Company Profile.
   */
  static async updateCompanyProfile(businessId: string, data: CompanyProfileInput, userId?: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } })
    if (!existing) throw new Error(`Business not found: ${businessId}`)

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
        ...(data.businessType !== undefined ? { businessType: data.businessType } : {}),
        ...(data.registrationNumber !== undefined ? { registrationNumber: data.registrationNumber } : {}),
        ...(data.taxNumber !== undefined ? { taxNumber: data.taxNumber } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.website !== undefined ? { website: data.website } : {}),
      },
    })

    // Write audit log
    await this.logAudit({
      businessId,
      userId,
      module: 'settings_company_profile',
      oldValues: existing,
      newValues: updated,
      changedFields: Object.keys(data),
    })

    return updated
  }

  /**
   * Update Financial Settings.
   */
  static async updateFinancialSettings(businessId: string, data: FinancialSettingsInput, userId?: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } })
    if (!existing) throw new Error(`Business not found: ${businessId}`)

    const currentConfig = (existing.taxConfig as Record<string, any>) || {}
    const newConfig = {
      ...currentConfig,
      financial: {
        ...(currentConfig.financial || {}),
        ...data,
      },
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(data.baseCurrency ? { defaultCurrency: data.baseCurrency } : {}),
        ...(data.fiscalYearStart ? { fiscalYearStart: data.fiscalYearStart } : {}),
        taxConfig: newConfig,
      },
    })

    await this.logAudit({
      businessId,
      userId,
      module: 'settings_financial',
      oldValues: currentConfig.financial || {},
      newValues: newConfig.financial,
      changedFields: Object.keys(data),
    })

    return updated
  }

  /**
   * Update Default Accounts Mapping.
   * Validates that all provided accounts exist and belong to the active business.
   */
  static async updateAccountingDefaults(businessId: string, data: AccountingDefaultsInput, userId?: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } })
    if (!existing) throw new Error(`Business not found: ${businessId}`)

    // Validate account IDs
    const accountIds = Object.values(data).filter(Boolean) as string[]
    if (accountIds.length > 0) {
      const validAccounts = await prisma.chartOfAccount.findMany({
        where: {
          businessId,
          id: { in: accountIds },
          isActive: true,
        },
        select: { id: true, name: true, code: true, type: true },
      })

      const validIdSet = new Set(validAccounts.map((a) => a.id))
      for (const [key, id] of Object.entries(data)) {
        if (id && !validIdSet.has(id)) {
          throw new Error(`Invalid account specified for ${key}: Account ${id} does not exist or does not belong to business ${businessId}`)
        }
      }
    }

    const currentConfig = (existing.taxConfig as Record<string, any>) || {}
    const newConfig = {
      ...currentConfig,
      accountingDefaults: {
        ...(currentConfig.accountingDefaults || {}),
        ...data,
      },
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { taxConfig: newConfig },
    })

    await this.logAudit({
      businessId,
      userId,
      module: 'settings_accounting_defaults',
      oldValues: currentConfig.accountingDefaults || {},
      newValues: newConfig.accountingDefaults,
      changedFields: Object.keys(data),
    })

    return updated
  }

  /**
   * Update Document Numbering Configuration.
   */
  static async updateNumberingConfig(businessId: string, docType: DocumentType, config: NumberingConfigItem, userId?: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } })
    if (!existing) throw new Error(`Business not found: ${businessId}`)

    const currentConfig = (existing.taxConfig as Record<string, any>) || {}
    const numbering = { ...(currentConfig.numbering || {}) }
    numbering[docType] = config

    const newConfig = {
      ...currentConfig,
      numbering,
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { taxConfig: newConfig },
    })

    await this.logAudit({
      businessId,
      userId,
      module: 'settings_document_numbering',
      oldValues: currentConfig.numbering?.[docType] || {},
      newValues: config,
      changedFields: [docType],
    })

    return updated
  }

  /**
   * Update Business Defaults.
   */
  static async updateBusinessDefaults(businessId: string, data: BusinessDefaultsInput, userId?: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } })
    if (!existing) throw new Error(`Business not found: ${businessId}`)

    const currentConfig = (existing.taxConfig as Record<string, any>) || {}
    const newConfig = {
      ...currentConfig,
      businessDefaults: {
        ...(currentConfig.businessDefaults || {}),
        ...data,
      },
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { taxConfig: newConfig },
    })

    await this.logAudit({
      businessId,
      userId,
      module: 'settings_business_defaults',
      oldValues: currentConfig.businessDefaults || {},
      newValues: newConfig.businessDefaults,
      changedFields: Object.keys(data),
    })

    return updated
  }

  /**
   * Update Template Settings.
   */
  static async updateTemplateSettings(businessId: string, data: TemplateSettingsInput, userId?: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } })
    if (!existing) throw new Error(`Business not found: ${businessId}`)

    const currentConfig = (existing.taxConfig as Record<string, any>) || {}
    const newConfig = {
      ...currentConfig,
      templates: {
        ...(currentConfig.templates || {}),
        ...data,
      },
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { taxConfig: newConfig },
    })

    await this.logAudit({
      businessId,
      userId,
      module: 'settings_templates',
      oldValues: currentConfig.templates || {},
      newValues: newConfig.templates,
      changedFields: Object.keys(data),
    })

    return updated
  }

  /**
   * Update Localization Settings.
   */
  static async updateLocalizationSettings(businessId: string, data: LocalizationSettingsInput, userId?: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } })
    if (!existing) throw new Error(`Business not found: ${businessId}`)

    const currentConfig = (existing.taxConfig as Record<string, any>) || {}
    const newConfig = {
      ...currentConfig,
      localization: {
        ...(currentConfig.localization || {}),
        ...data,
      },
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        timezone: data.timezone || existing.timezone,
        taxConfig: newConfig,
      },
    })

    await this.logAudit({
      businessId,
      userId,
      module: 'settings_localization',
      oldValues: currentConfig.localization || {},
      newValues: newConfig.localization,
      changedFields: Object.keys(data),
    })

    return updated
  }

  /**
   * Permission authorization check for business settings.
   */
  static checkPermission(role: string, section: 'all' | 'financial' | 'accounting' | 'tax' | 'general'): boolean {
    const r = role.toLowerCase()
    if (r === 'owner' || r === 'administrator') return true
    if (r === 'accountant') {
      return ['financial', 'accounting', 'tax', 'general'].includes(section)
    }
    // Sales, purchase, inventory users and viewers cannot modify configuration
    return false
  }

  /**
   * Internal audit logger.
   */
  private static async logAudit(params: {
    businessId: string
    userId?: string
    module: string
    oldValues: any
    newValues: any
    changedFields: string[]
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          businessId: params.businessId,
          userId: params.userId || null,
          action: 'update',
          module: params.module,
          oldValues: params.oldValues,
          newValues: params.newValues,
          changedFields: params.changedFields,
          createdAt: new Date(),
        },
      })
    } catch {
      // Audit log failures should not block transactions
    }
  }
}
