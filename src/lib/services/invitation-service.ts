// =============================================================
// Invitation Service — User Invitations & Team Memberships
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { MemberRole, MemberStatus } from '@prisma/client'
import { UsageService } from './usage-service'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { AccessDeniedError, ValidationError } from '@/lib/auth/require-auth'

export interface InviteUserParams {
  businessId: string
  email: string
  fullName?: string
  role: MemberRole
  invitedById: string
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
}
