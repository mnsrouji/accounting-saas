// =============================================================
// Custom Roles & Permissions Server Actions
// Multi-Tenant SaaS Accounting & ERP Platform
// =============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { RoleService } from '@/lib/services/role-service'

export async function getRolesAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId)
    const roles = await RoleService.getRoles(businessId)
    return { success: true as const, data: roles }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to fetch roles' }
  }
}

export async function createCustomRoleAction(params: {
  businessId: string
  name: string
  code?: string
  description?: string
  permissions: string[]
}) {
  try {
    const { userId, role, isSuperAdmin } = await requireBusinessAccess(params.businessId, 'settings', 'full')
    if (!isSuperAdmin && role !== 'owner' && role !== 'administrator') {
      return { success: false as const, error: 'Only super administrators or business owners can create custom roles.' }
    }

    const createdRole = await RoleService.createRole(
      params.businessId,
      {
        name: params.name,
        code: params.code,
        description: params.description,
        permissions: params.permissions,
      },
      userId
    )

    revalidatePath(`/b/${params.businessId}/settings/members`)
    revalidatePath(`/b/${params.businessId}/users`)
    return { success: true as const, data: createdRole }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create role' }
  }
}

export async function updateCustomRoleAction(params: {
  businessId: string
  roleId: string
  name?: string
  description?: string
  permissions?: string[]
}) {
  try {
    const { userId, role, isSuperAdmin } = await requireBusinessAccess(params.businessId, 'settings', 'full')
    if (!isSuperAdmin && role !== 'owner' && role !== 'administrator') {
      return { success: false as const, error: 'Only super administrators or business owners can modify custom roles.' }
    }

    const updatedRole = await RoleService.updateRole(
      params.businessId,
      params.roleId,
      {
        name: params.name,
        description: params.description,
        permissions: params.permissions,
      },
      userId
    )

    revalidatePath(`/b/${params.businessId}/settings/members`)
    revalidatePath(`/b/${params.businessId}/users`)
    return { success: true as const, data: updatedRole }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to update custom role' }
  }
}

export async function deleteCustomRoleAction(params: {
  businessId: string
  roleId: string
}) {
  try {
    const { userId, role, isSuperAdmin } = await requireBusinessAccess(params.businessId, 'settings', 'full')
    if (!isSuperAdmin && role !== 'owner' && role !== 'administrator') {
      return { success: false as const, error: 'Only super administrators or business owners can delete custom roles.' }
    }

    await RoleService.deleteRole(params.businessId, params.roleId, userId)

    revalidatePath(`/b/${params.businessId}/settings/members`)
    revalidatePath(`/b/${params.businessId}/users`)
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to delete role' }
  }
}
