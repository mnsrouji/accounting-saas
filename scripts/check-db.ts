import { prisma } from '../src/lib/db/prisma'

async function main() {
  const businesses = await prisma.business.findMany({
    include: {
      cashAccounts: { include: { account: true } },
      bankAccounts: { include: { account: true } },
    }
  })

  for (const b of businesses) {
    console.log('=== Business:', b.id, b.name, '===')
    console.log('Cash Accounts:', b.cashAccounts.map(c => ({ id: c.id, name: c.name, balance: c.balance.toString(), accountId: c.accountId, glCode: c.account?.code, glName: c.account?.name })))
    console.log('Bank Accounts:', b.bankAccounts.map(b => ({ id: b.id, name: b.accountName, balance: b.balance.toString(), accountId: b.accountId, glCode: b.account?.code, glName: b.account?.name })))

    // Check all chart of accounts for cash/bank
    const coa = await prisma.chartOfAccount.findMany({
      where: { businessId: b.id },
      include: {
        journalLines: true
      }
    })

    console.log('\nChart of Accounts with Journal Lines:')
    for (const acc of coa) {
      const totalDebit = acc.journalLines.reduce((s, l) => s + Number(l.debitAmount), 0)
      const totalCredit = acc.journalLines.reduce((s, l) => s + Number(l.creditAmount), 0)
      const net = totalDebit - totalCredit
      if (acc.journalLines.length > 0 || net !== 0) {
        console.log(`  [${acc.code}] ${acc.name} (${acc.type}): Debit=${totalDebit}, Credit=${totalCredit}, Net=${net}, LinesCount=${acc.journalLines.length}`)
      }
    }

    // Check payments, sales, cash transactions, bank transactions
    const cashTxns = await prisma.cashTransaction.findMany({ where: { businessId: b.id } })
    const bankTxns = await prisma.bankTransaction.findMany({ where: { businessId: b.id } })
    const payments = await prisma.payment.findMany({ where: { businessId: b.id } })
    const sales = await prisma.sale.findMany({ where: { businessId: b.id } })
    const purchases = await prisma.purchase.findMany({ where: { businessId: b.id } })

    console.log(`\nCounts: cashTxns=${cashTxns.length}, bankTxns=${bankTxns.length}, payments=${payments.length}, sales=${sales.length}, purchases=${purchases.length}`)
    if (payments.length > 0) {
      console.log('Payments details:', payments.map(p => ({ id: p.id, amount: p.amount.toString(), type: p.type })))
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
