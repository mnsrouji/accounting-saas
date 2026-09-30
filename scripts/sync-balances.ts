import { TreasuryAccountService } from '../src/lib/services/treasury-account-service'
import { prisma } from '../src/lib/db/prisma'

async function main() {
  const businesses = await prisma.business.findMany()
  for (const b of businesses) {
    await TreasuryAccountService.syncTreasuryBalances(b.id)
    console.log(`Synced balances for business: ${b.name} (${b.id})`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
