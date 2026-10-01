/**
 * Script: Promote a user to Super Admin by email
 * 
 * Usage:
 *   node scripts/promote-super-admin.js user@example.com "Optional note"
 * 
 * Or with npx tsx:
 *   npx tsx scripts/promote-super-admin.ts user@example.com "Optional note"
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const note = process.argv[3] || 'Initial Super Admin'

  if (!email) {
    console.error('❌  Usage: node scripts/promote-super-admin.js <email> [note]')
    process.exit(1)
  }

  console.log(`\n🔍 Looking up user: ${email}`)

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, isSuperAdmin: true },
  })

  if (!user) {
    console.error(`❌  No user found with email: ${email}`)
    console.error('    Make sure the user has registered an account first.')
    process.exit(1)
  }

  if (user.isSuperAdmin) {
    console.log(`✅  ${user.fullName} (${user.email}) is already a Super Admin.`)
    process.exit(0)
  }

  const updated = await prisma.user.update({
    where: { email },
    data: {
      isSuperAdmin: true,
      superAdminNote: note,
    },
  })

  console.log(`\n✅  SUCCESS! Super Admin granted:`)
  console.log(`    Name : ${updated.fullName}`)
  console.log(`    Email: ${updated.email}`)
  console.log(`    Note : ${note}`)
  console.log(`\n🔗  Admin Panel: /admin/super-admins\n`)
}

main()
  .catch((err) => {
    console.error('❌  Error:', err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
