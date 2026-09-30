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
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to remove member' }
  }
}
