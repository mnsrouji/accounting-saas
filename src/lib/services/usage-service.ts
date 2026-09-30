// =============================================================
// Usage Service — Tenant Quotas, Resource Tracking & Limit Enforcement
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { SubscriptionService } from './subscription-service'
import { AccessDeniedError } from '@/lib/auth/require-auth'

export interface UsageMetric {
  key: string
  label: string
  current: number
  limit: number | null // null = unlimited
  percent: number
  isWarning: boolean // >= 80%
  isExceeded: boolean // >= 100%
  remaining: number | null
}

export interface TenantUsageSummary {
  businessId: string
  planName: string
  planCode: string
  metrics: {
    users: UsageMetric
    warehouses: UsageMetric
    monthlyInvoices: UsageMetric
    products: UsageMetric
    customers: UsageMetric
    suppliers: UsageMetric
    journalEntries: UsageMetric
    storageMb: UsageMetric
  }
  hasWarnings: boolean
  hasExceeded: boolean
}

export class UsageService {
  /**
   * Get the full usage summary for a business comparing live counts to plan limits.
   */
  static async getTenantUsageSummary(businessId: string): Promise<TenantUsageSummary> {
    const subscription = await SubscriptionService.getSubscription(businessId)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      usersCount,
      warehousesCount,
      monthlyInvoicesCount,
      productsCount,
      customersCount,
      suppliersCount,
      journalEntriesCount,
      attachmentsCount,
    ] = await Promise.all([
      prisma.businessUser.count({ where: { businessId, status: 'active' } }),
      prisma.warehouse.count({ where: { businessId, isActive: true } }),
      prisma.sale.count({
        where: {
          businessId,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.product.count({ where: { businessId, isActive: true } }),
      prisma.customer.count({ where: { businessId, isActive: true } }),
      prisma.supplier.count({ where: { businessId, isActive: true } }),
      prisma.journalEntry.count({ where: { businessId } }),
      prisma.attachment.count({ where: { businessId } }),
    ])

    const plan = subscription.plan

    // Define limits based on plan
    const maxUsers = plan.maxUsers
    const maxWarehouses = plan.code === 'enterprise' ? null : plan.code === 'professional' ? 10 : 3
    const maxInvoices = plan.maxInvoicesPerMonth
    const maxProducts = plan.code === 'enterprise' ? null : plan.code === 'professional' ? 5000 : 500
    const maxStorageMb = plan.code === 'enterprise' ? 10000 : plan.code === 'professional' ? 2000 : 500

    // Approximate storage: 0.5MB per attachment + 0.05MB base database records
    const estimatedStorageMb = Math.round((attachmentsCount * 0.5 + (productsCount + monthlyInvoicesCount) * 0.01) * 10) / 10

    function buildMetric(key: string, label: string, current: number, limit: number | null): UsageMetric {
      if (limit === null || limit <= 0) {
        return {
          key,
          label,
          current,
          limit: null,
          percent: 0,
          isWarning: false,
          isExceeded: false,
          remaining: null,
        }
      }

      const percent = Math.min(100, Math.round((current / limit) * 100))
      const isWarning = percent >= 80 && percent < 100
      const isExceeded = current >= limit
      const remaining = Math.max(0, limit - current)

      return {
        key,
        label,
        current,
        limit,
        percent,
        isWarning,
        isExceeded,
        remaining,
      }
    }

    const metrics = {
      users: buildMetric('users', 'Team Members', usersCount, maxUsers),
      warehouses: buildMetric('warehouses', 'Warehouses', warehousesCount, maxWarehouses),
      monthlyInvoices: buildMetric('monthlyInvoices', 'Monthly Sales Invoices', monthlyInvoicesCount, maxInvoices),
      products: buildMetric('products', 'Active Products', productsCount, maxProducts),
      customers: buildMetric('customers', 'Active Customers', customersCount, null),
      suppliers: buildMetric('suppliers', 'Active Suppliers', suppliersCount, null),
      journalEntries: buildMetric('journalEntries', 'Journal Entries', journalEntriesCount, null),
      storageMb: buildMetric('storageMb', 'Storage (MB)', estimatedStorageMb, maxStorageMb),
    }

    const hasWarnings = Object.values(metrics).some((m) => m.isWarning)
    const hasExceeded = Object.values(metrics).some((m) => m.isExceeded)

    return {
      businessId,
      planName: plan.name,
      planCode: plan.code,
      metrics,
      hasWarnings,
      hasExceeded,
    }
  }

  /**
   * Check if a business can add another active team user.
   */
  static async canAddUser(businessId: string): Promise<boolean> {
    const summary = await this.getTenantUsageSummary(businessId)
    return !summary.metrics.users.isExceeded
  }

  /**
   * Check if a business can create another sales invoice in the current month.
   */
  static async canCreateInvoice(businessId: string): Promise<boolean> {
    const summary = await this.getTenantUsageSummary(businessId)
    return !summary.metrics.monthlyInvoices.isExceeded
  }

  /**
   * Assert quota check before executing a resource creation.
   * Throws AccessDeniedError if the hard limit is exceeded.
   */
  static async assertQuota(
    businessId: string,
    metricKey: 'users' | 'warehouses' | 'monthlyInvoices' | 'products'
  ) {
    const summary = await this.getTenantUsageSummary(businessId)
    const metric = summary.metrics[metricKey]

    if (metric && metric.isExceeded) {
      throw new AccessDeniedError(
        `Plan quota exceeded for ${metric.label} (${metric.current} / ${metric.limit}). Please upgrade your plan to increase limits.`
      )
    }
  }
}
