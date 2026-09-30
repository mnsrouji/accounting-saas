import { prisma } from '../src/lib/db/prisma'

async function main() {
  const b = await prisma.business.findFirst({ where: { id: '3882a91b-9058-4252-a5da-c2dc7ab29e56' } })
  if (!b) return
  console.log('=== Business:', b.name, b.id, '===')

  // 1. Chart of accounts summary
  const coas = await prisma.chartOfAccount.findMany({
    where: { businessId: b.id },
    include: { journalLines: { where: { journalEntry: { status: 'posted' } } } },
    orderBy: { code: 'asc' },
  })
  console.log('\n--- All Chart of Accounts ---')
  for (const c of coas) {
    const dr = c.journalLines.reduce((s, l) => s + Number(l.debitAmount), 0)
    const cr = c.journalLines.reduce((s, l) => s + Number(l.creditAmount), 0)
    const net = c.normalBalance === 'debit' ? (dr - cr) : (cr - dr)
    console.log(`  [${c.code}] ${c.name} (${c.type}, normal:${c.normalBalance}): Dr=${dr}, Cr=${cr}, Bal=${net}`)
  }

  // 2. Sales
  const sales = await prisma.sale.findMany({ where: { businessId: b.id } })
  console.log('\n--- Sales (' + sales.length + ') ---')
  sales.forEach((s) => console.log(`  Sale #${s.invoiceNumber}: total=${s.totalAmount}, balanceDue=${s.balanceDue}, status=${s.status}`))

  // 3. Purchases
  const purchases = await prisma.purchase.findMany({ where: { businessId: b.id } })
  console.log('\n--- Purchases (' + purchases.length + ') ---')
  purchases.forEach((p) => console.log(`  Purchase #${p.purchaseNumber}: total=${p.totalAmount}, balanceDue=${p.balanceDue}, status=${p.status}`))

  // 4. Customers
  const customers = await prisma.customer.findMany({ where: { businessId: b.id } })
  console.log('\n--- Customers (' + customers.length + ') ---')
  customers.forEach((c) => console.log(`  Customer: ${c.name}`))

  // 5. Suppliers
  const suppliers = await prisma.supplier.findMany({ where: { businessId: b.id } })
  console.log('\n--- Suppliers (' + suppliers.length + ') ---')
  suppliers.forEach((s) => console.log(`  Supplier: ${s.name}`))

  // 6. Expenses
  const expenses = await prisma.expense.findMany({ where: { businessId: b.id } })
  console.log('\n--- Expenses (' + expenses.length + ') ---')
  expenses.forEach((e) => console.log(`  Expense #${e.expenseNumber}: amount=${e.amount}, status=${e.status}`))

  // 7. Inventory
  const inv = await prisma.inventoryBalance.findMany({ where: { businessId: b.id }, include: { product: true } })
  console.log('\n--- Inventory (' + inv.length + ') ---')
  let totalInv = 0
  inv.forEach((i) => {
    const val = Number(i.quantity) * Number(i.averageCost)
    totalInv += val
    console.log(`  Product: ${i.product?.name}, qty=${i.quantity}, avgCost=${i.averageCost}, val=${val}`)
  })
  console.log('Total Inv Val:', totalInv)

  // 8. Cash Accounts
  const cashAccounts = await prisma.cashAccount.findMany({ where: { businessId: b.id }, include: { account: true } })
  console.log('\n--- Cash Accounts (' + cashAccounts.length + ') ---')
  cashAccounts.forEach((c) => console.log(`  Cash Account: ${c.name}, balance=${c.balance}, mapped=${c.account?.code}`))

  // 9. Bank Accounts
  const bankAccounts = await prisma.bankAccount.findMany({ where: { businessId: b.id }, include: { account: true } })
  console.log('\n--- Bank Accounts (' + bankAccounts.length + ') ---')
  bankAccounts.forEach((ba) => console.log(`  Bank Account: ${ba.accountName}, balance=${ba.balance}, mapped=${ba.account?.code}`))

  // 10. Journal Entries
  const jes = await prisma.journalEntry.findMany({ where: { businessId: b.id }, include: { lines: { include: { account: true } } } })
  console.log('\n--- Journal Entries (' + jes.length + ') ---')
  jes.forEach((j) => {
    console.log(`  JE #${j.entryNumber} (${j.status}) - ${j.description} [${j.entryDate.toISOString().slice(0, 10)}]`)
    j.lines.forEach((l) => console.log(`    -> [${l.account?.code}] ${l.account?.name}: Dr=${l.debitAmount}, Cr=${l.creditAmount}`))
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
