// =============================================================
// Role Service — Custom Business Roles & Permissions Control
// Multi-Tenant SaaS Accounting & ERP Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { ValidationError, AccessDeniedError } from '@/lib/auth/require-auth'
import {
  SYSTEM_PERMISSIONS_REGISTRY,
  ROLE_PRESET_PERMISSIONS,
  ALL_PERMISSION_CODES,
} from '@/lib/auth/permissions-registry'

export interface CustomRoleDTO {
  id: string
  businessId: string | null
  name: string
  code: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  memberCount: number
  createdAt?: Date
}

export class RoleService {
  /**
   * Ensure standard system permissions exist in database permissions table.
   */
  private static async syncPermissionsInDB() {
    try {
      const allPerms = SYSTEM_PERMISSIONS_REGISTRY.flatMap((g) => g.permissions)
      for (const p of allPerms) {
        await prisma.permission.upsert({
          where: { code: p.code },
          update: {
            module: p.module,
            description: p.descriptionAr || p.nameAr,
          },
          create: {
            code: p.code,
            module: p.module,
            description: p.descriptionAr || p.nameAr,
          },
        })
      }
    } catch (e) {
      console.warn('Sync permissions in DB non-fatal note:', e)
    }
  }

  /**
   * Get all roles for a business (System Standard Roles + Business Custom Roles).
   */
  static async getRoles(businessId: string): Promise<CustomRoleDTO[]> {
    // 1. Fetch DB Custom Roles for this business
    let dbRoles: any[] = []
    try {
      dbRoles = await prisma.role.findMany({
        where: {
          OR: [{ businessId }, { businessId: null }],
        },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
          members: {
            where: { businessId, status: 'active' },
            select: { id: true },
          },
        },
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      })
    } catch (err) {
      console.warn('Error querying prisma.role:', err)
      dbRoles = []
    }

    // 2. Base System Roles definitions
    const systemRoleDefinitions: CustomRoleDTO[] = [
      {
        id: 'system_owner',
        businessId: null,
        name: 'مالك المنشأة (Owner)',
        code: 'owner',
        description: 'صلاحيات إدارية ومالية وتنفيذية كاملة ومطلقة على كافة مفاصل النظام والمنشأة',
        isSystem: true,
        permissions: [...ALL_PERMISSION_CODES],
        memberCount: 0,
      },
      {
        id: 'system_administrator',
        businessId: null,
        name: 'مدير نظام (Administrator)',
        code: 'administrator',
        description: 'إدارة العمليات، المستخدمين، الصلاحيات، وإعدادات الشركة',
        isSystem: true,
        permissions: [...ALL_PERMISSION_CODES],
        memberCount: 0,
      },
      {
        id: 'system_accountant',
        businessId: null,
        name: 'محاسب عام (Accountant)',
        code: 'accountant',
        description: 'إدارة القيود اليومية، الفواتير، الحسابات، الخزينة، والقوائم المالية',
        isSystem: true,
        permissions: [...ROLE_PRESET_PERMISSIONS['accountant']],
        memberCount: 0,
      },
      {
        id: 'system_sales_user',
        businessId: null,
        name: 'مسؤول مبيعات (Sales)',
        code: 'sales_user',
        description: 'إصدار فواتير المبيعات، عروض الأسعار، إدارة العملاء، واستلام الدفعات',
        isSystem: true,
        permissions: [...ROLE_PRESET_PERMISSIONS['sales_user']],
        memberCount: 0,
      },
      {
        id: 'system_purchase_user',
        businessId: null,
        name: 'مسؤول مشتريات (Purchases)',
        code: 'purchase_user',
        description: 'إصدار أوامر وفواتير الشراء، إدارة الموردين، وتسجيل سندات الصرف',
        isSystem: true,
        permissions: [...ROLE_PRESET_PERMISSIONS['purchase_user']],
        memberCount: 0,
      },
      {
        id: 'system_inventory_user',
        businessId: null,
        name: 'مسؤول مستودعات (Inventory)',
        code: 'inventory_user',
        description: 'إدارة الأصناف، حركة المخزون، الجرد، والتسويات المستودعية',
        isSystem: true,
        permissions: [...ROLE_PRESET_PERMISSIONS['inventory_user']],
        memberCount: 0,
      },
      {
        id: 'system_viewer',
        businessId: null,
        name: 'مشاهد فقط (Viewer)',
        code: 'viewer',
        description: 'استعراض وقراءة البيانات والتقارير دون إمكانية التعديل أو الإنشاء',
        isSystem: true,
        permissions: [...ROLE_PRESET_PERMISSIONS['viewer']],
        memberCount: 0,
      },
    ]

    // 3. Count members for system roles
    try {
      const memberCounts = await prisma.businessUser.groupBy({
        by: ['role'],
        where: { businessId, status: 'active' },
        _count: { _all: true },
      })

      for (const sc of memberCounts) {
        const sysRole = systemRoleDefinitions.find((r) => r.code === sc.role)
        if (sysRole) {
          sysRole.memberCount = sc._count._all
        }
      }
    } catch (e) {
      console.warn('Member count group by note:', e)
    }

