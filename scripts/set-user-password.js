const { createClient } = require('@supabase/supabase-js')
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const envLines = fs.readFileSync('.env', 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const idx = line.indexOf('=')
  if (idx !== -1) {
    const k = line.slice(0, idx).trim()
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[k] = v
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || 'noursrouji.m@gmail.com'
  const password = process.argv[3] || 'Password123!'

  console.log(`Setting password for ${email}...`)

  // 1. Check existing Prisma user
  let dbUser = await prisma.user.findUnique({ where: { email } })
  console.log('Existing Prisma DB User:', dbUser?.id)

  // 2. Check auth.users table
  const authRecords = await prisma.$queryRawUnsafe(`SELECT id, email FROM auth.users WHERE email = $1`, email)
  console.log('auth.users records:', authRecords)

  let authUserId
  if (authRecords && authRecords.length > 0) {
    authUserId = authRecords[0].id
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password: password,
      email_confirm: true,
    })
    if (error) throw error
    console.log(`✅ Updated existing auth user password to: ${password}`)
  } else {
    // If dbUser exists, let's delete or update it, or pass its ID to createUser
    if (dbUser) {
      // Temporarily remove or use dbUser.id
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          id: dbUser.id,
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: dbUser.fullName || 'Nour Srouji' },
        })
        if (error) throw error
        authUserId = data.user.id
      } catch (err) {
        console.log('Create with custom id failed, trying alternative:', err.message)
        // If unique constraint conflict, delete dbUser row temporarily
        await prisma.$executeRawUnsafe(`DELETE FROM public.users WHERE email = $1`, email)
        const { data, error } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: 'Nour Srouji' },
        })
        if (error) throw error
        authUserId = data.user.id
      }
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: 'Nour Srouji' },
      })
      if (error) throw error
      authUserId = data.user.id
    }
    console.log(`✅ Created new auth user (${authUserId}) with password: ${password}`)
  }

  // Ensure user is in Prisma and is Super Admin
  dbUser = await prisma.user.upsert({
    where: { email },
    update: { isSuperAdmin: true, status: 'active' },
    create: {
      id: authUserId,
      email,
      fullName: 'Nour Srouji',
      isSuperAdmin: true,
      status: 'active',
    },
  })

  console.log(`✅ Prisma DB User: ${dbUser.id} (${dbUser.email}) — SuperAdmin: ${dbUser.isSuperAdmin}`)

  // Link to all active businesses
  const businesses = await prisma.business.findMany()
  for (const b of businesses) {
    await prisma.businessUser.upsert({
      where: {
        userId_businessId: {
          userId: dbUser.id,
          businessId: b.id,
        },
      },
      update: { role: 'owner', status: 'active' },
      create: {
        userId: dbUser.id,
        businessId: b.id,
        role: 'owner',
        status: 'active',
      },
    })
    console.log(`   🔗 Linked to: ${b.name}`)
  }

  console.log('\n🎉 SUCCESS!')
  console.log(`   Email   : ${email}`)
  console.log(`   Password: ${password}\n`)
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect()
    process.exit(0)
  })
