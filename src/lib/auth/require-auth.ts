import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { PermissionLevel } from '@/lib/services/rbac-service'
import { prisma } from '@/lib/db/prisma'

/**
 * Get the currently authenticated user from the server.
 * Returns null if not authenticated (does not redirect).
 */
export async function getUser() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

/**
 * Require authentication — redirects to login if not authenticated.
 * Use in Server Components and Server Actions that require a user.
 */
export async function requireUser() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

/**
 * Require the user to be a member of a specific business.
 * Validates the business membership and permission level.
 *
 * @param businessId - The business UUID to validate access for
 * @param module - The module being accessed (for permission check)
 * @param requiredLevel - Minimum permission level required ('read' | 'write' | 'delete' | 'full')
 */
export async function requireBusinessAccess(
  businessId: string,
  module?: string,
  requiredLevel: PermissionLevel = 'read'
) {
  const user = await requireUser()

  // Super Admin bypass — absolute access to all businesses
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isSuperAdmin: true } })
  if (dbUser?.isSuperAdmin) {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    return {
      userId: user.id,
      businessId,
      role: 'owner' as const,
      membership: null as any,
      business: business!,
      isSuperAdmin: true,
    }
  }

  const membership = await prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId: user.id,
        businessId,
      },
    },
    include: {
      business: true,
      roleModel: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  if (!membership || membership.status !== 'active') {
    throw new AccessDeniedError('You do not have access to this business.')
  }

  // Check module-level permissions when a module is requested
  if (module) {
    const { RBACService } = await import('@/lib/services/rbac-service')
    const hasAccess = RBACService.hasModuleAccess(
      membership.role,
      module,
      requiredLevel,
      membership
    )
    if (!hasAccess) {
      throw new AccessDeniedError(
        `Insufficient permissions: Role '${membership.role}' cannot perform '${requiredLevel}' operations on module '${module}'.`
      )
    }
  }

  return {
    userId: user.id,
    businessId,
    role: membership.role,
    membership,
    business: membership.business,
    isSuperAdmin: false,
  }
}

/**
 * Require a specific permission code for a business.
 */
export async function requirePermission(
  businessId: string,
  permissionCode: string
) {
  const user = await requireUser()
  const { RBACService } = await import('@/lib/services/rbac-service')

  // Super Admin bypass — has every permission
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isSuperAdmin: true } })
  if (dbUser?.isSuperAdmin) {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    return { userId: user.id, businessId, role: 'owner' as const, membership: null as any, business: business!, isSuperAdmin: true }
  }

  const membership = await prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId: user.id,
        businessId,
      },
    },
    include: {
      business: true,
      roleModel: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  if (!membership || membership.status !== 'active') {
    throw new AccessDeniedError('You do not have access to this business.')
  }

  const allowed = RBACService.hasPermission(membership, permissionCode)
  if (!allowed) {
    throw new AccessDeniedError(
      `Permission denied: Missing required permission '${permissionCode}'.`
    )
  }

  return {
    userId: user.id,
    businessId,
    role: membership.role,
    membership,
    business: membership.business,
    isSuperAdmin: false,
  }
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

export class ValidationError extends Error {
  public readonly field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Platform Admin emails whitelist / configuration.
 * Only explicit emails defined in PLATFORM_ADMIN_EMAILS env var are permitted.
 * No domain suffix or demo bypass is allowed.
 */
export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false
  const adminEmailsEnv = process.env.PLATFORM_ADMIN_EMAILS || ''
  if (!adminEmailsEnv.trim()) return false
  const allowed = adminEmailsEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}

/**
 * Check if the current user is a Super Admin (from DB flag).
 * Super Admins have absolute authority over all businesses and users.
 */
export async function isSuperAdminUser(): Promise<boolean> {
  const user = await getUser()
  if (!user) return false
  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: { equals: user.email ?? '', mode: 'insensitive' } },
      ],
    },
    select: { isSuperAdmin: true },
  })
  return dbUser?.isSuperAdmin === true
}

/**
 * Require Super Admin access — throws if not a super admin.
 */
export async function requireSuperAdmin() {
  const user = await requireUser()
  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: { equals: user.email ?? '', mode: 'insensitive' } },
      ],
    },
    select: { isSuperAdmin: true, fullName: true, email: true },
  })
  if (!dbUser?.isSuperAdmin) {
    throw new AccessDeniedError('Super Admin access required.')
  }
  return { ...user, fullName: dbUser.fullName, dbEmail: dbUser.email }
}

/**
 * Require platform administrator access — rejects tenant users.
 * Super Admins automatically pass this check.
 */
export async function requirePlatformAdmin() {
  const user = await requireUser()
  // Super admins bypass email whitelist — lookup by ID OR email as fallback
  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: { equals: user.email ?? '', mode: 'insensitive' } },
      ],
    },
    select: { isSuperAdmin: true },
  })
  if (dbUser?.isSuperAdmin) return user
  if (!isPlatformAdmin(user.email)) {
    throw new AccessDeniedError('Platform administrator access required.')
  }
  return user
}
