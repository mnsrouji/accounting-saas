'use server'

// =============================================================
// Super Admin Server Actions — Platform-level Privilege Management
// =============================================================

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { createAuditLog } from '@/lib/audit/create-audit-log'

// ─────────────────────────────────────────────────────────────
// List all super admins
// ─────────────────────────────────────────────────────────────

export async function listSuperAdminsAction() {
  try {
    await requireSuperAdmin()

    const superAdmins = await prisma.user.findMany({
      where: { isSuperAdmin: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        status: true,
        isSuperAdmin: true,
        superAdminNote: true,
        createdAt: true,
        _count: { select: { businessMemberships: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return { success: true as const, data: superAdmins }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to list super admins' }
  }
}

// ─────────────────────────────────────────────────────────────
// Search users (to grant super admin)
// ─────────────────────────────────────────────────────────────

export async function searchUsersForSuperAdminAction(query: string) {
  try {
    await requireSuperAdmin()

    if (!query || query.trim().length < 2) {
      return { success: true as const, data: [] }
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        status: true,
        isSuperAdmin: true,
        superAdminNote: true,
        createdAt: true,
        _count: { select: { businessMemberships: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    })

    return { success: true as const, data: users }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Search failed' }
  }
}

// ─────────────────────────────────────────────────────────────
// Grant super admin
// ─────────────────────────────────────────────────────────────

export async function grantSuperAdminAction(targetUserId: string, note?: string) {
  try {
    const actor = await requireSuperAdmin()

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, fullName: true, isSuperAdmin: true },
    })

    if (!target) return { success: false as const, error: 'User not found' }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isSuperAdmin: true,
        superAdminNote: note?.trim() || null,
      },
    })

    await createAuditLog({
      userId: actor.id,
      action: 'permission_change',
      module: 'super_admin',
      recordType: 'user',
      recordId: targetUserId,
      newValues: { isSuperAdmin: true, note, grantedTo: target.email },
    })

    revalidatePath('/admin/super-admins')
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to grant super admin' }
  }
}

// ─────────────────────────────────────────────────────────────
// Revoke super admin
// ─────────────────────────────────────────────────────────────

export async function revokeSuperAdminAction(targetUserId: string) {
  try {
    const actor = await requireSuperAdmin()

    if (actor.id === targetUserId) {
      return { success: false as const, error: 'You cannot revoke your own Super Admin privileges.' }
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, fullName: true },
    })

    if (!target) return { success: false as const, error: 'User not found' }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { isSuperAdmin: false, superAdminNote: null },
    })

    await createAuditLog({
      userId: actor.id,
      action: 'permission_change',
      module: 'super_admin',
      recordType: 'user',
      recordId: targetUserId,
      newValues: { isSuperAdmin: false, revokedFrom: target.email },
    })

    revalidatePath('/admin/super-admins')
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to revoke super admin' }
  }
}

// ─────────────────────────────────────────────────────────────
// Get all businesses (super admin view)
// ─────────────────────────────────────────────────────────────

export async function getAllBusinessesAsSuperAdminAction(params?: {
  search?: string
  limit?: number
  offset?: number
}) {
  try {
    await requireSuperAdmin()

    const where = params?.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' as const } },
            { legalName: { contains: params.search, mode: 'insensitive' as const } },
            { email: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        select: {
          id: true,
          name: true,
          legalName: true,
          email: true,
          status: true,
          defaultCurrency: true,
          country: true,
          createdAt: true,
          _count: { select: { members: true, customers: true, sales: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: params?.limit ?? 50,
        skip: params?.offset ?? 0,
      }),
      prisma.business.count({ where }),
    ])

    return { success: true as const, data: { businesses, total } }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch businesses' }
  }
}

// ─────────────────────────────────────────────────────────────
// Get all users (super admin view)
// ─────────────────────────────────────────────────────────────

export async function getAllUsersAsSuperAdminAction(params?: {
  search?: string
  limit?: number
  offset?: number
}) {
  try {
    await requireSuperAdmin()

    const where = params?.search
      ? {
          OR: [
            { email: { contains: params.search, mode: 'insensitive' as const } },
            { fullName: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          status: true,
          isSuperAdmin: true,
          superAdminNote: true,
          createdAt: true,
          _count: { select: { businessMemberships: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: params?.limit ?? 50,
        skip: params?.offset ?? 0,
      }),
      prisma.user.count({ where }),
    ])

    return { success: true as const, data: { users, total } }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch users' }
  }
}

// ─────────────────────────────────────────────────────────────
// Suspend / activate a user account (super admin power)
// ─────────────────────────────────────────────────────────────

export async function superAdminUpdateUserStatusAction(
  targetUserId: string,
  status: 'active' | 'inactive' | 'suspended',
  reason?: string
) {
  try {
    const actor = await requireSuperAdmin()

    if (actor.id === targetUserId) {
      return { success: false as const, error: 'You cannot change your own account status.' }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { status },
    })

    await createAuditLog({
      userId: actor.id,
      action: 'update',
      module: 'super_admin',
      recordType: 'user',
      recordId: targetUserId,
      newValues: { status, reason },
    })

    revalidatePath('/admin/super-admins')
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update user status' }
  }
}

// ─────────────────────────────────────────────────────────────
// Permanently delete a user (super admin only)
// ─────────────────────────────────────────────────────────────

