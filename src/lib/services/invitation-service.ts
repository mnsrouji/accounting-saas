// =============================================================
// Invitation Service — User Invitations & Team Memberships
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { MemberRole, MemberStatus } from '@prisma/client'
import { UsageService } from './usage-service'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { AccessDeniedError, ValidationError } from '@/lib/auth/require-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export interface InviteUserParams {
  businessId: string
  email: string
  fullName?: string
  role: MemberRole
  invitedById: string
}

export interface CreateDirectUserParams {
  businessId: string
  email: string
  fullName: string
  password?: string
  phone?: string
  role: MemberRole
  roleId?: string | null
  customPermissions?: string[]
  adminUserId?: string
}

export class InvitationService {
  /**
   * Invite a user to join a business.
   */
  static async inviteUser(params: InviteUserParams) {
    const { businessId, email, fullName, role, invitedById } = params

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Check user quota limits
    await UsageService.assertQuota(businessId, 'users')

    // 2. Find or create the user record
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: fullName || normalizedEmail.split('@')[0],
          status: 'active',
        },
      })
    }

    // 3. Check if membership already exists
    const existingMembership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: user.id,
          businessId,
        },
      },
    })

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        throw new ValidationError(`User with email "${normalizedEmail}" is already an active member of this business.`)
      }

      // Re-send / update invitation status
      const updated = await prisma.businessUser.update({
        where: { id: existingMembership.id },
        data: {
          role,
          status: 'invited',
          invitedBy: invitedById,
          invitedAt: new Date(),
        },
        include: { user: true },
      })

      await createAuditLog({
        businessId,
        userId: invitedById,
        action: 'create',
        module: 'members',
        recordType: 'business_user',
        recordId: updated.id,
        newValues: { email: normalizedEmail, role, action: 'reinvited' },
      })

      return updated
    }

    // 4. Create new membership with 'invited' status
    const membership = await prisma.businessUser.create({
      data: {
        businessId,
        userId: user.id,
        role,
        status: 'invited',
        invitedBy: invitedById,
        invitedAt: new Date(),
      },
      include: { user: true },
    })

    await createAuditLog({
      businessId,
      userId: invitedById,
      action: 'create',
      module: 'members',
      recordType: 'business_user',
      recordId: membership.id,
      newValues: { email: normalizedEmail, role },
    })


    return membership
  }

  /**
   * List all business members (active, invited, inactive).
   */
  static async getMembers(businessId: string) {
    return prisma.businessUser.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        roleModel: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })
  }

  /**
   * Accept an invitation for a user.
   */
  static async acceptInvitation(businessId: string, userId: string) {
    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId,
          businessId,
        },
      },
    })

    if (!membership) {
      throw new ValidationError('Invitation not found.')
    }

    if (membership.status === 'active') {
      return membership
    }

    const updated = await prisma.businessUser.update({
      where: { id: membership.id },
      data: {
        status: 'active',
        joinedAt: new Date(),
      },
      include: { user: true },
    })

    await createAuditLog({
      businessId,
      userId,
      action: 'update',
      module: 'members',
      recordType: 'business_user',
      recordId: updated.id,
      newValues: { status: 'active', action: 'accepted_invitation' },
    })

    return updated
  }

  /**
   * Cancel or delete a pending invitation.
   */
  static async cancelInvitation(businessId: string, membershipId: string, adminUserId?: string) {
    const membership = await prisma.businessUser.findFirst({
      where: { id: membershipId, businessId, status: 'invited' },
    })

    if (!membership) {
      throw new ValidationError('Pending invitation not found.')
    }

    await prisma.businessUser.delete({
      where: { id: membershipId },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'cancel',
      module: 'members',
      recordType: 'business_user',
      recordId: membershipId,
      oldValues: { status: 'invited', userId: membership.userId },
    })

    return { success: true }
  }

  /**
   * Update a member's role.
   */
  static async updateMemberRole(
    businessId: string,
    targetUserId: string,
    newRole: MemberRole,
    adminUserId?: string
  ) {
    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: targetUserId,
          businessId,
        },
      },
    })

    if (!membership) {
      throw new ValidationError('Member not found in this business.')
    }

    // Safety: check that we don't demote the last owner
    if (membership.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await prisma.businessUser.count({
        where: { businessId, role: 'owner', status: 'active' },
      })
      if (ownerCount <= 1) {
        throw new AccessDeniedError('Cannot change the role of the only active business owner.')
      }
    }

    const updated = await prisma.businessUser.update({
      where: { id: membership.id },
      data: { role: newRole },
      include: { user: true },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'update',
      module: 'members',
      recordType: 'business_user',
      recordId: updated.id,
      oldValues: { role: membership.role },
      newValues: { role: newRole },
    })

    return updated
  }

  /**
   * Deactivate or Reactivate member access.
   */
  static async updateMemberStatus(
    businessId: string,
    targetUserId: string,
    newStatus: MemberStatus,
    adminUserId?: string
  ) {
    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: targetUserId,
          businessId,
        },
      },
    })

    if (!membership) {
      throw new ValidationError('Member not found.')
    }

    if (membership.role === 'owner' && newStatus !== 'active') {
      const ownerCount = await prisma.businessUser.count({
        where: { businessId, role: 'owner', status: 'active' },
      })
      if (ownerCount <= 1) {
        throw new AccessDeniedError('Cannot deactivate the sole business owner.')
      }
    }

    const updated = await prisma.businessUser.update({
      where: { id: membership.id },
      data: { status: newStatus },
      include: { user: true },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'update',
      module: 'members',
      recordType: 'business_user',
      recordId: updated.id,
      oldValues: { status: membership.status },
      newValues: { status: newStatus },
    })

    return updated
  }

  /**
   * Remove a user from the business.
   */
  static async removeMember(businessId: string, targetUserId: string, adminUserId?: string) {
    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: targetUserId,
          businessId,
        },
      },
    })

    if (!membership) {
      throw new ValidationError('Member not found.')
    }

    if (membership.role === 'owner') {
      const ownerCount = await prisma.businessUser.count({
        where: { businessId, role: 'owner', status: 'active' },
      })
      if (ownerCount <= 1) {
        throw new AccessDeniedError('Cannot remove the sole business owner.')
      }
    }

    await prisma.businessUser.delete({
      where: { id: membership.id },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'delete',
      module: 'members',
      recordType: 'business_user',
      recordId: membership.id,
      oldValues: { userId: targetUserId, role: membership.role },
    })

    return { success: true }
  }

  /**
   * Create a direct user account in the system immediately without requiring email invite.
   * Creates/links Supabase auth with pre-confirmed email and sets direct active business membership.
   */
  static async createDirectUser(params: CreateDirectUserParams) {
    const {
      businessId,
      email,
      fullName,
      password,
      phone,
      role,
      customPermissions,
      adminUserId,
    } = params

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new ValidationError('A valid email address is required.')
    }

    if (!fullName || fullName.trim().length < 2) {
      throw new ValidationError('Full name must be at least 2 characters long.')
    }

    const userPassword = password?.trim() || 'Account@123456'
    if (userPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters.')
    }

    // 1. Check user quota limits
    await UsageService.assertQuota(businessId, 'users')

    let authUserId: string | null = null

    // 2. Create or sync user with Supabase Auth Admin
    try {
      const supabaseAdmin = getSupabaseAdmin()
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: userPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          phone: phone?.trim() || null,
        },
      })

      if (authError) {
        // If user already exists in auth, find existing auth user ID
        if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('exists')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
          const existing = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail)
          if (existing) {
            authUserId = existing.id
            if (password) {
              await supabaseAdmin.auth.admin.updateUserById(existing.id, {
                password: userPassword,
                user_metadata: { full_name: fullName.trim() },
              })
            }
          }
        } else {
          console.warn('Supabase auth create user warning:', authError.message)
        }
      } else if (authData?.user) {
        authUserId = authData.user.id
      }
    } catch (e: any) {
      console.warn('Supabase admin call exception:', e?.message || e)
    }

    // 3. Upsert user in Prisma DB
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          ...(authUserId ? { id: authUserId } : {}),
          email: normalizedEmail,
          fullName: fullName.trim(),
          phone: phone?.trim() || null,
          status: 'active',
        },
      })
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: fullName.trim(),
          ...(phone ? { phone: phone.trim() } : {}),
          status: 'active',
        },
      })
    }

    // 4. Upsert active business membership
    const { roleId } = params
    const existingMembership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: user.id,
          businessId,
        },
      },
    })

    let membership: any
    if (existingMembership) {
      membership = await prisma.businessUser.update({
        where: { id: existingMembership.id },
        data: {
          role,
          ...(roleId !== undefined ? { roleId } : {}),
          status: 'active',
          permissions: customPermissions ? (customPermissions as any) : existingMembership.permissions,
          joinedAt: existingMembership.joinedAt || new Date(),
        },
        include: { user: true, roleModel: true },
      })
    } else {
      membership = await prisma.businessUser.create({
        data: {
          businessId,
          userId: user.id,
          role,
          roleId: roleId || null,
          status: 'active',
          permissions: customPermissions ? (customPermissions as any) : null,
          invitedBy: adminUserId,
          joinedAt: new Date(),
        },
        include: { user: true, roleModel: true },
      })
    }

    // 5. Audit Log
    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'create',
      module: 'members',
      recordType: 'business_user_direct',
      recordId: membership.id,
      newValues: {
        email: normalizedEmail,
        fullName: fullName.trim(),
        role,
        roleId: roleId || null,
        permissionsCount: customPermissions?.length || 0,
        directCreated: true,
      },
    })

    return membership
  }

  /**
   * Update granular custom permissions for a member.
   */
  static async updateMemberCustomPermissions(
    businessId: string,
    targetUserId: string,
    permissions: string[],
    role?: MemberRole,
    roleId?: string | null,
    adminUserId?: string
  ) {
    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: targetUserId,
          businessId,
        },
      },
    })

    if (!membership) {
      throw new ValidationError('Member not found in this business.')
    }

    const updated = await prisma.businessUser.update({
      where: { id: membership.id },
      data: {
        permissions: permissions as any,
        ...(role ? { role } : {}),
        ...(roleId !== undefined ? { roleId } : {}),
      },
      include: { user: true, roleModel: true },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'permission_change',
      module: 'members',
      recordType: 'business_user_permissions',
      recordId: membership.id,
      newValues: { permissionsCount: permissions.length, permissions, role, roleId },
    })

    return updated
  }

  /**
   * Reset a user password directly (Super Admin only).
   */
  static async resetUserPasswordDirect(
    businessId: string,
    targetUserId: string,
    newPassword: string,
    adminUserId?: string
  ) {
    if (!newPassword || newPassword.trim().length < 6) {
      throw new ValidationError('Password must be at least 6 characters long.')
    }

    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: targetUserId,
          businessId,
        },
      },
      include: { user: true },
    })

    if (!membership) {
      throw new ValidationError('Member not found in this business.')
    }

    try {
      const supabaseAdmin = getSupabaseAdmin()
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: newPassword.trim(),
      })
      if (error) {
        throw new Error(error.message)
      }
    } catch (err: any) {
      throw new Error(`Failed to update password: ${err.message}`)
    }

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'update',
      module: 'members',
      recordType: 'user_password',
      recordId: targetUserId,
      newValues: { action: 'direct_password_reset', targetEmail: membership.user.email },
    })

    return { success: true }
  }
}
