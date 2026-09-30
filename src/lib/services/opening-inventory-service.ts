import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db/prisma'
import { Decimal } from 'decimal.js'

export interface ParsedOpeningStockRow {
  rowIndex: number
  sku: string
  name: string
  warehouseCode: string
  warehouseId?: string
  unitOfMeasure: string
  quantity: number
  unitCost: number
  salePrice: number
  description?: string | null
  totalValue: number
  isExistingProduct: boolean
  status: 'valid' | 'warning' | 'error'
  errors: string[]
  warnings: string[]
}

export interface OpeningStockValidationSummary {
  totalRows: number
  validCount: number
  errorCount: number
  newProductsCount: number
  existingProductsCount: number
  totalQuantity: number
  totalValuation: number
  rows: ParsedOpeningStockRow[]
  canImport: boolean
  defaultWarehouse?: { id: string; code: string; name: string } | null
  suggestedInventoryAccount?: { id: string; code: string; name: string } | null
  suggestedEquityAccount?: { id: string; code: string; name: string } | null
}

export interface OpeningStockImportOptions {
  postOpeningJournalEntry: boolean
  openingDate: string
  inventoryAccountId?: string
  equityAccountId?: string
  defaultWarehouseId?: string
}

export class OpeningInventoryService {
  /**
   * Generate an official ready-to-fill Excel template for Opening Inventory
   */
  static async generateTemplate(businessId: string, defaultCurrency = 'SAR'): Promise<Buffer> {
    const warehouses = await prisma.warehouse.findMany({
      where: { businessId, isActive: true },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    })

    const primaryWarehouseCode = warehouses[0]?.code || 'MAIN'

    const wb = XLSX.utils.book_new()

    // Sheet 1: Template Data with representative sample rows
    const sampleData = [
      {
        'كود الصنف / الباركود (SKU / Barcode) *': 'PRD-1001',
        'اسم الصنف (Item Name) *': 'لابتوب ديل انسبيرون 15',
        'كود المستودع (Warehouse Code) *': primaryWarehouseCode,
        'وحدة القياس (Unit)': 'قطعة',
        'الكمية الافتتاحية (Quantity) *': 20,
        'سعر التكلفة للوحدة (Unit Cost) *': 2200.0,
        'سعر البيع الافتراضي (Sale Price)': 2850.0,
        'الوصف / التصنيف (Description)': 'مخزون أجهزة كمبيوتر أول المدة',
      },
      {
        'كود الصنف / الباركود (SKU / Barcode) *': 'PRD-1002',
        'اسم الصنف (Item Name) *': 'شاشة سامسونج 27 بوصة 4K',
        'كود المستودع (Warehouse Code) *': primaryWarehouseCode,
        'وحدة القياس (Unit)': 'قطعة',
        'الكمية الافتتاحية (Quantity) *': 35,
        'سعر التكلفة للوحدة (Unit Cost) *': 850.0,
        'سعر البيع الافتراضي (Sale Price)': 1150.0,
        'الوصف / التصنيف (Description)': 'شاشات عرض',
      },
      {
        'كود الصنف / الباركود (SKU / Barcode) *': 'PRD-1003',
        'اسم الصنف (Item Name) *': 'لوحة مفاتيح وماوس لاسلكي لوجيتك',
        'كود المستودع (Warehouse Code) *': primaryWarehouseCode,
        'وحدة القياس (Unit)': 'طقم',
        'الكمية الافتتاحية (Quantity) *': 100,
        'سعر التكلفة للوحدة (Unit Cost) *': 95.0,
        'سعر البيع الافتراضي (Sale Price)': 145.0,
        'الوصف / التصنيف (Description)': 'ملحقات وإكسسوارات',
      },
      {
        'كود الصنف / الباركود (SKU / Barcode) *': 'PRD-1004',
        'اسم الصنف (Item Name) *': 'كابل HDMI فائق السرعة 2 متر',
        'كود المستودع (Warehouse Code) *': primaryWarehouseCode,
        'وحدة القياس (Unit)': 'حبة',
        'الكمية الافتتاحية (Quantity) *': 250,
        'سعر التكلفة للوحدة (Unit Cost) *': 12.5,
        'سعر البيع الافتراضي (Sale Price)': 25.0,
        'الوصف / التصنيف (Description)': 'وصلات وكابلات',
      },
    ]

    const wsData = XLSX.utils.json_to_sheet(sampleData)

    wsData['!cols'] = [
      { wch: 22 }, // SKU
      { wch: 35 }, // Name
      { wch: 18 }, // Warehouse Code
      { wch: 14 }, // Unit
      { wch: 16 }, // Quantity
      { wch: 20 }, // Unit Cost
      { wch: 20 }, // Sale Price
      { wch: 35 }, // Description
    ]

    XLSX.utils.book_append_sheet(wb, wsData, 'بضاعة أول المدة')

    // Sheet 2: Guide & Instructions
    const instructions = [
      { 'الإرشادات والمحددات المحاسبية': '1. الحقول المؤشر عليها بـ (*) إلزامية (كود الصنف، اسم الصنف، كود المستودع، الكمية، سعر التكلفة).' },
      { 'الإرشادات والمحددات المحاسبية': '2. كود الصنف (SKU): يجب أن يكون فريداً لكل منتج لتمييز بطاقة الصنف في المستودع.' },
      { 'الإرشادات والمحددات المحاسبية': '3. سعر التكلفة (Unit Cost): هو تكلفة الشراء للوحدة الواحدة بدون ضريبة، ويُعتمد كأساس لتقييم المخزون الأولي (WAC).' },
      { 'الإرشادات والمحددات المحاسبية': '4. إجمالي قيمة بضاعة أول المدة = (الكمية × سعر التكلفة).' },
      { 'الإرشادات والمحددات المحاسبية': '5. المطابقة مع القيد الافتتاحي (General Ledger Match):' },
      { 'الإرشادات والمحددات المحاسبية': '   - يقدم النظام خيار التوليد التلقائي للقيد الافتتاحي:' },
      { 'الإرشادات والمحددات المحاسبية': '     * من حـ/ مخزون البضائع (الأصول المتداولة - 1400) [مدين بإجمالي التقييم]' },
      { 'الإرشادات والمحددات المحاسبية': '     * إلى حـ/ رأس المال أو الأرصدة الافتتاحية (حقوق الملكية - 3000) [دائن بإجمالي التقييم]' },
      { 'الإرشادات والمحددات المحاسبية': '6. المستودعات المتاحة حالياً في منشأتك:' },
      ...warehouses.map((w) => ({
        'الإرشادات والمحددات المحاسبية': `   - كود المستودع: "${w.code}" | اسم المستودع: "${w.name}"`,
      })),
    ]

    const wsGuide = XLSX.utils.json_to_sheet(instructions)
    wsGuide['!cols'] = [{ wch: 90 }]
    XLSX.utils.book_append_sheet(wb, wsGuide, 'تعليمات الجرد والقيد')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }

