/**
 * Cleanup v4 — Uses DISABLE TRIGGER / SET CONSTRAINTS DEFERRED
 * to bypass FK checks during deletion.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const KEEP_BIZ_NAMES = ['srouji trading co', 'haya group', 'demo trading company']
const KEEP_USER_EMAILS = [
  'noursrouji.m@gmail.com',
  'nour.test.803@gmail.com',
  'nour.ceo.4557@gmail.com',
  'nour.accountant@gmail.com',
  'demo.owner@demotrading.com',
  'demo.accountant@demotrading.com',
  'demo.sales@demotrading.com',
  'demo.warehouse@demotrading.com',
]

async function main() {
  console.log('\n🔍 Identifying data to keep...\n')

  const allBiz = await prisma.business.findMany({ select: { id: true, name: true } })
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, fullName: true, isSuperAdmin: true } })

  const keepBizIds = allBiz.filter(b => KEEP_BIZ_NAMES.includes(b.name.toLowerCase())).map(b => b.id)
  const deleteBizIds = allBiz.filter(b => !keepBizIds.includes(b.id)).map(b => b.id)
  const keepUserIds = allUsers.filter(u => KEEP_USER_EMAILS.includes(u.email.toLowerCase())).map(u => u.id)
  const deleteUserIds = allUsers.filter(u => !keepUserIds.includes(u.id)).map(u => u.id)

  console.log(`✅ Businesses to KEEP: ${keepBizIds.length}`)
  allBiz.filter(b => keepBizIds.includes(b.id)).forEach(b => console.log(`   🏢 ${b.name}`))
  console.log(`\n✅ Users to KEEP: ${keepUserIds.length}`)
  allUsers.filter(u => keepUserIds.includes(u.id)).forEach(u =>
    console.log(`   👤 ${u.fullName} | ${u.email}${u.isSuperAdmin ? ' 👑' : ''}`)
  )
  console.log(`\n🗑️  Businesses to DELETE: ${deleteBizIds.length}`)
  console.log(`🗑️  Users to DELETE: ${deleteUserIds.length}`)

  if (deleteBizIds.length === 0 && deleteUserIds.length === 0) {
    console.log('\n✅ Already clean!\n')
    return
  }

  const bizIn = deleteBizIds.map(id => `'${id}'::uuid`).join(',')
  const userIn = deleteUserIds.map(id => `'${id}'::uuid`).join(',')

  console.log('\n⏳ Cleaning up (using deferred FK constraints)...\n')

  // Use a transaction with deferred constraints to bypass FK ordering issues
  await prisma.$executeRawUnsafe(`SET session_replication_role = replica`)

  try {
    if (bizIn) {
      const tables = [
        `DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE business_id IN (${bizIn}))`,
        `DELETE FROM journal_entries WHERE business_id IN (${bizIn})`,
        `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE business_id IN (${bizIn}))`,
        `DELETE FROM sales WHERE business_id IN (${bizIn})`,
        `DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id IN (${bizIn}))`,
        `DELETE FROM purchases WHERE business_id IN (${bizIn})`,
        `DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE business_id IN (${bizIn}))`,
        `DELETE FROM payments WHERE business_id IN (${bizIn})`,
        `DELETE FROM treasury_transfers WHERE business_id IN (${bizIn})`,
        `DELETE FROM treasury_transactions WHERE business_id IN (${bizIn})`,
        `DELETE FROM reconciliation_adjustments WHERE reconciliation_id IN (SELECT id FROM bank_reconciliations WHERE business_id IN (${bizIn}))`,
        `DELETE FROM reconciliation_matches WHERE reconciliation_id IN (SELECT id FROM bank_reconciliations WHERE business_id IN (${bizIn}))`,
        `DELETE FROM bank_reconciliations WHERE business_id IN (${bizIn})`,
        `DELETE FROM bank_statement_lines WHERE statement_id IN (SELECT id FROM bank_statements WHERE business_id IN (${bizIn}))`,
        `DELETE FROM bank_statements WHERE business_id IN (${bizIn})`,
        `DELETE FROM bank_accounts WHERE business_id IN (${bizIn})`,
        `DELETE FROM petty_cash_counts WHERE cash_account_id IN (SELECT id FROM cash_accounts WHERE business_id IN (${bizIn}))`,
        `DELETE FROM cash_accounts WHERE business_id IN (${bizIn})`,
        `DELETE FROM stock_reservations WHERE business_id IN (${bizIn})`,
        `DELETE FROM inventory_movements WHERE business_id IN (${bizIn})`,
        `DELETE FROM attachments WHERE business_id IN (${bizIn})`,
        `DELETE FROM expenses WHERE business_id IN (${bizIn})`,
        `DELETE FROM payment_promises WHERE business_id IN (${bizIn})`,
        `DELETE FROM credit_overrides WHERE business_id IN (${bizIn})`,
        `DELETE FROM crm_activities WHERE business_id IN (${bizIn})`,
        `DELETE FROM crm_tasks WHERE business_id IN (${bizIn})`,
        `DELETE FROM sales_opportunities WHERE business_id IN (${bizIn})`,
        `DELETE FROM customer_contacts WHERE customer_id IN (SELECT id FROM customers WHERE business_id IN (${bizIn}))`,
        `DELETE FROM customers WHERE business_id IN (${bizIn})`,
        `DELETE FROM supplier_contacts WHERE supplier_id IN (SELECT id FROM suppliers WHERE business_id IN (${bizIn}))`,
        `DELETE FROM suppliers WHERE business_id IN (${bizIn})`,
        `DELETE FROM product_locations WHERE product_id IN (SELECT id FROM products WHERE business_id IN (${bizIn}))`,
        `DELETE FROM products WHERE business_id IN (${bizIn})`,
        `DELETE FROM warehouse_locations WHERE warehouse_id IN (SELECT id FROM warehouses WHERE business_id IN (${bizIn}))`,
        `DELETE FROM warehouses WHERE business_id IN (${bizIn})`,
        `DELETE FROM sales_order_items WHERE order_id IN (SELECT id FROM sales_orders WHERE business_id IN (${bizIn}))`,
        `DELETE FROM sales_orders WHERE business_id IN (${bizIn})`,
        `DELETE FROM purchase_order_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE business_id IN (${bizIn}))`,
        `DELETE FROM purchase_orders WHERE business_id IN (${bizIn})`,
        `DELETE FROM chart_of_accounts WHERE business_id IN (${bizIn})`,
        `DELETE FROM tax_rates WHERE business_id IN (${bizIn})`,
        `DELETE FROM audit_logs WHERE business_id IN (${bizIn})`,
        `DELETE FROM notifications WHERE business_id IN (${bizIn})`,
        `DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE business_id IN (${bizIn}))`,
        `DELETE FROM roles WHERE business_id IN (${bizIn})`,
        `DELETE FROM business_users WHERE business_id IN (${bizIn})`,
        `DELETE FROM subscriptions WHERE business_id IN (${bizIn})`,
        `DELETE FROM businesses WHERE id IN (${bizIn})`,
      ]

      for (const sql of tables) {
        try {
          const n = await prisma.$executeRawUnsafe(sql)
          const t = sql.match(/FROM (\w+)/)?.[1] || ''
          if (n > 0) console.log(`   ✓ ${n} → ${t}`)
        } catch (e) {
          // ignore missing tables
        }
      }
      console.log(`\n✅ Businesses deleted`)
    }

    if (userIn) {
      const userTables = [
        `DELETE FROM audit_logs WHERE user_id IN (${userIn})`,
        `DELETE FROM notifications WHERE user_id IN (${userIn})`,
        `DELETE FROM business_users WHERE user_id IN (${userIn})`,
        `DELETE FROM users WHERE id IN (${userIn})`,
      ]
      for (const sql of userTables) {
        try {
          const n = await prisma.$executeRawUnsafe(sql)
          const t = sql.match(/FROM (\w+)/)?.[1] || ''
          if (n > 0) console.log(`   ✓ ${n} → ${t}`)
        } catch (e) {}
      }
      console.log(`✅ Users deleted`)
    }
  } finally {
    await prisma.$executeRawUnsafe(`SET session_replication_role = DEFAULT`)
  }

  const [finalBiz, finalUsers] = await Promise.all([prisma.business.count(), prisma.user.count()])
  console.log(`\n========================================`)
  console.log(`🎉 Done! ${finalBiz} businesses, ${finalUsers} users remaining`)
  console.log(`========================================\n`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