export async function superAdminDeleteUserAction(targetUserId: string) {
  try {
    const actor = await requireSuperAdmin()

    if (actor.id === targetUserId) {
      return { success: false as const, error: 'You cannot delete your own account.' }
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true, fullName: true },
    })
    if (!target) return { success: false as const, error: 'User not found.' }

    // Remove memberships first, then user
    await prisma.businessUser.deleteMany({ where: { userId: targetUserId } })
    await prisma.notification.deleteMany({ where: { userId: targetUserId } })
    await prisma.user.delete({ where: { id: targetUserId } })

    await createAuditLog({
      userId: actor.id,
      action: 'delete',
      module: 'super_admin',
      recordType: 'user',
      recordId: targetUserId,
      newValues: { deleted: target.email },
    })

    revalidatePath('/admin/super-admins')
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to delete user' }
  }
}

// ─────────────────────────────────────────────────────────────
// Update business status (super admin power)
// ─────────────────────────────────────────────────────────────

export async function superAdminUpdateBusinessStatusAction(
  businessId: string,
  status: 'active' | 'suspended' | 'closed',
  reason?: string
) {
  try {
    const actor = await requireSuperAdmin()

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { status },
    })

    await createAuditLog({
      userId: actor.id,
      action: 'update',
      module: 'super_admin',
      recordType: 'business',
      recordId: businessId,
      newValues: { status, reason },
    })

    revalidatePath('/admin/super-admins')
    revalidatePath('/admin/tenants')
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update business status' }
  }
}

// ─────────────────────────────────────────────────────────────
// Permanently delete a business and all its data (super admin only)
// ─────────────────────────────────────────────────────────────

export async function superAdminDeleteBusinessAction(businessId: string) {
  try {
    const actor = await requireSuperAdmin()

    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    })
    if (!biz) return { success: false as const, error: 'Business not found.' }

    // Use raw SQL with FK triggers disabled for safe cascade deletion
    await prisma.$executeRawUnsafe(`SET session_replication_role = replica`)
    try {
      const tables = [
        `DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE business_id = '${businessId}')`,
        `DELETE FROM journal_entries WHERE business_id = '${businessId}'`,
        `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE business_id = '${businessId}')`,
        `DELETE FROM sales WHERE business_id = '${businessId}'`,
        `DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id = '${businessId}')`,
        `DELETE FROM purchases WHERE business_id = '${businessId}'`,
        `DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE business_id = '${businessId}')`,
        `DELETE FROM payments WHERE business_id = '${businessId}'`,
        `DELETE FROM treasury_transfers WHERE business_id = '${businessId}'`,
        `DELETE FROM treasury_transactions WHERE business_id = '${businessId}'`,
        `DELETE FROM reconciliation_adjustments WHERE reconciliation_id IN (SELECT id FROM bank_reconciliations WHERE business_id = '${businessId}')`,
        `DELETE FROM reconciliation_matches WHERE reconciliation_id IN (SELECT id FROM bank_reconciliations WHERE business_id = '${businessId}')`,
        `DELETE FROM bank_reconciliations WHERE business_id = '${businessId}'`,
        `DELETE FROM bank_statement_lines WHERE statement_id IN (SELECT id FROM bank_statements WHERE business_id = '${businessId}')`,
        `DELETE FROM bank_statements WHERE business_id = '${businessId}'`,
        `DELETE FROM bank_accounts WHERE business_id = '${businessId}'`,
        `DELETE FROM petty_cash_counts WHERE cash_account_id IN (SELECT id FROM cash_accounts WHERE business_id = '${businessId}')`,
        `DELETE FROM cash_accounts WHERE business_id = '${businessId}'`,
        `DELETE FROM stock_reservations WHERE business_id = '${businessId}'`,
        `DELETE FROM inventory_movements WHERE business_id = '${businessId}'`,
        `DELETE FROM expenses WHERE business_id = '${businessId}'`,
        `DELETE FROM payment_promises WHERE business_id = '${businessId}'`,
        `DELETE FROM credit_overrides WHERE business_id = '${businessId}'`,
        `DELETE FROM crm_activities WHERE business_id = '${businessId}'`,
        `DELETE FROM crm_tasks WHERE business_id = '${businessId}'`,
        `DELETE FROM sales_opportunities WHERE business_id = '${businessId}'`,
        `DELETE FROM customers WHERE business_id = '${businessId}'`,
        `DELETE FROM suppliers WHERE business_id = '${businessId}'`,
        `DELETE FROM products WHERE business_id = '${businessId}'`,
        `DELETE FROM warehouses WHERE business_id = '${businessId}'`,
        `DELETE FROM sales_orders WHERE business_id = '${businessId}'`,
        `DELETE FROM purchase_orders WHERE business_id = '${businessId}'`,
        `DELETE FROM chart_of_accounts WHERE business_id = '${businessId}'`,
        `DELETE FROM tax_rates WHERE business_id = '${businessId}'`,
        `DELETE FROM audit_logs WHERE business_id = '${businessId}'`,
        `DELETE FROM notifications WHERE business_id = '${businessId}'`,
        `DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE business_id = '${businessId}')`,
        `DELETE FROM roles WHERE business_id = '${businessId}'`,
        `DELETE FROM business_users WHERE business_id = '${businessId}'`,
        `DELETE FROM subscriptions WHERE business_id = '${businessId}'`,
        `DELETE FROM businesses WHERE id = '${businessId}'`,
      ]
      for (const sql of tables) {
        try { await prisma.$executeRawUnsafe(sql) } catch { /* skip */ }
      }
    } finally {
      await prisma.$executeRawUnsafe(`SET session_replication_role = DEFAULT`)
    }

    await createAuditLog({
      userId: actor.id,
      action: 'delete',
      module: 'super_admin',
      recordType: 'business',
      recordId: businessId,
      newValues: { deleted: biz.name },
    })

    revalidatePath('/admin/super-admins')
    revalidatePath('/admin/tenants')
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to delete business' }
  }
}

