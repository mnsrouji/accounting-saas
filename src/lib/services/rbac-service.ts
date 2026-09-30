// =============================================================
// RBAC Service — Role-Based Access Control & Permission Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

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
  },
  purchase_user: {
    purchases: 'write',
    suppliers: 'write',
    purchaseOrders: 'write',
    inventory: 'read',
    reports: 'read',
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

// Permission code mapping to module and level
const PERMISSION_CODE_MAP: Record<string, { module: string; level: PermissionLevel }> = {
  'customers.view': { module: 'customers', level: 'read' },
  'customers.create': { module: 'customers', level: 'write' },
  'customers.update': { module: 'customers', level: 'write' },
  'customers.delete': { module: 'customers', level: 'delete' },
  'sales.view': { module: 'sales', level: 'read' },
  'sales.create': { module: 'sales', level: 'write' },
  'sales.update': { module: 'sales', level: 'write' },
  'sales.delete': { module: 'sales', level: 'delete' },
  'purchases.view': { module: 'purchases', level: 'read' },
  'purchases.create': { module: 'purchases', level: 'write' },
  'inventory.view': { module: 'inventory', level: 'read' },
  'inventory.adjust': { module: 'inventory', level: 'write' },
  'accounting.view': { module: 'accounting', level: 'read' },
  'accounting.post': { module: 'accounting', level: 'write' },
  'reports.view': { module: 'reports', level: 'read' },
  'settings.manage': { module: 'settings', level: 'full' },
}

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

    // 2. Check custom permission overrides attached directly to membership (JSON)
    if (membership?.permissions) {
      const customPerms = membership.permissions
      if (typeof customPerms === 'object' && customPerms !== null) {
        // e.g. { "accounting": "write" } or { "accounting": true }
        if (customPerms[module]) {
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
            const mapped = PERMISSION_CODE_MAP[permCode]
            if (mapped && (mapped.module === module || mapped.module === '*') && LEVEL_WEIGHT[mapped.level] >= requiredWeight) {
              return true
            }
          }
        }
      }
    }

    // 3. Check custom DB Role & RolePermissions if linked
    if (membership?.roleModel?.rolePermissions && Array.isArray(membership.roleModel.rolePermissions)) {
      for (const rp of membership.roleModel.rolePermissions) {
        const code = rp.permission?.code
        if (code) {
          const mapped = PERMISSION_CODE_MAP[code]
          if (mapped && (mapped.module === module || mapped.module === '*') && LEVEL_WEIGHT[mapped.level] >= requiredWeight) {
            return true
          }
        }
      }
    }

    // 4. Check standard matrix for the member's role
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
   * Check if a member has a specific permission code (e.g. "accounting.post").
   */
  static hasPermission(membership: any, permissionCode: string): boolean {
    const roleKey = (membership?.role || '').toLowerCase()
    if (roleKey === 'owner' || roleKey === 'administrator') {
      return true
    }

    const mapped = PERMISSION_CODE_MAP[permissionCode]
    if (mapped) {
      return this.hasModuleAccess(roleKey, mapped.module, mapped.level, membership)
    }

    // Direct check in DB role permissions
    if (membership?.roleModel?.rolePermissions && Array.isArray(membership.roleModel.rolePermissions)) {
      const match = membership.roleModel.rolePermissions.some(
        (rp: any) => rp.permission?.code === permissionCode
      )
      if (match) return true
    }

    // Direct check in custom JSON permissions
    if (membership?.permissions) {
      const p = membership.permissions
      if (Array.isArray(p) && p.includes(permissionCode)) return true
      if (typeof p === 'object' && p !== null && p[permissionCode] === true) return true
    }

    return false
  }
}
