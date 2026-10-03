// =============================================================
// Invitation & Membership Server Actions — Team Management
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { InvitationService } from '@/lib/services/invitation-service'
import { MemberRole, MemberStatus } from '@prisma/client'

export async function getBusinessMembersAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId)
    const members = await InvitationService.getMembers(businessId)
    return { success: true as const, data: members }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch members' }
  }
}

export async function inviteMemberAction(params: {
  businessId: string
  email: string
  fullName?: string
  role: MemberRole
}) {
  try {
    const { userId } = await requireBusinessAccess(params.businessId, 'settings', 'write')
    const invitation = await InvitationService.inviteUser({
      businessId: params.businessId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      invitedById: userId,
    })

    revalidatePath(`/b/${params.businessId}/settings/members`)
    revalidatePath(`/b/${params.businessId}/settings`)
    return { success: true as const, data: invitation }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to send invitation' }
  }
}

export async function cancelInvitationAction(businessId: string, membershipId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'write')
    await InvitationService.cancelInvitation(businessId, membershipId, userId)

    revalidatePath(`/b/${businessId}/settings/members`)
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to cancel invitation' }
  }
}

export async function updateMemberRoleAction(
  businessId: string,
  targetUserId: string,
  newRole: MemberRole
) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'full')
    const updated = await InvitationService.updateMemberRole(
      businessId,
      targetUserId,
      newRole,
      userId
    )

    revalidatePath(`/b/${businessId}/settings/members`)
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update member role' }
  }
}

export async function updateMemberStatusAction(
  businessId: string,
  targetUserId: string,
  newStatus: MemberStatus
) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'full')
    const updated = await InvitationService.updateMemberStatus(
      businessId,
      targetUserId,
      newStatus,
      userId
    )

    revalidatePath(`/b/${businessId}/settings/members`)
    return { success: true as const, data: updated }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update member status' }
  }
}

export async function removeMemberAction(businessId: string, targetUserId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'settings', 'full')
    await InvitationService.removeMember(businessId, targetUserId, userId)

    revalidatePath(`/b/${businessId}/settings/members`)
    revalidatePath(`/b/${businessId}/users`)
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to remove member' }
  }
}

export async function createDirectUserAction(params: {
  businessId: string
  email: string
  fullName: string
  password?: string
  phone?: string
  role: MemberRole
  customPermissions?: string[]
}) {
  try {
    const { userId, role, isSuperAdmin } = await requireBusinessAccess(params.businessId, 'settings', 'full')
    if (!isSuperAdmin && role !== 'owner' && role !== 'administrator') {
      return { success: false as const, error: 'Only super administrators or business owners can create users directly.' }
    }

    const member = await InvitationService.createDirectUser({
      businessId: params.businessId,
      email: params.email,
      fullName: params.fullName,
      password: params.password,
      phone: params.phone,
      role: params.role,
      customPermissions: params.customPermissions,
      adminUserId: userId,
    })

    revalidatePath(`/b/${params.businessId}/settings/members`)
    revalidatePath(`/b/${params.businessId}/users`)
    return { success: true as const, data: member }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create user directly' }
  }
}

export async function updateMemberCustomPermissionsAction(params: {
  businessId: string
  targetUserId: string
  permissions: string[]
  role?: MemberRole
}) {
  try {
    const { userId, role, isSuperAdmin } = await requireBusinessAccess(params.businessId, 'settings', 'full')
    if (!isSuperAdmin && role !== 'owner' && role !== 'administrator') {
      return { success: false as const, error: 'Only super administrators or business owners can modify permissions.' }
    }

    const member = await InvitationService.updateMemberCustomPermissions(
      params.businessId,
      params.targetUserId,
      params.permissions,
      params.role,
      userId
    )

    revalidatePath(`/b/${params.businessId}/settings/members`)
    revalidatePath(`/b/${params.businessId}/users`)
    return { success: true as const, data: member }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update custom permissions' }
  }
}

export async function resetUserPasswordDirectAction(params: {
  businessId: string
  targetUserId: string
  newPassword: string
}) {
  try {
    const { userId, role, isSuperAdmin } = await requireBusinessAccess(params.businessId, 'settings', 'full')
    if (!isSuperAdmin && role !== 'owner' && role !== 'administrator') {
      return { success: false as const, error: 'Only super administrators or business owners can reset passwords directly.' }
    }

    await InvitationService.resetUserPasswordDirect(
      params.businessId,
      params.targetUserId,
      params.newPassword,
      userId
    )

    revalidatePath(`/b/${params.businessId}/settings/members`)
    revalidatePath(`/b/${params.businessId}/users`)
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to reset password' }
  }
}
