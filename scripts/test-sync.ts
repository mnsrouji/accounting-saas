import { prisma } from '../src/lib/db/prisma'
import Decimal from 'decimal.js'

async function syncTreasuryBalances(businessId: string) {
  // 1. Fetch all cash accounts
  const cashAccounts = await prisma.cashAccount.findMany({
    where: { businessId },
    include: { account: true }
  })

  for (const ca of cashAccounts) {
    if (ca.accountId) {
      const lines = await prisma.journalEntryLine.findMany({
        where: {
          businessId,
          accountId: ca.accountId,
          journalEntry: { status: 'posted' }
        }
      })

      if (lines.length > 0) {
        const totalDebit = lines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const totalCredit = lines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
        const net = totalDebit.minus(totalCredit)

        await prisma.cashAccount.update({
          where: { id: ca.id },
          data: { balance: net }
        })

        await prisma.chartOfAccount.update({
          where: { id: ca.accountId },
          data: { balance: net }
        })

        console.log(`Updated CashAccount "${ca.name}" (${ca.id}) -> balance: ${net.toString()} (from GL [${ca.account?.code}] ${ca.account?.name})`)
      }
    }
  }

  // 2. Fetch all bank accounts
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { businessId },
    include: { account: true }
  })

  for (const ba of bankAccounts) {
    if (ba.accountId) {
      const lines = await prisma.journalEntryLine.findMany({
        where: {
          businessId,
          accountId: ba.accountId,
          journalEntry: { status: 'posted' }
        }
      })

      if (lines.length > 0) {
        const totalDebit = lines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const totalCredit = lines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
        const net = totalDebit.minus(totalCredit)

        await prisma.bankAccount.update({
          where: { id: ba.id },
          data: { balance: net }
        })

        await prisma.chartOfAccount.update({
          where: { id: ba.accountId },
          data: { balance: net }
        })

        console.log(`Updated BankAccount "${ba.accountName}" (${ba.id}) -> balance: ${net.toString()} (from GL [${ba.account?.code}] ${ba.account?.name})`)
      }
    }
  }

  // 3. Check for any Chart of Account of type 'asset' with cash/bank codes (1101 for cash, 1102 for bank) that have no CashAccount or BankAccount linked
  const unlinkedCashCOAs = await prisma.chartOfAccount.findMany({
    where: {
      businessId,
      isActive: true,
      code: { startsWith: '1101' },
      isHeader: false,
      cashAccounts: { none: {} }
    },
    include: {
      journalLines: {
        where: { journalEntry: { status: 'posted' } }
      }
    }
  })

  for (const coa of unlinkedCashCOAs) {
    const totalDebit = coa.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
    const totalCredit = coa.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
    const net = totalDebit.minus(totalCredit)

    const created = await prisma.cashAccount.create({
      data: {
        businessId,
        name: coa.name,
        code: coa.code,
        currencyCode: coa.currency || 'USD',
        openingBalance: net,
        balance: net,
        accountId: coa.id,
        isActive: true,
        isDefault: false,
        isPettyCash: coa.code.includes('02') || coa.name.includes('عهدة') || coa.name.includes('نثرية')
      }
    })
    console.log(`Auto-linked new CashAccount for GL [${coa.code}] "${coa.name}" -> balance: ${net.toString()}`)
  }
}

async function main() {
  const businessId = '3882a91b-9058-4252-a5da-c2dc7ab29e56'
  await syncTreasuryBalances(businessId)
}

main().catch(console.error).finally(() => prisma.$disconnect())
