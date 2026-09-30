// =============================================================
// Plan Service — Subscription Plans & SaaS Tiers
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface PlanFeatureConfig {
  crm?: boolean
  advanced_crm?: boolean
  treasury?: boolean
  bank_reconciliation?: boolean
  advanced_inventory?: boolean
  multi_currency?: boolean
  financial_reports?: boolean
  api_access?: boolean
  custom_numbering?: boolean
  exports?: boolean
  priority_support?: boolean
}

export interface DefaultPlanDefinition {
  name: string
  code: string
  description: string
  price: number
  currency: string
  billingInterval: 'month' | 'year'
  maxUsers: number
  maxBusinesses: number
  maxInvoicesPerMonth: number
  features: PlanFeatureConfig
}

export const DEFAULT_PLANS: DefaultPlanDefinition[] = [
  {
    name: 'Free Trial',
    code: 'trial',
    description: '14-day free trial with full access to test AccountFlow ERP.',
    price: 0,
    currency: 'USD',
    billingInterval: 'month',
    maxUsers: 5,
    maxBusinesses: 1,
    maxInvoicesPerMonth: 100,
    features: {
      crm: true,
      advanced_crm: true,
      treasury: true,
      bank_reconciliation: true,
      advanced_inventory: true,
      multi_currency: true,
      financial_reports: true,
      api_access: false,
      custom_numbering: true,
      exports: true,
      priority_support: false,
    },
  },
  {
    name: 'Starter',
    code: 'starter',
    description: 'Essential double-entry bookkeeping, invoicing, and inventory for growing small businesses.',
    price: 29,
    currency: 'USD',
    billingInterval: 'month',
    maxUsers: 3,
    maxBusinesses: 1,
    maxInvoicesPerMonth: 300,
    features: {
      crm: true,
      advanced_crm: false,
      treasury: false,
      bank_reconciliation: false,
      advanced_inventory: false,
      multi_currency: false,
      financial_reports: true,
      api_access: false,
      custom_numbering: true,
      exports: true,
      priority_support: false,
    },
  },
  {
    name: 'Professional',
    code: 'professional',
    description: 'Complete ERP suite with advanced CRM, treasury, multi-currency, and bank reconciliation.',
    price: 89,
    currency: 'USD',
    billingInterval: 'month',
    maxUsers: 15,
    maxBusinesses: 3,
    maxInvoicesPerMonth: 2500,
    features: {
      crm: true,
      advanced_crm: true,
      treasury: true,
      bank_reconciliation: true,
      advanced_inventory: true,
      multi_currency: true,
      financial_reports: true,
      api_access: true,
      custom_numbering: true,
      exports: true,
      priority_support: true,
    },
  },
  {
    name: 'Enterprise',
    code: 'enterprise',
    description: 'Unlimited capacity, advanced security, custom numbering, and high-volume operations.',
    price: 249,
    currency: 'USD',
    billingInterval: 'month',
    maxUsers: 100,
    maxBusinesses: 10,
    maxInvoicesPerMonth: 25000,
    features: {
      crm: true,
      advanced_crm: true,
      treasury: true,
      bank_reconciliation: true,
      advanced_inventory: true,
      multi_currency: true,
      financial_reports: true,
      api_access: true,
      custom_numbering: true,
      exports: true,
      priority_support: true,
    },
  },
]

export class PlanService {
  /**
   * Seed or ensure default plans exist in the database.
   */
  static async seedDefaultPlans() {
    const createdPlans = []
    for (const planDef of DEFAULT_PLANS) {
      const existing = await prisma.subscriptionPlan.findUnique({
        where: { code: planDef.code },
      })
      if (!existing) {
        const created = await prisma.subscriptionPlan.create({
          data: {
            name: planDef.name,
            code: planDef.code,
            description: planDef.description,
            price: new Prisma.Decimal(planDef.price),
            currency: planDef.currency,
            billingInterval: planDef.billingInterval,
            maxUsers: planDef.maxUsers,
            maxBusinesses: planDef.maxBusinesses,
            maxInvoicesPerMonth: planDef.maxInvoicesPerMonth,
            features: planDef.features as any,
            isActive: true,
          },
        })
        createdPlans.push(created)
      } else {
        const updated = await prisma.subscriptionPlan.update({
          where: { id: existing.id },
          data: {
            name: planDef.name,
            description: planDef.description,
            price: new Prisma.Decimal(planDef.price),
            currency: planDef.currency,
            billingInterval: planDef.billingInterval,
            maxUsers: planDef.maxUsers,
            maxBusinesses: planDef.maxBusinesses,
            maxInvoicesPerMonth: planDef.maxInvoicesPerMonth,
            features: planDef.features as any,
            isActive: true,
          },
        })
        createdPlans.push(updated)
      }
    }
    return createdPlans
  }


  /**
   * List all available plans.
   */
  static async getPlans(includeInactive = false) {
    await this.seedDefaultPlans()
    return prisma.subscriptionPlan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { price: 'asc' },
    })
  }

  /**
   * Get a plan by code (starter, professional, enterprise, trial).
   */
  static async getPlanByCode(code: string) {
    let plan = await prisma.subscriptionPlan.findUnique({
      where: { code },
    })
    if (!plan) {
      await this.seedDefaultPlans()
      plan = await prisma.subscriptionPlan.findUnique({
        where: { code },
      })
    }
    return plan
  }

  /**
   * Get a plan by ID.
   */
  static async getPlanById(id: string) {
    return prisma.subscriptionPlan.findUnique({
      where: { id },
    })
  }

  /**
   * Upsert or update a subscription plan (Platform Admin).
   */
  static async upsertPlan(data: {
    id?: string
    name: string
    code: string
    description?: string
    price: number
    currency?: string
    billingInterval?: string
    maxUsers: number
    maxBusinesses?: number
    maxInvoicesPerMonth: number
    features: PlanFeatureConfig
    isActive?: boolean
  }) {
    const payload = {
      name: data.name,
      code: data.code,
      description: data.description,
      price: new Prisma.Decimal(data.price),
      currency: data.currency || 'USD',
      billingInterval: data.billingInterval || 'month',
      maxUsers: data.maxUsers,
      maxBusinesses: data.maxBusinesses || 1,
      maxInvoicesPerMonth: data.maxInvoicesPerMonth,
      features: data.features as any,
      isActive: data.isActive !== undefined ? data.isActive : true,
    }

    if (data.id) {
      return prisma.subscriptionPlan.update({
        where: { id: data.id },
        data: payload,
      })
    }

    return prisma.subscriptionPlan.upsert({
      where: { code: data.code },
      create: payload,
      update: payload,
    })
  }
}
