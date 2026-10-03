// =============================================================
// RBAC Service — Role-Based Access Control & Permission Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import {
  SYSTEM_PERMISSIONS_REGISTRY,
  ROLE_PRESET_PERMISSIONS,
  ALL_PERMISSION_CODES,
  PermissionDefinition,
} from '@/lib/auth/permissions-registry'

export type PermissionLevel = 'read' | 'write' | 'delete' | 'full'

const LEVEL_WEIGHT: Record<PermissionLevel, number> = {
  read: 1,
  write: 2,
  delete: 3,
  full: 4,
}

// Module role matrix defining standard capabilities per MemberRole
const ROLE_MODULE_PERMISSIONS: Record<string, Record<string, PermissionLevel>> = {
  owner: {
    '*': 'full',
  },
  administrator: {
    '*': 'full',
  },
  accountant: {
    accounting: 'full',
    reports: 'full',
    tax: 'full',
    treasury: 'full',
    sales: 'write',
    purchases: 'write',
    customers: 'write',
    suppliers: 'write',
    inventory: 'read',
    settings: 'read',
  },
  sales_user: {
    sales: 'write',
    customers: 'write',
    quotations: 'write',
    inventory: 'read',
    reports: 'read',
    treasury: 'read',
  },
  purchase_user: {
    purchases: 'write',
    suppliers: 'write',
    purchaseOrders: 'write',
    inventory: 'read',
    reports: 'read',
    treasury: 'read',
  },
  inventory_user: {
    inventory: 'write',
    products: 'write',
    warehouses: 'write',
    stockTransfers: 'write',
    stockAdjustments: 'write',
    sales: 'read',
    purchases: 'read',
    reports: 'read',
  },
  viewer: {
    '*': 'read',
  },
}

/**
 * Dynamically map all system permissions to their module and level
 */
function buildPermissionCodeMap(): Record<string, { module: string; level: PermissionLevel }> {
  const map: Record<string, { module: string; level: PermissionLevel }> = {}

  for (const group of SYSTEM_PERMISSIONS_REGISTRY) {
    for (const perm of group.permissions) {
      let level: PermissionLevel = 'read'
      if (perm.action === 'view' || perm.action === 'export') {
        level = 'read'
      } else if (perm.action === 'delete') {
        level = 'delete'
      } else if (perm.action === 'manage') {
        level = perm.module === 'settings' ? 'full' : 'write'
      } else {
        // 'create', 'edit', 'post'
        level = 'write'
      }

      map[perm.code] = {
        module: perm.module,
        level,
      }
    }
  }

  // Common aliases
  map['inventory.adjust'] = { module: 'inventory', level: 'write' }
  map['inventory.manage'] = { module: 'inventory', level: 'write' }
  map['accounting.chart_manage'] = { module: 'accounting', level: 'write' }
  map['journal_entries.create'] = { module: 'accounting', level: 'write' }
  map['journal_entries.post'] = { module: 'accounting', level: 'write' }
  map['payments.incoming'] = { module: 'treasury', level: 'write' }
  map['payments.outgoing'] = { module: 'treasury', level: 'write' }
  map['treasury.transfers'] = { module: 'treasury', level: 'write' }
  map['treasury.reconcile'] = { module: 'treasury', level: 'write' }
  map['members.manage'] = { module: 'settings', level: 'full' }
  map['settings.manage'] = { module: 'settings', level: 'full' }

  return map
}

const PERMISSION_CODE_MAP = buildPermissionCodeMap()

