// =============================================================
// Comprehensive RBAC & Permissions Enforcement Test Suite
// =============================================================

import { RBACService, PermissionLevel } from '../src/lib/services/rbac-service'
import { SYSTEM_PERMISSIONS_REGISTRY, ALL_PERMISSION_CODES, ROLE_PRESET_PERMISSIONS } from '../src/lib/auth/permissions-registry'

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${testName}`)
    if (failureDetails) console.error(`     Details: ${failureDetails}`)
    failed++
  }
}

console.log('====================================================')
console.log('  STARTING RBAC PERMISSIONS VERIFICATION TEST SUITE ')
console.log('====================================================\n')

// -----------------------------------------------------------
// TEST GROUP 1: Owner and Administrator Full Bypass
// -----------------------------------------------------------
console.log('--- TEST GROUP 1: Owner & Admin Bypass ---')
assert(RBACService.hasModuleAccess('owner', 'sales', 'full'), 'Owner has full access to sales')
assert(RBACService.hasModuleAccess('owner', 'accounting', 'full'), 'Owner has full access to accounting')
assert(RBACService.hasModuleAccess('owner', 'settings', 'full'), 'Owner has full access to settings')
assert(RBACService.hasModuleAccess('administrator', 'treasury', 'full'), 'Admin has full access to treasury')
assert(RBACService.hasPermission({ role: 'owner' }, 'journal_entries.post'), 'Owner has journal_entries.post permission')
assert(RBACService.hasPermission({ role: 'administrator' }, 'members.manage'), 'Admin has members.manage permission')

// -----------------------------------------------------------
// TEST GROUP 2: Viewer Role Constraints
// -----------------------------------------------------------
console.log('\n--- TEST GROUP 2: Viewer Role Restrictions ---')
assert(RBACService.hasModuleAccess('viewer', 'sales', 'read'), 'Viewer can READ sales')
assert(RBACService.hasModuleAccess('viewer', 'accounting', 'read'), 'Viewer can READ accounting')
assert(!RBACService.hasModuleAccess('viewer', 'sales', 'write'), 'Viewer CANNOT WRITE sales')
assert(!RBACService.hasModuleAccess('viewer', 'purchases', 'write'), 'Viewer CANNOT WRITE purchases')
assert(!RBACService.hasModuleAccess('viewer', 'accounting', 'write'), 'Viewer CANNOT WRITE accounting')
assert(!RBACService.hasModuleAccess('viewer', 'treasury', 'write'), 'Viewer CANNOT WRITE treasury')
assert(!RBACService.hasModuleAccess('viewer', 'expenses', 'write'), 'Viewer CANNOT WRITE expenses')
assert(!RBACService.hasModuleAccess('viewer', 'inventory', 'delete'), 'Viewer CANNOT DELETE inventory')
assert(!RBACService.hasModuleAccess('viewer', 'settings', 'full'), 'Viewer CANNOT MANAGE settings')
assert(RBACService.hasPermission({ role: 'viewer' }, 'sales.view'), 'Viewer has sales.view code')
assert(!RBACService.hasPermission({ role: 'viewer' }, 'sales.create'), 'Viewer DOES NOT have sales.create code')
assert(!RBACService.hasPermission({ role: 'viewer' }, 'journal_entries.create'), 'Viewer DOES NOT have journal_entries.create')

// -----------------------------------------------------------
// TEST GROUP 3: Sales User Granular Scopes
// -----------------------------------------------------------
console.log('\n--- TEST GROUP 3: Sales User Scopes ---')
assert(RBACService.hasModuleAccess('sales_user', 'sales', 'write'), 'Sales User can WRITE sales')
assert(RBACService.hasModuleAccess('sales_user', 'customers', 'write'), 'Sales User can WRITE customers')
assert(RBACService.hasModuleAccess('sales_user', 'inventory', 'read'), 'Sales User can READ inventory')
assert(!RBACService.hasModuleAccess('sales_user', 'accounting', 'write'), 'Sales User CANNOT WRITE accounting')
assert(!RBACService.hasModuleAccess('sales_user', 'purchases', 'write'), 'Sales User CANNOT WRITE purchases')
assert(!RBACService.hasModuleAccess('sales_user', 'settings', 'full'), 'Sales User CANNOT MANAGE settings')
assert(RBACService.hasPermission({ role: 'sales_user' }, 'sales.create'), 'Sales User has sales.create permission')
assert(!RBACService.hasPermission({ role: 'sales_user' }, 'purchases.create'), 'Sales User DOES NOT have purchases.create')

// -----------------------------------------------------------
// TEST GROUP 4: Custom Role Permissions (DB Model & JSON overrides)
// -----------------------------------------------------------
console.log('\n--- TEST GROUP 4: Custom Roles & Granular Overrides ---')

// Custom role with only treasury permissions
const treasuryOnlyMember = {
  role: 'custom',
  permissions: ['treasury.view', 'treasury.transfers', 'payments.incoming'],
}
assert(RBACService.hasModuleAccess('custom', 'treasury', 'read', treasuryOnlyMember), 'Treasury custom role can READ treasury')
assert(RBACService.hasModuleAccess('custom', 'treasury', 'write', treasuryOnlyMember), 'Treasury custom role can WRITE treasury (transfers)')
assert(!RBACService.hasModuleAccess('custom', 'sales', 'write', treasuryOnlyMember), 'Treasury custom role CANNOT WRITE sales')
assert(!RBACService.hasModuleAccess('custom', 'accounting', 'write', treasuryOnlyMember), 'Treasury custom role CANNOT WRITE accounting')
assert(RBACService.hasPermission(treasuryOnlyMember, 'treasury.transfers'), 'Treasury custom member has treasury.transfers code')
assert(!RBACService.hasPermission(treasuryOnlyMember, 'journal_entries.post'), 'Treasury custom member DOES NOT have journal_entries.post')

// Custom DB Role Model linked via rolePermissions relation
const dbRoleMember = {
  role: 'custom',
  roleModel: {
    name: 'Senior Auditor',
    rolePermissions: [
      { permission: { code: 'audit.view' } },
      { permission: { code: 'reports.financial_view' } },
      { permission: { code: 'reports.export' } },
      { permission: { code: 'accounting.view' } },
    ],
  },
}
assert(RBACService.hasModuleAccess('custom', 'reports', 'read', dbRoleMember), 'Senior Auditor can READ reports')
assert(RBACService.hasModuleAccess('custom', 'accounting', 'read', dbRoleMember), 'Senior Auditor can READ accounting')
assert(!RBACService.hasModuleAccess('custom', 'accounting', 'write', dbRoleMember), 'Senior Auditor CANNOT WRITE accounting')
assert(!RBACService.hasModuleAccess('custom', 'sales', 'write', dbRoleMember), 'Senior Auditor CANNOT WRITE sales')
assert(RBACService.hasPermission(dbRoleMember, 'audit.view'), 'Senior Auditor has audit.view')
assert(RBACService.hasPermission(dbRoleMember, 'reports.export'), 'Senior Auditor has reports.export')
assert(!RBACService.hasPermission(dbRoleMember, 'sales.delete'), 'Senior Auditor DOES NOT have sales.delete')

// -----------------------------------------------------------
// TEST GROUP 5: Registry Integrity & Code Coverage
// -----------------------------------------------------------
console.log('\n--- TEST GROUP 5: Permissions Registry Integrity ---')
assert(SYSTEM_PERMISSIONS_REGISTRY.length >= 8, `Registry has ${SYSTEM_PERMISSIONS_REGISTRY.length} module groups`)
assert(ALL_PERMISSION_CODES.length >= 25, `Registry has ${ALL_PERMISSION_CODES.length} total permissions`)

console.log('\n====================================================')
console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
console.log('====================================================')

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
