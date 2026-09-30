// =============================================================
// Export Service — Financial Data & Reports Export Engine
// Supports CSV & XLSX (SpreadsheetML) Formats
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { ReportingService } from '@/lib/services/reporting-service'

export interface ColumnDefinition<T = any> {
  header: string
  key: string
  formatter?: (value: any, row: T) => string | number
}

export class ExportService {
  /**
   * Convert an array of objects to CSV format with RFC 4180 escaping.
   */
  static generateCSV<T = any>(data: T[], columns: ColumnDefinition<T>[]): string {
    const headerRow = columns.map((c) => this.escapeCSV(c.header)).join(',')
    const dataRows = data.map((row) => {
      return columns
        .map((c) => {
          let val = (row as any)[c.key]
          if (c.formatter) {
            val = c.formatter(val, row)
          }
          return this.escapeCSV(val === null || val === undefined ? '' : String(val))
        })
        .join(',')
    })

    return [headerRow, ...dataRows].join('\r\n')
  }

  /**
   * Generate clean XML-based Excel (SpreadsheetML / XLSX compatible) document string.
   */
  static generateXLSX<T = any>(sheetName: string, data: T[], columns: ColumnDefinition<T>[]): string {
    const safeSheetName = sheetName.replace(/[:\\/?*\[\]]/g, '').slice(0, 31) || 'Sheet1'

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`
    xml += `<?mso-application progid="Excel.Sheet"?>`
    xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`
    xml += ` xmlns:o="urn:schemas-microsoft-com:office:office"`
    xml += ` xmlns:x="urn:schemas-microsoft-com:office:excel"`
    xml += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"`
    xml += ` xmlns:html="http://www.w3.org/TR/REC-html40">`
    xml += `<Styles>`
    xml += `<Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/></Style>`
    xml += `<Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#4F46E5" ss:Pattern="Solid"/></Style>`
    xml += `<Style ss:ID="Currency"><NumberFormat ss:Format="#,##0.00"/></Style>`
    xml += `<Style ss:ID="Date"><NumberFormat ss:Format="YYYY-MM-DD"/></Style>`
    xml += `</Styles>`

    xml += `<Worksheet ss:Name="${this.escapeXML(safeSheetName)}">`
    xml += `<Table>`

    // Header Row
    xml += `<Row>`
    for (const col of columns) {
      xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${this.escapeXML(col.header)}</Data></Cell>`
    }
    xml += `</Row>`

    // Data Rows
    for (const row of data) {
      xml += `<Row>`
      for (const col of columns) {
        let val = (row as any)[col.key]
        if (col.formatter) {
          val = col.formatter(val, row)
        }

        if (typeof val === 'number') {
          xml += `<Cell ss:StyleID="Currency"><Data ss:Type="Number">${val}</Data></Cell>`
        } else {
          const strVal = val === null || val === undefined ? '' : String(val)
          xml += `<Cell><Data ss:Type="String">${this.escapeXML(strVal)}</Data></Cell>`
        }
      }
      xml += `</Row>`
    }

    xml += `</Table>`
    xml += `</Worksheet>`
    xml += `</Workbook>`

    return xml
  }

  private static escapeCSV(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }

  private static escapeXML(val: string): string {
    return val
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // =============================================================
  // FINANCIAL DATA EXPORTS
  // =============================================================

  /**
   * Export Sales Invoices.
   */
  static async exportSales(businessId: string, filters?: { fromDate?: Date; toDate?: Date; status?: string }) {
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        ...(filters?.fromDate ? { invoiceDate: { gte: filters.fromDate } } : {}),
        ...(filters?.toDate ? { invoiceDate: { lte: filters.toDate } } : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { invoiceDate: 'desc' },
    })

    const data = sales.map((s) => ({
      invoiceNumber: s.invoiceNumber,
      customer: s.customer?.name || 'Walk-in Customer',
      issueDate: s.invoiceDate.toISOString().split('T')[0],
      dueDate: s.dueDate ? s.dueDate.toISOString().split('T')[0] : '',
      currency: s.currencyCode,
      subtotal: Number(s.subtotal),
      tax: Number(s.taxAmount || 0),
      discount: Number(s.discountAmount || 0),
      total: Number(s.totalAmount),
      paid: Number(s.paidAmount || 0),
      remaining: Number(s.balanceDue || 0),
      status: s.status,
    }))

    const columns: ColumnDefinition[] = [
      { header: 'Invoice #', key: 'invoiceNumber' },
      { header: 'Customer', key: 'customer' },
      { header: 'Issue Date', key: 'issueDate' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Currency', key: 'currency' },
      { header: 'Subtotal', key: 'subtotal' },
      { header: 'Tax', key: 'tax' },
      { header: 'Discount', key: 'discount' },
      { header: 'Total', key: 'total' },
      { header: 'Paid', key: 'paid' },
      { header: 'Remaining', key: 'remaining' },
      { header: 'Status', key: 'status' },
    ]

    return { data, columns }
  }

  /**
   * Export Purchases.
   */
  static async exportPurchases(businessId: string, filters?: { fromDate?: Date; toDate?: Date; status?: string }) {
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        ...(filters?.fromDate ? { purchaseDate: { gte: filters.fromDate } } : {}),
        ...(filters?.toDate ? { purchaseDate: { lte: filters.toDate } } : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      include: { supplier: { select: { name: true } } },
      orderBy: { purchaseDate: 'desc' },
    })

    const data = purchases.map((p) => ({
      purchaseNumber: p.purchaseNumber,
      supplier: p.supplier?.name || 'Supplier',
      issueDate: p.purchaseDate.toISOString().split('T')[0],
      dueDate: p.dueDate ? p.dueDate.toISOString().split('T')[0] : '',
      currency: p.currencyCode,
      subtotal: Number(p.subtotal),
      tax: Number(p.taxAmount || 0),
      discount: Number(p.discountAmount || 0),
      total: Number(p.totalAmount),
      paid: Number(p.paidAmount || 0),
      remaining: Number(p.balanceDue || 0),
      status: p.status,
    }))

    const columns: ColumnDefinition[] = [
      { header: 'Purchase #', key: 'purchaseNumber' },
      { header: 'Supplier', key: 'supplier' },
      { header: 'Issue Date', key: 'issueDate' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Currency', key: 'currency' },
      { header: 'Subtotal', key: 'subtotal' },
      { header: 'Tax', key: 'tax' },
      { header: 'Discount', key: 'discount' },
      { header: 'Total', key: 'total' },
      { header: 'Paid', key: 'paid' },
      { header: 'Remaining', key: 'remaining' },
      { header: 'Status', key: 'status' },
    ]

    return { data, columns }
  }

  /**
   * Export Payments.
   */
  static async exportPayments(businessId: string, filters?: { fromDate?: Date; toDate?: Date; type?: string }) {
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        ...(filters?.fromDate ? { paymentDate: { gte: filters.fromDate } } : {}),
        ...(filters?.toDate ? { paymentDate: { lte: filters.toDate } } : {}),
        ...(filters?.type ? { type: filters.type as any } : {}),
      },
      include: { customer: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: { paymentDate: 'desc' },
    })

    const data = payments.map((p) => ({
      paymentNumber: p.paymentNumber,
      date: p.paymentDate.toISOString().split('T')[0],
      type: p.type,
      party: p.customer?.name || p.supplier?.name || 'General',
      amount: Number(p.amount),
      currency: p.currencyCode,
      method: p.method,
      reference: p.reference || '',
      status: p.status,
    }))

    const columns: ColumnDefinition[] = [
      { header: 'Payment #', key: 'paymentNumber' },
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Party', key: 'party' },
      { header: 'Amount', key: 'amount' },
      { header: 'Currency', key: 'currency' },
      { header: 'Method', key: 'method' },
      { header: 'Reference', key: 'reference' },
      { header: 'Status', key: 'status' },
    ]

    return { data, columns }
  }

  /**
   * Export Expenses.
   */
  static async exportExpenses(businessId: string, filters?: { fromDate?: Date; toDate?: Date }) {
    const expenses = await prisma.expense.findMany({
      where: {
        businessId,
        ...(filters?.fromDate ? { expenseDate: { gte: filters.fromDate } } : {}),
        ...(filters?.toDate ? { expenseDate: { lte: filters.toDate } } : {}),
      },
      include: {
        category: { select: { name: true } },
        account: { select: { name: true, code: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { expenseDate: 'desc' },
    })

    const data = expenses.map((e) => ({
      expenseNumber: e.expenseNumber,
      date: e.expenseDate.toISOString().split('T')[0],
      category: e.category?.name || 'General',
      account: e.account ? `${e.account.code} - ${e.account.name}` : '',
      supplier: e.supplier?.name || '',
      subtotal: Number(e.amount || e.totalAmount),
      tax: Number(e.taxAmount || 0),
      total: Number(e.totalAmount),
      currency: e.currencyCode,
      status: e.status,
    }))

    const columns: ColumnDefinition[] = [
      { header: 'Expense #', key: 'expenseNumber' },
      { header: 'Date', key: 'date' },
      { header: 'Category', key: 'category' },
      { header: 'Account', key: 'account' },
      { header: 'Supplier', key: 'supplier' },
      { header: 'Subtotal', key: 'subtotal' },
      { header: 'Tax', key: 'tax' },
      { header: 'Total', key: 'total' },
      { header: 'Currency', key: 'currency' },
      { header: 'Status', key: 'status' },
    ]

    return { data, columns }
  }

  /**
   * Export Journal Entries.
   */
  static async exportJournalEntries(businessId: string, filters?: { fromDate?: Date; toDate?: Date }) {
    const entries = await prisma.journalEntry.findMany({
      where: {
        businessId,
        ...(filters?.fromDate ? { entryDate: { gte: filters.fromDate } } : {}),
        ...(filters?.toDate ? { entryDate: { lte: filters.toDate } } : {}),
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { entryDate: 'desc' },
    })

    const flatRows: any[] = []
    for (const je of entries) {
      for (const line of je.lines) {
        flatRows.push({
          entryNumber: je.entryNumber,
          date: je.entryDate.toISOString().split('T')[0],
          accountCode: line.account.code,
          accountName: line.account.name,
          description: line.description || je.description || '',
          debit: Number(line.baseDebit),
          credit: Number(line.baseCredit),
          status: je.status,
          source: je.sourceType || 'manual',
        })
      }
    }

    const columns: ColumnDefinition[] = [
      { header: 'Entry #', key: 'entryNumber' },
      { header: 'Date', key: 'date' },
      { header: 'Account Code', key: 'accountCode' },
      { header: 'Account Name', key: 'accountName' },
      { header: 'Description', key: 'description' },
      { header: 'Debit', key: 'debit' },
      { header: 'Credit', key: 'credit' },
      { header: 'Status', key: 'status' },
      { header: 'Source', key: 'source' },
    ]

    return { data: flatRows, columns }
  }

  /**
   * Export Customers or Suppliers.
   */
  static async exportParties(businessId: string, type: 'customers' | 'suppliers') {
    if (type === 'customers') {
      const customers = await prisma.customer.findMany({
        where: { businessId, deletedAt: null },
        orderBy: { name: 'asc' },
      })
      const data = customers.map((c) => ({
        code: c.code || '',
        name: c.name,
        companyName: c.companyName || '',
        email: c.email || '',
        phone: c.phone || '',
        taxNumber: c.taxNumber || '',
        balance: Number(c.balance),
        currency: c.currency,
        status: c.isActive ? 'Active' : 'Inactive',
      }))
      const columns: ColumnDefinition[] = [
        { header: 'Code', key: 'code' },
        { header: 'Name', key: 'name' },
        { header: 'Company Name', key: 'companyName' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Tax ID', key: 'taxNumber' },
        { header: 'Balance', key: 'balance' },
        { header: 'Currency', key: 'currency' },
        { header: 'Status', key: 'status' },
      ]
      return { data, columns }
    } else {
      const suppliers = await prisma.supplier.findMany({
        where: { businessId, deletedAt: null },
        orderBy: { name: 'asc' },
      })
      const data = suppliers.map((s) => ({
        code: s.code || '',
        name: s.name,
        companyName: s.companyName || '',
        email: s.email || '',
        phone: s.phone || '',
        taxNumber: s.taxNumber || '',
        balance: Number(s.balance),
        currency: s.currency,
        status: s.isActive ? 'Active' : 'Inactive',
      }))
      const columns: ColumnDefinition[] = [
        { header: 'Code', key: 'code' },
        { header: 'Name', key: 'name' },
        { header: 'Company Name', key: 'companyName' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Tax ID', key: 'taxNumber' },
        { header: 'Balance', key: 'balance' },
        { header: 'Currency', key: 'currency' },
        { header: 'Status', key: 'status' },
      ]
      return { data, columns }
    }
  }

  // =============================================================
  // FINANCIAL REPORT EXPORTS
  // =============================================================

  /**
   * Export Profit & Loss Report.
   */
  static async exportProfitAndLoss(businessId: string, fromDate: Date, toDate: Date) {
    const pl = await ReportingService.getProfitAndLoss(businessId, fromDate, toDate)

    const rows: any[] = []
    // Revenue
    rows.push({ section: 'REVENUE', code: '', name: 'Operating Revenue', amount: '' })
    for (const acc of pl.revenue.items) {
      rows.push({ section: 'Revenue', code: acc.code, name: acc.name, amount: acc.amount })
    }
    rows.push({ section: 'Revenue Total', code: '', name: 'Total Revenue', amount: pl.revenue.total })

    // Cost of Sales
    rows.push({ section: 'COST OF SALES', code: '', name: 'Cost of Goods Sold', amount: '' })
    for (const acc of pl.costOfSales.items) {
      rows.push({ section: 'Cost of Sales', code: acc.code, name: acc.name, amount: acc.amount })
    }
    rows.push({ section: 'COGS Total', code: '', name: 'Total Cost of Sales', amount: pl.costOfSales.total })
    rows.push({ section: 'GROSS PROFIT', code: '', name: 'Gross Profit', amount: pl.grossProfit })

    // Operating Expenses
    rows.push({ section: 'OPERATING EXPENSES', code: '', name: 'Operating Expenses', amount: '' })
    for (const acc of pl.operatingExpenses.items) {
      rows.push({ section: 'Opex', code: acc.code, name: acc.name, amount: acc.amount })
    }
    rows.push({ section: 'Opex Total', code: '', name: 'Total Operating Expenses', amount: pl.operatingExpenses.total })
    rows.push({ section: 'OPERATING PROFIT', code: '', name: 'Operating Profit (EBIT)', amount: pl.operatingProfit })

    // Net Profit
    rows.push({ section: 'NET PROFIT', code: '', name: 'Net Profit / (Loss)', amount: pl.netProfit })

    const columns: ColumnDefinition[] = [
      { header: 'Section', key: 'section' },
      { header: 'Account Code', key: 'code' },
      { header: 'Account Name', key: 'name' },
      { header: 'Amount', key: 'amount' },
    ]

    return { data: rows, columns, title: `Profit and Loss (${pl.fromDate} to ${pl.toDate})` }
  }

  /**
   * Export Balance Sheet Report.
   */
  static async exportBalanceSheet(businessId: string, asOfDate: Date) {
    const bs = await ReportingService.getBalanceSheet(businessId, asOfDate)

    const rows: any[] = []
    // Assets
    rows.push({ category: 'ASSETS', type: 'Current Assets', code: '', name: '', amount: '' })
    for (const acc of bs.assets.current.items) {
      rows.push({ category: 'Assets', type: 'Current', code: acc.code, name: acc.name, amount: acc.amount })
    }
    for (const acc of bs.assets.nonCurrent.items) {
      rows.push({ category: 'Assets', type: 'Non-Current', code: acc.code, name: acc.name, amount: acc.amount })
    }
    rows.push({ category: 'TOTAL ASSETS', type: '', code: '', name: 'Total Assets', amount: bs.assets.total })

    // Liabilities
    rows.push({ category: 'LIABILITIES', type: 'Current Liabilities', code: '', name: '', amount: '' })
    for (const acc of bs.liabilities.current.items) {
      rows.push({ category: 'Liabilities', type: 'Current', code: acc.code, name: acc.name, amount: acc.amount })
    }
    for (const acc of bs.liabilities.nonCurrent.items) {
      rows.push({ category: 'Liabilities', type: 'Non-Current', code: acc.code, name: acc.name, amount: acc.amount })
    }
    rows.push({ category: 'TOTAL LIABILITIES', type: '', code: '', name: 'Total Liabilities', amount: bs.liabilities.total })

    // Equity
    rows.push({ category: 'EQUITY', type: 'Equity Accounts', code: '', name: '', amount: '' })
    for (const acc of bs.equity.items) {
      rows.push({ category: 'Equity', type: 'Equity', code: acc.code, name: acc.name, amount: acc.amount })
    }
    rows.push({ category: 'TOTAL EQUITY', type: '', code: '', name: 'Total Equity', amount: bs.equity.total })
    rows.push({ category: 'TOTAL LIABILITIES & EQUITY', type: '', code: '', name: 'Total Liabilities & Equity', amount: bs.totalLiabilitiesAndEquity })

    const columns: ColumnDefinition[] = [
      { header: 'Category', key: 'category' },
      { header: 'Type', key: 'type' },
      { header: 'Account Code', key: 'code' },
      { header: 'Account Name', key: 'name' },
      { header: 'Amount', key: 'amount' },
    ]

    return { data: rows, columns, title: `Balance Sheet as of ${bs.asOfDate}` }
  }

  /**
   * Export AR or AP Aging Report.
   */
  static async exportAging(businessId: string, type: 'ar' | 'ap', asOfDate: Date = new Date()) {
    const summary = type === 'ar' ? await ReportingService.getARAgingSummary(businessId, asOfDate) : await ReportingService.getAPAgingSummary(businessId, asOfDate)

    const rows = summary.rows.map((r: any) => ({
      name: type === 'ar' ? r.customerName : r.supplierName,
      docNumber: type === 'ar' ? r.invoiceNumber : r.purchaseNumber,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      balanceDue: r.balanceDue,
      ageDays: r.ageDays,
      bucket: r.bucket,
    }))

    const columns: ColumnDefinition[] = [
      { header: type === 'ar' ? 'Customer' : 'Supplier', key: 'name' },
      { header: 'Document #', key: 'docNumber' },
      { header: 'Total Amount', key: 'totalAmount' },
      { header: 'Paid', key: 'paidAmount' },
      { header: 'Balance Due', key: 'balanceDue' },
      { header: 'Age (Days)', key: 'ageDays' },
      { header: 'Bucket', key: 'bucket' },
    ]

    return { data: rows, columns, title: `${type.toUpperCase()} Aging Summary` }
  }

  /**
   * Export Cash Flow Statement.
   */
  static async exportCashFlow(businessId: string, fromDate: Date, toDate: Date) {
    const cf = await ReportingService.getCashFlow(businessId, fromDate, toDate)

    const rows = [
      { section: 'Opening Balance', item: 'Beginning Cash & Equivalents', amount: cf.openingCash },
      { section: 'Operating Activities', item: 'Operating Cash Flow', amount: cf.operating.total },
      { section: 'Investing Activities', item: 'Investing Cash Flow', amount: cf.investing.total },
      { section: 'Financing Activities', item: 'Financing Cash Flow', amount: cf.financing.total },
      { section: 'Net Change', item: 'Net Cash Flow', amount: cf.netCashFlow },
      { section: 'Closing Balance', item: 'Ending Cash & Equivalents', amount: cf.closingCash },
    ]

    const columns: ColumnDefinition[] = [
      { header: 'Section', key: 'section' },
      { header: 'Item', key: 'item' },
      { header: 'Amount', key: 'amount' },
    ]

    return { data: rows, columns, title: `Cash Flow Statement (${cf.fromDate} to ${cf.toDate})` }
  }

  /**
   * Export Inventory Valuation.
   */
  static async exportInventoryValuation(businessId: string) {
    const inv = await ReportingService.getInventoryValuation(businessId)

    const rows = inv.rows.map((item: any) => ({
      sku: item.productCode || '',
      name: item.productName,
      category: item.category || 'General',
      warehouse: item.warehouseName || 'Default',
      quantityOnHand: item.quantity,
      unitCost: item.averageCost,
      totalValuation: item.totalValue,
    }))

    const columns: ColumnDefinition[] = [
      { header: 'SKU', key: 'sku' },
      { header: 'Product Name', key: 'name' },
      { header: 'Category', key: 'category' },
      { header: 'Warehouse', key: 'warehouse' },
      { header: 'Quantity On Hand', key: 'quantityOnHand' },
      { header: 'Unit Cost (WAC)', key: 'unitCost' },
      { header: 'Total Valuation', key: 'totalValuation' },
    ]

    return { data: rows, columns, title: `Inventory Valuation` }
  }
}