export class RBACService {
  /**
   * Check if a member has access to a specific module at the required permission level.
   */
  static hasModuleAccess(
    role: string,
    module: string,
    requiredLevel: PermissionLevel = 'read',
    membership?: any
  ): boolean {
    const roleKey = (role || '').toLowerCase()

    // 1. Owner and Administrator have full access to all standard modules
    if (roleKey === 'owner' || roleKey === 'administrator') {
      return true
    }

    const requiredWeight = LEVEL_WEIGHT[requiredLevel] || 1

    // 2. Check custom permission overrides attached directly to membership (JSON or Array)
    if (membership?.permissions) {
      const customPerms = membership.permissions
      if (typeof customPerms === 'object' && customPerms !== null) {
        // e.g. { "accounting": "write" } or { "accounting": true }
        if (customPerms[module] !== undefined) {
          const val = customPerms[module]
          if (typeof val === 'string' && LEVEL_WEIGHT[val as PermissionLevel]) {
            if (LEVEL_WEIGHT[val as PermissionLevel] >= requiredWeight) return true
          } else if (val === true) {
            return true
          } else if (val === false) {
            return false
          }
        }

        // e.g. array of permission codes: ["accounting.post", "sales.create"]
        if (Array.isArray(customPerms)) {
          for (const permCode of customPerms) {
            if (permCode === '*') return true
            const mapped = PERMISSION_CODE_MAP[permCode]
            if (
              mapped &&
              (mapped.module === module || mapped.module === '*') &&
              LEVEL_WEIGHT[mapped.level] >= requiredWeight
            ) {
              return true
            }
          }
        }
      }
    }

    // 3. Check custom DB Role & RolePermissions if linked
    if (membership?.roleModel?.rolePermissions && Array.isArray(membership.roleModel.rolePermissions)) {
      for (const rp of membership.roleModel.rolePermissions) {
        const code = rp.permission?.code || rp.permissionCode
        if (code) {
          if (code === '*') return true
          const mapped = PERMISSION_CODE_MAP[code]
          if (
            mapped &&
            (mapped.module === module || mapped.module === '*') &&
            LEVEL_WEIGHT[mapped.level] >= requiredWeight
          ) {
            return true
          }
        }
      }
    }

    // 4. Check preset permissions for custom / standard roles from ROLE_PRESET_PERMISSIONS
    const rolePreset = ROLE_PRESET_PERMISSIONS[roleKey]
    if (rolePreset && Array.isArray(rolePreset)) {
      for (const permCode of rolePreset) {
        if (permCode === '*') return true
        const mapped = PERMISSION_CODE_MAP[permCode]
        if (
          mapped &&
          (mapped.module === module || mapped.module === '*') &&
          LEVEL_WEIGHT[mapped.level] >= requiredWeight
        ) {
          return true
        }
      }
    }

    // 5. Check standard matrix for the member's role
    const roleMatrix = ROLE_MODULE_PERMISSIONS[roleKey]
    if (!roleMatrix) {
      return false
    }

    // Check wildcard access
    if (roleMatrix['*']) {
      const wildcardLevel = roleMatrix['*']
      return LEVEL_WEIGHT[wildcardLevel] >= requiredWeight
    }

    // Check specific module
    const grantedLevel = roleMatrix[module]
    if (!grantedLevel) {
      return false
    }

    return LEVEL_WEIGHT[grantedLevel] >= requiredWeight
  }

  /**
   * Check if a member has a specific permission code (e.g. "accounting.post", "sales.create").
   */
  static hasPermission(membership: any, permissionCode: string): boolean {
    const roleKey = (membership?.role || '').toLowerCase()
    if (roleKey === 'owner' || roleKey === 'administrator') {
      return true
    }

    // 1. Direct check in custom JSON permissions on membership
    if (membership?.permissions) {
      const p = membership.permissions
      if (Array.isArray(p)) {
        if (p.includes('*') || p.includes(permissionCode)) return true
      } else if (typeof p === 'object' && p !== null) {
        if (p['*'] === true || p[permissionCode] === true) return true
      }
    }

    // 2. Direct check in DB role permissions
    if (membership?.roleModel?.rolePermissions && Array.isArray(membership.roleModel.rolePermissions)) {
      const match = membership.roleModel.rolePermissions.some(
        (rp: any) => {
          const code = rp.permission?.code || rp.permissionCode
          return code === '*' || code === permissionCode
        }
      )
      if (match) return true
    }

    // 3. Direct check in standard preset for role
    const rolePreset = ROLE_PRESET_PERMISSIONS[roleKey]
    if (rolePreset && Array.isArray(rolePreset)) {
      if (rolePreset.includes('*') || rolePreset.includes(permissionCode)) {
        return true
      }
    }

    // 4. Fallback check via module access level
    const mapped = PERMISSION_CODE_MAP[permissionCode]
    if (mapped) {
      return this.hasModuleAccess(roleKey, mapped.module, mapped.level, membership)
    }

    return false
  }
}

