import { TreasuryDashboardService } from '../src/lib/services/treasury-dashboard-service'
import { CashPositionService } from '../src/lib/services/cash-position-service'
import { prisma } from '../src/lib/db/prisma'

async function main() {
  const businessId = '3882a91b-9058-4252-a5da-c2dc7ab29e56'
  const metrics = await TreasuryDashboardService.getDashboardMetrics(businessId)
  console.log('Treasury Dashboard Metrics for Demo Trading Company:')
  console.log(metrics)

  const pos = await CashPositionService.getCashPosition({ businessId })
  console.log('\nCash Position Summary:')
  console.log(JSON.stringify(pos, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