    // 4. Map DB Custom Roles
    const customRoles: CustomRoleDTO[] = dbRoles
      .filter((r) => !r.isSystem && r.businessId === businessId)
      .map((r) => ({
        id: r.id,
        businessId: r.businessId,
        name: r.name,
        code: r.code,
        description: r.description,
        isSystem: false,
        permissions: r.rolePermissions.map((rp: any) => rp.permission.code),
        memberCount: r.members?.length || 0,
        createdAt: r.createdAt,
      }))

    return [...systemRoleDefinitions, ...customRoles]
  }

  /**
   * Create a new Custom Role for a business.
   */
  static async createRole(
    businessId: string,
    data: {
      name: string
      code?: string
      description?: string
      permissions: string[]
    },
    adminUserId?: string
  ): Promise<CustomRoleDTO> {
    const { name, code, description, permissions } = data

    if (!name || name.trim().length < 2) {
      throw new ValidationError('اسم الدور الوظيفي مطلوب ويجب أن يتكون من حرفين على الأقل.')
    }

    // Generate safe unique code
    const generatedCode =
      code?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      `custom_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`

    // Check duplicate code in business
    const existing = await prisma.role.findFirst({
      where: {
        businessId,
        code: generatedCode,
      },
    })

    if (existing) {
      throw new ValidationError(`رمز الدور الوظيفي (${generatedCode}) مستخدم مسبقاً في هذه المنشأة.`)
    }

    // Sync permission records
    await this.syncPermissionsInDB()

    // Create Role
    const newRole = await prisma.role.create({
      data: {
        businessId,
        name: name.trim(),
        code: generatedCode,
        description: description?.trim() || null,
        isSystem: false,
      },
    })

    // Assign permissions
    if (permissions && permissions.length > 0) {
      const permRecords = await prisma.permission.findMany({
        where: {
          code: { in: permissions },
        },
      })

      for (const p of permRecords) {
        await prisma.rolePermission.create({
          data: {
            roleId: newRole.id,
            permissionId: p.id,
          },
        }).catch(() => {})
      }
    }

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'create',
      module: 'members',
      recordType: 'custom_role',
      recordId: newRole.id,
      newValues: { name: newRole.name, code: newRole.code, permissionsCount: permissions.length },
    })

    return {
      id: newRole.id,
      businessId: newRole.businessId,
      name: newRole.name,
      code: newRole.code,
      description: newRole.description,
      isSystem: false,
      permissions: permissions || [],
      memberCount: 0,
      createdAt: newRole.createdAt,
    }
  }

  /**
   * Update an existing Custom Role.
   */
  static async updateRole(
    businessId: string,
    roleId: string,
    data: {
      name?: string
      description?: string
      permissions?: string[]
    },
    adminUserId?: string
  ): Promise<CustomRoleDTO> {
    const role = await prisma.role.findFirst({
      where: { id: roleId, businessId, isSystem: false },
      include: {
        rolePermissions: { include: { permission: true } },
        members: { where: { businessId, status: 'active' } },
      },
    })

    if (!role) {
      throw new ValidationError('الدور الوظيفي المطلوب غير موجود أو لا يمكن تعديله.')
    }

    const { name, description, permissions } = data

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
      },
    })

    let currentPerms: string[] = role.rolePermissions.map((rp: any) => rp.permission.code)

    if (permissions) {
      await this.syncPermissionsInDB()

      // Remove existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      })

      // Add new permissions
      const permRecords = await prisma.permission.findMany({
        where: {
          code: { in: permissions },
        },
      })

      for (const p of permRecords) {
        await prisma.rolePermission.create({
          data: {
            roleId,
            permissionId: p.id,
          },
        }).catch(() => {})
      }

      currentPerms = permissions

      // Also sync all active members assigned to this custom role
      await prisma.businessUser.updateMany({
        where: { businessId, roleId },
        data: {
          permissions: permissions as any,
        },
      })
    }

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'update',
      module: 'members',
      recordType: 'custom_role',
      recordId: roleId,
      newValues: { name: updatedRole.name, permissionsCount: currentPerms.length },
    })

    return {
      id: updatedRole.id,
      businessId: updatedRole.businessId,
      name: updatedRole.name,
      code: updatedRole.code,
      description: updatedRole.description,
      isSystem: false,
      permissions: currentPerms,
      memberCount: role.members?.length || 0,
      createdAt: updatedRole.createdAt,
    }
  }

  /**
   * Delete a Custom Role.
   */
  static async deleteRole(businessId: string, roleId: string, adminUserId?: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, businessId, isSystem: false },
    })

    if (!role) {
      throw new ValidationError('الدور الوظيفي غير موجود أو لا يمكن حذفه.')
    }

    // Unlink members using this roleId
    await prisma.businessUser.updateMany({
      where: { businessId, roleId },
      data: {
        roleId: null,
        role: 'custom',
      },
    })

    // Delete role permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    })

    // Delete role
    await prisma.role.delete({
      where: { id: roleId },
    })

    await createAuditLog({
      businessId,
      userId: adminUserId,
      action: 'delete',
      module: 'members',
      recordType: 'custom_role',
      recordId: roleId,
      oldValues: { name: role.name, code: role.code },
    })

    return { success: true }
  }
}