  /**
   * Helper to normalize cell text
   */
  private static cleanCell(val: any): string {
    if (val === null || val === undefined) return ''
    return String(val).trim()
  }

  /**
   * Helper to parse numeric values safely
   */
  private static parseNumber(val: any, fallback = 0): number {
    if (val === null || val === undefined || val === '') return fallback
    const num = Number(String(val).replace(/[^0-9.-]/g, ''))
    return isNaN(num) ? fallback : num
  }

  /**
   * Parse and validate uploaded opening inventory Excel file
   */
  static async parseAndValidateExcel(
    fileBuffer: Buffer,
    businessId: string,
    defaultCurrency = 'SAR'
  ): Promise<OpeningStockValidationSummary> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' })
    const firstSheetName = wb.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('الملف المرفوع فارغ أو لا يحتوي على أي صفحات.')
    }

    const ws = wb.Sheets[firstSheetName]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

    if (!rawRows || rawRows.length === 0) {
      return {
        totalRows: 0,
        validCount: 0,
        errorCount: 0,
        newProductsCount: 0,
        existingProductsCount: 0,
        totalQuantity: 0,
        totalValuation: 0,
        rows: [],
        canImport: false,
      }
    }

    // Load existing warehouses for validation
    const rawWarehouses = await prisma.warehouse.findMany({
      where: { businessId, isActive: true },
      select: { id: true, code: true, name: true },
    })
    const warehouses = rawWarehouses.map((w) => ({
      id: w.id,
      code: w.code || '',
      name: w.name,
    }))
    const warehouseCodeMap = new Map<string, { id: string; code: string; name: string }>()
    warehouses.forEach((w) => {
      if (w.code) warehouseCodeMap.set(w.code.toLowerCase(), w)
      warehouseCodeMap.set(w.name.toLowerCase(), w)
    })
    const defaultWarehouse = warehouses[0] || null

    // Load existing products to detect new vs existing
    const existingProducts = await prisma.product.findMany({
      where: { businessId },
      select: { id: true, code: true, barcode: true, name: true, costPrice: true },
    })
    const existingSkuMap = new Map<string, typeof existingProducts[0]>()
    existingProducts.forEach((p) => {
      if (p.code) existingSkuMap.set(p.code.toLowerCase(), p)
      if (p.barcode) existingSkuMap.set(p.barcode.toLowerCase(), p)
    })

    // Find suggested GL accounts (Inventory Asset & Equity)
    const suggestedInventoryAccount = await prisma.chartOfAccount.findFirst({
      where: {
        businessId,
        type: 'asset',
        isActive: true,
        OR: [{ code: { in: ['1400', '1104', '110401', '1200'] } }, { name: { contains: 'مخزون' } }, { name: { contains: 'Inventory' } }],
      },
      select: { id: true, code: true, name: true },
    })

    const suggestedEquityAccount = await prisma.chartOfAccount.findFirst({
      where: {
        businessId,
        type: 'equity',
        isActive: true,
        OR: [{ code: { in: ['3000', '3100', '3001'] } }, { name: { contains: 'رأس المال' } }, { name: { contains: 'افتتاحي' } }, { name: { contains: 'Capital' } }],
      },
      select: { id: true, code: true, name: true },
    })

    const parsedRows: ParsedOpeningStockRow[] = []
    let errorCount = 0
    let newProductsCount = 0
    let existingProductsCount = 0
    let totalQuantity = 0
    let totalValuation = new Decimal(0)

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i]
      const rowIndex = i + 2
      const errors: string[] = []
      const warnings: string[] = []

      // 1. SKU / Code
      const rawSku = this.findFieldValue(row, ['كود الصنف', 'كود', 'باركود', 'sku', 'code', 'barcode', 'item_code', 'item code'])
      const sku = this.cleanCell(rawSku)
      if (!sku) {
        errors.push('كود الصنف / SKU مطلوب.')
      }

      // 2. Item Name
      const rawName = this.findFieldValue(row, ['اسم الصنف', 'الاسم', 'اسم المنتج', 'name', 'item_name', 'product_name', 'item name'])
      const name = this.cleanCell(rawName)
      if (!name) {
        errors.push('اسم الصنف مطلوب.')
      }

      // 3. Warehouse Code
      const rawWh = this.findFieldValue(row, ['المستودع', 'كود المستودع', 'warehouse', 'warehouse_code', 'warehouse code', 'المخزن', 'الفرع'])
      const whCode = this.cleanCell(rawWh)
      let resolvedWarehouseId: string | undefined

      if (whCode) {
        const whMatch = warehouseCodeMap.get(whCode.toLowerCase())
        if (whMatch) {
          resolvedWarehouseId = whMatch.id
        } else {
          errors.push(`كود المستودع "${whCode}" غير معرف في النظام.`)
        }
      } else if (defaultWarehouse) {
        resolvedWarehouseId = defaultWarehouse.id
        warnings.push(`لم يتم تحديد مستودع، سيتم الإسناد للمستودع الافتراضي "${defaultWarehouse.name}".`)
      } else {
        errors.push('لا يوجد مستودع متاح في المنشأة.')
      }

      // 4. Unit of Measure
      const rawUnit = this.findFieldValue(row, ['وحدة القياس', 'الوحدة', 'وحدة', 'unit', 'units', 'unit_of_measure', 'uom', 'unit of measure', 'نوع الوحدة', 'قياس'])
      const unitOfMeasure = this.cleanCell(rawUnit) || 'قطعة'

      // 5. Quantity
      const rawQty = this.findFieldValue(row, ['الكمية الافتتاحية', 'الكمية', 'quantity', 'qty', 'opening_quantity', 'opening qty'])
      const quantity = this.parseNumber(rawQty, 0)
      if (quantity <= 0) {
        errors.push('الكمية الافتتاحية يجب أن تكون أكبر من الصفر.')
      }

      // 6. Unit Cost
      const rawCost = this.findFieldValue(row, ['سعر التكلفة', 'التكلفة', 'unit cost', 'unit_cost', 'cost', 'cost_price', 'سعر الشراء'])
      const unitCost = this.parseNumber(rawCost, 0)
      if (unitCost < 0) {
        errors.push('سعر التكلفة لا يمكن أن يكون سالباً.')
      }

      // 7. Sale Price
      const rawPrice = this.findFieldValue(row, ['سعر البيع', 'سعر البيع الافتراضي', 'sale price', 'price', 'sale_price'])
      const salePrice = this.parseNumber(rawPrice, unitCost * 1.25)

      // 8. Description
      const rawDesc = this.findFieldValue(row, ['الوصف', 'ملاحظات', 'التصنيف', 'description', 'notes', 'category'])
      const description = this.cleanCell(rawDesc) || null

      // Check if product already exists
      const existing = sku ? existingSkuMap.get(sku.toLowerCase()) : null
      const isExistingProduct = !!existing

      if (isExistingProduct) {
        existingProductsCount++
        warnings.push('الصنف مسجل مسبقاً، سيتم تحديث رصيد أول المدة ومتوسط التكلفة.')
      } else {
        newProductsCount++
      }

      const rowTotalValue = new Decimal(quantity).times(unitCost).toNumber()

      if (errors.length > 0) {
        errorCount++
      } else {
        totalQuantity += quantity
        totalValuation = totalValuation.plus(rowTotalValue)
      }

      const status: 'valid' | 'warning' | 'error' = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid'

      parsedRows.push({
        rowIndex,
        sku,
        name,
        warehouseCode: whCode || defaultWarehouse?.code || 'MAIN',
        warehouseId: resolvedWarehouseId,
        unitOfMeasure,
        quantity,
        unitCost,
        salePrice,
        description,
        totalValue: rowTotalValue,
        isExistingProduct,
        status,
        errors,
        warnings,
      })
    }

    const validCount = parsedRows.length - errorCount
    const canImport = errorCount === 0 && parsedRows.length > 0

    return {
      totalRows: parsedRows.length,
      validCount,
      errorCount,
      newProductsCount,
      existingProductsCount,
      totalQuantity,
      totalValuation: totalValuation.toNumber(),
      rows: parsedRows,
      canImport,
      defaultWarehouse,
      suggestedInventoryAccount,
      suggestedEquityAccount,
    }
  }

  /**
   * Helper to search column aliases
   */
  private static findFieldValue(row: Record<string, any>, aliases: string[]): any {
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\*\(\)\[\]_:]/g, ' ')
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[\*\(\)\[\]_:]/g, ' ')
        if (cleanKey === cleanAlias || cleanKey.includes(cleanAlias)) {
          return row[key]
        }
      }
    }
    return undefined
  }

  /**
   * Atomically Import Opening Inventory and Generate Matching Opening Journal Entry
   */
  static async importOpeningInventory(
    businessId: string,
    userId: string,
    rows: ParsedOpeningStockRow[],
    options: OpeningStockImportOptions
  ): Promise<{
    importedCount: number
    totalQuantity: number
    totalValuation: number
    journalEntryId?: string | null
    journalEntryNumber?: string | null
  }> {
    const validRows = rows.filter((r) => r.status !== 'error')
    if (validRows.length === 0) {
      throw new Error('لا توجد صفوف صالحة للاستيراد.')
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { defaultCurrency: true },
    })
    const currency = business?.defaultCurrency || 'SAR'
    const openingDate = new Date(options.openingDate || new Date())

    return await prisma.$transaction(
      async (tx) => {
        let totalQuantity = 0
        let totalValuation = new Decimal(0)
        let importedCount = 0

        // 1. Get default warehouse if needed
        let fallbackWarehouseId = options.defaultWarehouseId
        if (!fallbackWarehouseId) {
          const firstWh = await tx.warehouse.findFirst({
            where: { businessId, isActive: true },
            select: { id: true },
          })
          fallbackWarehouseId = firstWh?.id
        }

        if (!fallbackWarehouseId) {
          // Create default main warehouse if none exists
          const createdWh = await tx.warehouse.create({
            data: {
              businessId,
              code: 'MAIN',
              name: 'المستودع الرئيسي',
              isActive: true,
            },
          })
          fallbackWarehouseId = createdWh.id
        }

        // 2. Create or Update Products & Inventory Balances
        const createdMovements: {
          productId: string
          warehouseId: string
          quantity: Decimal
          unitCost: Decimal
          totalCost: Decimal
        }[] = []

        for (const row of validRows) {
          const targetWarehouseId = row.warehouseId || fallbackWarehouseId
          const rowTotalCost = new Decimal(row.quantity).times(row.unitCost)

          totalQuantity += row.quantity
          totalValuation = totalValuation.plus(rowTotalCost)

          // Upsert Product
          let product = await tx.product.findFirst({
            where: {
              businessId,
              OR: [{ code: row.sku }, { barcode: row.sku }],
            },
          })

          if (product) {
            // Update existing product cost and price
            product = await tx.product.update({
              where: { id: product.id },
              data: {
                name: row.name,
                costPrice: new Decimal(row.unitCost),
                salePrice: new Decimal(row.salePrice || row.unitCost * 1.25),
                unitOfMeasure: row.unitOfMeasure || product.unitOfMeasure,
                description: row.description || product.description,
                trackInventory: true,
                isActive: true,
              },
            })
          } else {
            // Create new Product
            product = await tx.product.create({
              data: {
                businessId,
                code: row.sku,
                barcode: row.sku,
                name: row.name,
                productType: 'physical',
                trackInventory: true,
                costPrice: new Decimal(row.unitCost),
                salePrice: new Decimal(row.salePrice || row.unitCost * 1.25),
                purchasePrice: new Decimal(row.unitCost),
                unitOfMeasure: row.unitOfMeasure || 'قطعة',
                description: row.description || 'بضاعة أول المدة',
                currency,
                isActive: true,
              },
            })
          }

          // Upsert Inventory Balance
          const existingBalance = await tx.inventoryBalance.findUnique({
            where: {
              businessId_productId_warehouseId: {
                businessId,
                productId: product.id,
                warehouseId: targetWarehouseId,
              },
            },
          })

          if (existingBalance) {
            await tx.inventoryBalance.update({
              where: { id: existingBalance.id },
              data: {
                quantity: new Decimal(row.quantity),
                availableQuantity: new Decimal(row.quantity),
                averageCost: new Decimal(row.unitCost),
              },
            })
          } else {
            await tx.inventoryBalance.create({
              data: {
                businessId,
                productId: product.id,
                warehouseId: targetWarehouseId,
                quantity: new Decimal(row.quantity),
                availableQuantity: new Decimal(row.quantity),
                reservedQuantity: new Decimal(0),
                averageCost: new Decimal(row.unitCost),
              },
            })
          }

          createdMovements.push({
            productId: product.id,
            warehouseId: targetWarehouseId,
            quantity: new Decimal(row.quantity),
            unitCost: new Decimal(row.unitCost),
            totalCost: rowTotalCost,
          })

          importedCount++
        }

        // 3. Optional: Generate Matched Opening Journal Entry
        let journalEntryId: string | null = null
        let journalEntryNumber: string | null = null

        if (options.postOpeningJournalEntry && totalValuation.gt(0)) {
          // Resolve Inventory Asset GL Account
          let invGl = options.inventoryAccountId
            ? await tx.chartOfAccount.findFirst({ where: { id: options.inventoryAccountId, businessId } })
            : null

          if (!invGl) {
            invGl = await tx.chartOfAccount.findFirst({
              where: {
                businessId,
                type: 'asset',
                isActive: true,
                OR: [{ code: { in: ['1400', '1104', '110401', '1200'] } }, { name: { contains: 'مخزون' } }, { name: { contains: 'Inventory' } }],
              },
            })
          }

          if (!invGl) {
            // Create default Inventory asset account if not found
            invGl = await tx.chartOfAccount.create({
              data: {
                businessId,
                code: '1400',
                name: 'مخزون بضاعة أول المدة',
                type: 'asset',
                normalBalance: 'debit',
                isHeader: false,
                isActive: true,
              },
            })
          }

          // Resolve Equity / Capital GL Account
          let eqGl = options.equityAccountId
            ? await tx.chartOfAccount.findFirst({ where: { id: options.equityAccountId, businessId } })
            : null

          if (!eqGl) {
            eqGl = await tx.chartOfAccount.findFirst({
              where: {
                businessId,
                type: 'equity',
                isActive: true,
                OR: [{ code: { in: ['3000', '3100', '3001'] } }, { name: { contains: 'رأس المال' } }, { name: { contains: 'افتتاحي' } }, { name: { contains: 'Capital' } }],
              },
            })
          }

          if (!eqGl) {
            eqGl = await tx.chartOfAccount.create({
              data: {
                businessId,
                code: '3000',
                name: 'رأس المال / أرصدة افتتاحية',
                type: 'equity',
                normalBalance: 'credit',
                isHeader: false,
                isActive: true,
              },
            })
          }

          // Count existing opening journals for numbering
          const count = await tx.journalEntry.count({
            where: { businessId },
          })
          journalEntryNumber = `OPN-INV-${String(count + 1).padStart(4, '0')}`

          // 1. Create journal entry in draft first to allow line insertion
          const journalEntry = await tx.journalEntry.create({
            data: {
              businessId,
              entryNumber: journalEntryNumber,
              entryDate: openingDate,
              description: `قيد إثبات بضاعة أول المدة - ${importedCount} صنف بإجمالي ${totalQuantity} وحدة`,
              currencyCode: currency,
              exchangeRate: new Decimal(1),
              sourceType: 'opening_balance',
              status: 'draft',
              createdBy: userId,
            },
          })

          // 2. Insert journal lines while in draft status
          await tx.journalEntryLine.createMany({
            data: [
              {
                journalEntryId: journalEntry.id,
                businessId,
                accountId: invGl.id,
                description: `بضاعة أول المدة - تقييم المخزون المالي (${importedCount} صنف)`,
                debitAmount: totalValuation,
                creditAmount: new Decimal(0),
                baseDebit: totalValuation,
                baseCredit: new Decimal(0),
                currencyCode: currency,
                exchangeRate: new Decimal(1),
                lineOrder: 1,
              },
              {
                journalEntryId: journalEntry.id,
                businessId,
                accountId: eqGl.id,
                description: 'الرصيد الافتتاحي للمخزون / حقوق الملكية ورأس المال',
                debitAmount: new Decimal(0),
                creditAmount: totalValuation,
                baseDebit: new Decimal(0),
                baseCredit: totalValuation,
                currencyCode: currency,
                exchangeRate: new Decimal(1),
                lineOrder: 2,
              },
            ],
          })

          // 3. Post journal entry (invokes PostgreSQL trigger verify_journal_balance_before_post)
          await tx.journalEntry.update({
            where: { id: journalEntry.id },
            data: {
              status: 'posted',
              postedAt: new Date(),
              postedBy: userId,
            },
          })

          journalEntryId = journalEntry.id
        }

        // 4. Record Inventory Movements
        for (const mov of createdMovements) {
          await tx.inventoryMovement.create({
            data: {
              businessId,
              productId: mov.productId,
              warehouseId: mov.warehouseId,
              movementType: 'opening_balance',
              quantity: mov.quantity,
              unitCost: mov.unitCost,
              totalCost: mov.totalCost,
              referenceType: 'opening_balance',
              referenceId: journalEntryId || null,
              movementDate: openingDate,
              createdBy: userId,
            },
          })
        }

        return {
          importedCount,
          totalQuantity,
          totalValuation: totalValuation.toNumber(),
          journalEntryId,
          journalEntryNumber,
        }
      },
      {
        maxWait: 30000,
        timeout: 120000,
      }
    )
  }
}
