const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const [businesses, users, businessSample, userSample] = await Promise.all([
    prisma.business.count(),
    prisma.user.count(),
    prisma.business.findMany({
      select: { id: true, name: true, email: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.user.findMany({
      select: { id: true, email: true, fullName: true, status: true, createdAt: true, isSuperAdmin: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  console.log('\n========================================')
  console.log(`📊 Total Businesses: ${businesses}`)
  console.log(`👥 Total Users: ${users}`)
  
  console.log('\n--- Last 10 Businesses ---')
  businessSample.forEach(b => {
    console.log(`  [${b.status}] ${b.name} | ${b.email || 'no-email'} | ${b.createdAt.toISOString().slice(0,10)}`)
  })

  console.log('\n--- Last 10 Users ---')
  userSample.forEach(u => {
    console.log(`  [${u.status}]${u.isSuperAdmin ? ' 👑' : ''} ${u.fullName} | ${u.email} | ${u.createdAt.toISOString().slice(0,10)}`)
  })
  console.log('========================================\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
