// =============================================================
// Bank Statement Service — Statement Import & Line Management
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  importBankStatementSchema,
  ImportBankStatementInput,
  BankStatementLineInput,
} from '@/lib/validations/treasury-schemas'
import {
  TreasuryAccountNotFoundError,
  TreasuryError,
  ReconciliationClosedError,
} from '@/lib/errors/treasury-error'
import { AuditService } from './audit-service'

export class BankStatementService {
  /**
   * Import a structured bank statement with line items.
   */
  static async importStatement(input: ImportBankStatementInput) {
    const validated = importBankStatementSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      // 1. Validate Bank Account
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: validated.bankAccountId, businessId: validated.businessId },
      })
      if (!bankAccount) {
        throw new TreasuryAccountNotFoundError(validated.bankAccountId, 'Bank Account')
      }

      // 2. Check if statement already exists
      const existing = await tx.bankStatement.findFirst({
        where: {
          businessId: validated.businessId,
          bankAccountId: validated.bankAccountId,
          statementNumber: validated.statementNumber,
        },
      })
      if (existing) {
        throw new TreasuryError(`Statement number "${validated.statementNumber}" already exists for this bank account.`)
      }

      // 3. Compute Debits and Credits summary
      let totalDebits = new Decimal(0)
      let totalCredits = new Decimal(0)

      for (const line of validated.lines) {
        totalDebits = totalDebits.plus(new Decimal(line.debitAmount || 0))
        totalCredits = totalCredits.plus(new Decimal(line.creditAmount || 0))
      }

      // 4. Create Bank Statement header
      const statement = await tx.bankStatement.create({
        data: {
          businessId: validated.businessId,
          bankAccountId: validated.bankAccountId,
          statementNumber: validated.statementNumber,
          startDate: validated.startDate,
          endDate: validated.endDate,
          openingBalance: new Decimal(validated.openingBalance),
          closingBalance: new Decimal(validated.closingBalance),
          totalDebits,
          totalCredits,
          currencyCode: validated.currencyCode,
          status: 'imported',
          importedBy: validated.userId,
        },
      })

      // 5. Create statement lines
      let lineNum = 1
      for (const line of validated.lines) {
        const debit = new Decimal(line.debitAmount || 0)
        const credit = new Decimal(line.creditAmount || 0)
        const netAmount = new Decimal(line.amount !== undefined ? line.amount : credit.minus(debit))

        await tx.bankStatementLine.create({
          data: {
            businessId: validated.businessId,
            statementId: statement.id,
            transactionDate: line.transactionDate,
            valueDate: line.valueDate || line.transactionDate,
            description: line.description,
            reference: line.reference,
            debitAmount: debit,
            creditAmount: credit,
            amount: netAmount,
            currencyCode: line.currencyCode || validated.currencyCode,
            externalId: line.externalId,
            lineNumber: line.lineNumber || lineNum++,
            isMatched: false,
          },
        })
      }

      // 6. Audit log
      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_statement',
          entityId: statement.id,
          action: 'create',
          newData: {
            statementNumber: statement.statementNumber,
            bankAccount: bankAccount.bankName,
            linesCount: validated.lines.length,
            openingBalance: validated.openingBalance,
            closingBalance: validated.closingBalance,
          },
        },
        tx
      )

      return tx.bankStatement.findUnique({
        where: { id: statement.id },
        include: { lines: { orderBy: { lineNumber: 'asc' } }, bankAccount: true },
      })
    })
  }

  /**
   * Helper to parse CSV string content into structured statement lines.
   */
  static parseCsvLines(csvContent: string): BankStatementLineInput[] {
    const rawLines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (rawLines.length < 2) {
      throw new TreasuryError('CSV must contain a header and at least one transaction row.')
    }

    const header = rawLines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    const dateIdx = header.findIndex((h) => h.includes('date') && !h.includes('val'))
    const valDateIdx = header.findIndex((h) => h.includes('val') || h.includes('value date'))
    const descIdx = header.findIndex((h) => h.includes('desc') || h.includes('narration') || h.includes('details') || h.includes('memo'))
    const refIdx = header.findIndex((h) => h.includes('ref') || h.includes('chq') || h.includes('cheque'))
    const debitIdx = header.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h.includes('out'))
    const creditIdx = header.findIndex((h) => h.includes('credit') || h.includes('deposit') || h.includes('in'))
    const amountIdx = header.findIndex((h) => h.includes('amount') || h.includes('net'))
    const extIdIdx = header.findIndex((h) => h.includes('id') || h.includes('txn') || h.includes('external'))

    const parsedLines: BankStatementLineInput[] = []

    for (let i = 1; i < rawLines.length; i++) {
      const row = rawLines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      if (row.length < 2 || !row.some((c) => c.length > 0)) continue

      const dateStr = dateIdx >= 0 ? row[dateIdx] : row[0]
      const txDate = new Date(dateStr)
      if (isNaN(txDate.getTime())) continue

      const desc = descIdx >= 0 && row[descIdx] ? row[descIdx] : 'Bank Transaction'
      const ref = refIdx >= 0 ? row[refIdx] : undefined
      const extId = extIdIdx >= 0 ? row[extIdIdx] : undefined

      let debit = 0
      let credit = 0
      let amount = 0

      if (debitIdx >= 0 && creditIdx >= 0) {
        debit = parseFloat(row[debitIdx]) || 0
        credit = parseFloat(row[creditIdx]) || 0
        amount = credit - debit
      } else if (amountIdx >= 0) {
        amount = parseFloat(row[amountIdx]) || 0
        if (amount < 0) {
          debit = Math.abs(amount)
        } else {
          credit = amount
        }
      }

      parsedLines.push({
        transactionDate: txDate,
        valueDate: valDateIdx >= 0 && row[valDateIdx] ? new Date(row[valDateIdx]) : txDate,
        description: desc,
        reference: ref,
        debitAmount: debit,
        creditAmount: credit,
        amount,
        currencyCode: 'USD',
        externalId: extId,
        lineNumber: i,
      })
    }

    return parsedLines
  }

  static async getStatements(businessId: string, filter?: { bankAccountId?: string; status?: string }) {
    const where: any = { businessId }
    if (filter?.bankAccountId) where.bankAccountId = filter.bankAccountId
    if (filter?.status) where.status = filter.status

    return prisma.bankStatement.findMany({
      where,
      include: { bankAccount: true, _count: { select: { lines: true } } },
      orderBy: { startDate: 'desc' },
    })
  }

  static async getStatementById(businessId: string, id: string) {
    const statement = await prisma.bankStatement.findFirst({
      where: { id, businessId },
      include: {
        bankAccount: true,
        lines: { orderBy: { lineNumber: 'asc' } },
        reconciliations: true,
      },
    })
    if (!statement) {
      throw new TreasuryError(`Bank statement ${id} was not found.`)
    }
    return statement
  }

  static async deleteStatement(businessId: string, id: string, userId: string) {
    const statement = await prisma.bankStatement.findFirst({
      where: { id, businessId },
      include: { reconciliations: true },
    })
    if (!statement) {
      throw new TreasuryError(`Bank statement ${id} was not found.`)
    }

    if (statement.status === 'closed' || statement.reconciliations.some((r) => r.status === 'closed')) {
      throw new ReconciliationClosedError(statement.statementNumber)
    }

    await prisma.bankStatement.delete({ where: { id } })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'bank_statement',
      entityId: id,
      action: 'delete',
      oldData: { statementNumber: statement.statementNumber },
    })

    return { success: true }
  }
}
