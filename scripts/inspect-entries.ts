import { prisma } from '../src/lib/db/prisma'

async function main() {
  const businessId = '3882a91b-9058-4252-a5da-c2dc7ab29e56'
  const entries = await prisma.journalEntry.findMany({
    where: { businessId },
    include: {
      lines: {
        include: { account: true }
      }
    }
  })

  console.log('Total Journal Entries for Demo Trading Company:', entries.length)
  for (const e of entries) {
    console.log(`\nEntry #${e.entryNumber} (${e.entryDate.toISOString().slice(0, 10)}) - ${e.description || 'No desc'} - Status: ${e.status}`)
    for (const l of e.lines) {
      console.log(`  Line: [${l.account.code}] ${l.account.name} | Debit: ${l.debitAmount} | Credit: ${l.creditAmount} | Desc: ${l.description}`)
    }
  }

  // Also check all cash accounts and their linked chart of accounts balances
  const cashAccounts = await prisma.cashAccount.findMany({
    where: { businessId },
    include: { account: true }
  })
  console.log('\n--- Cash Accounts in DB ---')
  for (const c of cashAccounts) {
    console.log(`CashAccount: "${c.name}" (ID: ${c.id}), balance field = ${c.balance}, linked to GL Account: [${c.account?.code}] ${c.account?.name} (GL cached balance: ${c.account?.balance})`)
  }

  // Also calculate true GL balance from journal lines for account 110101
  const glLines = await prisma.journalEntryLine.findMany({
    where: {
      businessId,
      account: { code: '110101' },
      journalEntry: { status: 'posted' }
    }
  })
  console.log('\n--- Posted Journal Lines for Account 110101 ---')
  let netGlBalance = 0
  for (const g of glLines) {
    console.log(`  JE Line: Debit=${g.debitAmount}, Credit=${g.creditAmount}, Desc=${g.description}`)
    netGlBalance += Number(g.debitAmount) - Number(g.creditAmount)
  }
  console.log(`Net GL Balance for 110101 = ${netGlBalance}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
