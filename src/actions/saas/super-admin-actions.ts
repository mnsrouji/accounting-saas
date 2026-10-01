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
