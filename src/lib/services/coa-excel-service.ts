import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db/prisma'

export interface ParsedAccountRow {
  rowIndex: number
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normalBalance: 'debit' | 'credit'
  parentCode?: string | null
  isHeader: boolean
  currency?: string | null
  description?: string | null
  isActive: boolean
  status: 'valid' | 'warning' | 'error'
  action: 'create' | 'update' | 'skip'
  errors: string[]
  warnings: string[]
}

export interface ValidationSummary {
  totalRows: number
  validCount: number
  newCount: number
  updateCount: number
  errorCount: number
  rows: ParsedAccountRow[]
  canImport: boolean
}

// Arabic to English mappings
const TYPE_MAP: Record<string, 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'> = {
  asset: 'asset',
  assets: 'asset',
  'أصول': 'asset',
  'اصول': 'asset',
  'أصل': 'asset',
  'اصل': 'asset',
  'موجودات': 'asset',

  liability: 'liability',
  liabilities: 'liability',
  'خصوم': 'liability',
  'التزامات': 'liability',
  'إلتزامات': 'liability',
  'مطلوبات': 'liability',

  equity: 'equity',
  'حقوق ملكية': 'equity',
  'حقوق الملكية': 'equity',
  'رأس المال': 'equity',
  'راس المال': 'equity',
  'ملكية': 'equity',

  revenue: 'revenue',
  revenues: 'revenue',
  income: 'revenue',
  'إيرادات': 'revenue',
  'ايرادات': 'revenue',
  'إيراد': 'revenue',
  'ايراد': 'revenue',
  'مبيعات': 'revenue',

  expense: 'expense',
  expenses: 'expense',
  'مصروفات': 'expense',
  'مصاريف': 'expense',
  'مصروف': 'expense',
  'نفقات': 'expense',
}

const BALANCE_MAP: Record<string, 'debit' | 'credit'> = {
  debit: 'debit',
  dr: 'debit',
  'مدين': 'debit',
  'دائن/مدين': 'debit',

  credit: 'credit',
  cr: 'credit',
  'دائن': 'credit',
}

const DEFAULT_BALANCE_BY_TYPE: Record<'asset' | 'liability' | 'equity' | 'revenue' | 'expense', 'debit' | 'credit'> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
}

const TYPE_ARABIC_LABELS: Record<'asset' | 'liability' | 'equity' | 'revenue' | 'expense', string> = {
  asset: 'أصول (Assets)',
  liability: 'خصوم (Liabilities)',
  equity: 'حقوق ملكية (Equity)',
  revenue: 'إيرادات (Revenue)',
  expense: 'مصروفات (Expenses)',
}

export class ChartOfAccountExcelService {
  /**
   * Generate an official ready-to-fill Excel template for Chart of Accounts
   */
  static generateTemplate(defaultCurrency = 'SAR'): Buffer {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Template Data with sample hierarchy
    const sampleData = [
      {
        'كود الحساب (Code) *': '1000',
        'اسم الحساب (Account Name) *': 'الأصول (Assets)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'أصول',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '',
        'حساب رئيسي (نعم / لا)': 'نعم',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'مجموعة الأصول الرئيسية',
      },
      {
        'كود الحساب (Code) *': '1100',
        'اسم الحساب (Account Name) *': 'النقدية وما في حكمها (Cash & Cash Equivalents)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'أصول',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '1000',
        'حساب رئيسي (نعم / لا)': 'نعم',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'الصناديق والبنوك',
      },
      {
        'كود الحساب (Code) *': '1110',
        'اسم الحساب (Account Name) *': 'الصندوق الرئيسي (Main Operating Cash)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'أصول',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '1100',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'الخزينة النقدية الرئيسية',
      },
      {
        'كود الحساب (Code) *': '1200',
        'اسم الحساب (Account Name) *': 'الحسابات البنكية (Bank Accounts)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'أصول',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '1000',
        'حساب رئيسي (نعم / لا)': 'نعم',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'الحسابات البنكية',
      },
      {
        'كود الحساب (Code) *': '1210',
        'اسم الحساب (Account Name) *': 'الحساب البنكي الجاري الرئيسي (Main Bank Account)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'أصول',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '1200',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'الحساب البنكي التشغيلي',
      },
      {
        'كود الحساب (Code) *': '1300',
        'اسم الحساب (Account Name) *': 'العملاء والذمم المدينة (Accounts Receivable)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'أصول',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '1000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'ذمم العملاء المدينة',
      },
      {
        'كود الحساب (Code) *': '1400',
        'اسم الحساب (Account Name) *': 'مخزون البضائع (Merchandise Inventory)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'أصول',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '1000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'مخزون المستودعات',
      },
      {
        'كود الحساب (Code) *': '2000',
        'اسم الحساب (Account Name) *': 'الخصوم والالتزامات (Liabilities)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'خصوم',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '',
        'حساب رئيسي (نعم / لا)': 'نعم',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'مجموعة الخصوم الرئيسية',
      },
      {
        'كود الحساب (Code) *': '2100',
        'اسم الحساب (Account Name) *': 'الموردون والذمم الدائنة (Accounts Payable)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'خصوم',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '2000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'ذمم الموردين الدائنة',
      },
      {
        'كود الحساب (Code) *': '2200',
        'اسم الحساب (Account Name) *': 'ضريبة القيمة المضافة المستحقة (Sales Tax / VAT Payable)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'خصوم',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '2000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'ضريبة المخرجات المستحقة',
      },
      {
        'كود الحساب (Code) *': '2210',
        'اسم الحساب (Account Name) *': 'ضريبة المدخلات القابلة للاسترداد (Input VAT Recoverable)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'خصوم',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '2000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'ضريبة المدخلات على المشتريات',
      },
      {
        'كود الحساب (Code) *': '3000',
        'اسم الحساب (Account Name) *': 'حقوق الملكية (Equity)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'حقوق ملكية',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '',
        'حساب رئيسي (نعم / لا)': 'نعم',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'رأس المال والأرباح المبقاة',
      },
      {
        'كود الحساب (Code) *': '3100',
        'اسم الحساب (Account Name) *': "رأس المال المدفوع (Owner's Capital)",
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'حقوق ملكية',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '3000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'رأس مال المشروع',
      },
      {
        'كود الحساب (Code) *': '3200',
        'اسم الحساب (Account Name) *': 'الأرباح المبقاة / المحتجزة (Retained Earnings)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'حقوق ملكية',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '3000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'الأرباح المتراكمة للمنشأة',
      },
      {
        'كود الحساب (Code) *': '4000',
        'اسم الحساب (Account Name) *': 'الإيرادات التشغيلية (Revenue)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'إيرادات',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '',
        'حساب رئيسي (نعم / لا)': 'نعم',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'مبيعات وإيرادات النشاط',
      },
      {
        'كود الحساب (Code) *': '4100',
        'اسم الحساب (Account Name) *': 'إيرادات المبيعات (Sales Revenue)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'إيرادات',
        'طبيعة الرصيد (مدين / دائن)': 'دائن',
        'كود الحساب الأب (Parent Code)': '4000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'مبيعات البضائع والمنتجات',
      },
      {
        'كود الحساب (Code) *': '5000',
        'اسم الحساب (Account Name) *': 'المصروفات وتكلفة النشاط (Expenses)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'مصروفات',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '',
        'حساب رئيسي (نعم / لا)': 'نعم',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'تكاليف ومصاريف النشاط والتشغيل',
      },
      {
        'كود الحساب (Code) *': '5100',
        'اسم الحساب (Account Name) *': 'تكلفة البضاعة المباعة (Cost of Goods Sold)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'مصروفات',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '5000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'تكلفة المخزون المباع',
      },
      {
        'كود الحساب (Code) *': '5200',
        'اسم الحساب (Account Name) *': 'الرواتب والأجور (Salaries & Wages)',
        'النوع (Type: أصول / خصوم / حقوق ملكية / إيرادات / مصروفات) *': 'مصروفات',
        'طبيعة الرصيد (مدين / دائن)': 'مدين',
        'كود الحساب الأب (Parent Code)': '5000',
        'حساب رئيسي (نعم / لا)': 'لا',
        'العملة (Currency)': defaultCurrency,
        'الوصف (Description)': 'رواتب ومستحقات العاملين',
      },
    ]

    const wsData = XLSX.utils.json_to_sheet(sampleData)

    // Set Column Widths for readability
    wsData['!cols'] = [
      { wch: 16 }, // Code
      { wch: 32 }, // Name
      { wch: 25 }, // Type
      { wch: 18 }, // Normal Balance
      { wch: 20 }, // Parent Code
      { wch: 16 }, // Is Header
      { wch: 14 }, // Currency
      { wch: 35 }, // Description
    ]

    XLSX.utils.book_append_sheet(wb, wsData, 'دليل الحسابات (Template)')

    // Sheet 2: Guide & Instructions
    const instructions = [
      { 'التعليمات والإرشادات': '1. الحقول المؤشر عليها بـ (*) إلزامية (كود الحساب، اسم الحساب، النوع).' },
      { 'التعليمات والإرشادات': '2. كود الحساب (Code): يجب أن يكون فريداً لكل حساب (أرقام أو نصوص مثل: 101, 10101).' },
      { 'التعليمات والإرشادات': '3. أنواع الحسابات المعتمدة (Type):' },
      { 'التعليمات والإرشادات': '   - أصول (asset)' },
      { 'التعليمات والإرشادات': '   - خصوم / التزامات (liability)' },
      { 'التعليمات والإرشادات': '   - حقوق ملكية (equity)' },
      { 'التعليمات والإرشادات': '   - إيرادات (revenue)' },
      { 'التعليمات والإرشادات': '   - مصروفات (expense)' },
      { 'التعليمات والإرشادات': '4. طبيعة الرصيد (Normal Balance):' },
      { 'التعليمات والإرشادات': '   - مدين (debit) أو دائن (credit). إذا تركتها فارغة سيحددها النظام تلقائياً حسب نوع الحساب.' },
      { 'التعليمات والإرشادات': '5. كود الحساب الأب (Parent Code):' },
      { 'التعليمات والإرشادات': '   - استخدم كود الحساب الرئيسي الأعلى لربط الحساب الفرعي به (مثال: الحساب 11 أبوه 1).' },
      { 'التعليمات والإرشادات': '   - للحسابات الرئيسية من المستوى الأول، اترك خانة الأب فارغة.' },
      { 'التعليمات والإرشادات': '6. حساب رئيسي (Is Header):' },
      { 'التعليمات والإرشادات': '   - اكتب (نعم أو Yes) إذا كان الحساب تجميعياً رئيسياً، أو (لا أو No) إذا كان حساباً فرعياً تقبل عليه القيود.' },
      { 'التعليمات والإرشادات': '7. يدعم النظام كلاً من العناوين باللغة العربية والإنجليزية (Account Code, Account Name, Type, etc.).' },
    ]

    const wsGuide = XLSX.utils.json_to_sheet(instructions)
    wsGuide['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsGuide, 'تعليمات التعبئة')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }

  /**
   * Export all existing Chart of Accounts for a business to Excel
   */
  static async exportToExcel(businessId: string): Promise<Buffer> {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { businessId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    })

    // Map parent IDs to parent codes
    const accountMap = new Map<string, string>()
    accounts.forEach((acc) => {
      accountMap.set(acc.id, acc.code)
    })

    const exportRows = accounts.map((acc) => {
      const parentCode = acc.parentId ? accountMap.get(acc.parentId) || '' : ''
      return {
        'كود الحساب (Code)': acc.code,
        'اسم الحساب (Account Name)': acc.name,
        'النوع (Type)': TYPE_ARABIC_LABELS[acc.type as keyof typeof TYPE_ARABIC_LABELS] || acc.type,
        'طبيعة الرصيد (Normal Balance)': acc.normalBalance === 'debit' ? 'مدين (Debit)' : 'دائن (Credit)',
        'كود الحساب الأب (Parent Code)': parentCode,
        'حساب رئيسي (Is Header)': acc.isHeader ? 'نعم (Yes)' : 'لا (No)',
        'العملة (Currency)': acc.currency || '',
        'الوصف (Description)': acc.description || '',
        'الحالة (Status)': acc.isActive ? 'نشط (Active)' : 'معطل (Inactive)',
        'حساب نظامي (System Account)': acc.isSystem ? 'نعم' : 'لا',
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportRows)

    ws['!cols'] = [
      { wch: 16 }, // Code
      { wch: 35 }, // Name
      { wch: 22 }, // Type
      { wch: 18 }, // Balance
      { wch: 20 }, // Parent Code
      { wch: 16 }, // Header
      { wch: 14 }, // Currency
      { wch: 35 }, // Description
      { wch: 16 }, // Status
      { wch: 16 }, // System
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'دليل الحسابات')
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }

  /**
   * Helper to normalize text from excel cell
   */
  private static cleanCell(val: any): string {
    if (val === null || val === undefined) return ''
    return String(val).trim()
  }

  /**
   * Parse and validate an uploaded Excel/CSV file buffer against the business's Chart of Accounts
   */
  static async parseAndValidateExcel(
    fileBuffer: Buffer,
    businessId: string,
    defaultCurrency = 'SAR'
  ): Promise<ValidationSummary> {
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
        newCount: 0,
        updateCount: 0,
        errorCount: 0,
        rows: [],
        canImport: false,
      }
    }

    // Fetch existing accounts in business to detect updates vs new
    const existingAccounts = await prisma.chartOfAccount.findMany({
      where: { businessId },
      select: { id: true, code: true, name: true, isSystem: true, type: true },
    })
    const existingCodeMap = new Map<string, { id: string; name: string; isSystem: boolean; type: string }>()
    existingAccounts.forEach((a) => existingCodeMap.set(a.code.toLowerCase(), a))

    // Set of codes declared inside the file to validate parent references
    const fileCodes = new Set<string>()
    rawRows.forEach((r) => {
      const code = this.findFieldValue(r, ['كود الحساب', 'كود', 'code', 'account code', 'account_code', 'رقم الحساب'])
      if (code) fileCodes.add(code.toLowerCase())
    })

    const parsedRows: ParsedAccountRow[] = []
    let newCount = 0
    let updateCount = 0
    let errorCount = 0

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i]
      const rowIndex = i + 2 // 1-indexed including header
      const errors: string[] = []
      const warnings: string[] = []

      // 1. Account Code
      const rawCode = this.findFieldValue(row, ['كود الحساب', 'كود', 'code', 'account code', 'account_code', 'رقم الحساب'])
      const code = this.cleanCell(rawCode)

      if (!code) {
        errors.push('كود الحساب مطلوب (Account Code is required).')
      }

      // 2. Account Name
      const rawName = this.findFieldValue(row, ['اسم الحساب', 'الاسم', 'name', 'account name', 'account_name', 'اسم'])
      const name = this.cleanCell(rawName)
      if (!name) {
        errors.push('اسم الحساب مطلوب (Account Name is required).')
      }

      // 3. Account Type
      const rawType = this.findFieldValue(row, ['النوع', 'نوع الحساب', 'type', 'account type', 'account_type'])
      const cleanTypeStr = this.cleanCell(rawType).toLowerCase()
      let mappedType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | null = null

      if (cleanTypeStr) {
        // match type keywords
        for (const [k, v] of Object.entries(TYPE_MAP)) {
          if (cleanTypeStr.includes(k.toLowerCase())) {
            mappedType = v
            break
          }
        }
      }

      if (!mappedType) {
        if (!cleanTypeStr) {
          errors.push('نوع الحساب مطلوب (أصول، خصوم، حقوق ملكية، إيرادات، مصروفات).')
        } else {
          errors.push(`نوع الحساب غير صالح "${cleanTypeStr}". الخيارات المتاحة: أصول، خصوم، حقوق ملكية، إيرادات، مصروفات.`)
        }
        mappedType = 'asset' // fallback for typings
      }

      // 4. Normal Balance
      const rawBalance = this.findFieldValue(row, ['طبيعة الرصيد', 'طبيعة الحساب', 'normal balance', 'normal_balance', 'balance type'])
      const cleanBalanceStr = this.cleanCell(rawBalance).toLowerCase()
      let mappedBalance: 'debit' | 'credit' = DEFAULT_BALANCE_BY_TYPE[mappedType]

      if (cleanBalanceStr) {
        for (const [k, v] of Object.entries(BALANCE_MAP)) {
          if (cleanBalanceStr.includes(k.toLowerCase())) {
            mappedBalance = v
            break
          }
        }
      }

      // 5. Parent Code
      const rawParent = this.findFieldValue(row, ['كود الحساب الأب', 'الحساب الأب', 'parent code', 'parent_code', 'parent'])
      const parentCode = this.cleanCell(rawParent) || null

      if (parentCode) {
        if (parentCode.toLowerCase() === code.toLowerCase()) {
          errors.push('لا يمكن للحساب أن يكون أباً لنفسه (Self-parenting).')
        } else {
          const parentExistsInDb = existingCodeMap.has(parentCode.toLowerCase())
          const parentExistsInFile = fileCodes.has(parentCode.toLowerCase())
          if (!parentExistsInDb && !parentExistsInFile) {
            errors.push(`كود الحساب الأب "${parentCode}" غير موجود في الملف ولا في دليل الحسابات الحالي.`)
          }
        }
      }

      // 6. Is Header
      const rawHeader = this.findFieldValue(row, ['حساب رئيسي', 'رئيسي', 'is header', 'is_header', 'header'])
      const cleanHeader = this.cleanCell(rawHeader).toLowerCase()
      let isHeader = false
      if (['نعم', 'yes', 'true', '1', 'y'].includes(cleanHeader)) {
        isHeader = true
      }

      // 7. Currency
      const rawCurrency = this.findFieldValue(row, ['العملة', 'currency'])
      const currency = this.cleanCell(rawCurrency).toUpperCase() || defaultCurrency

      // 8. Description
      const rawDesc = this.findFieldValue(row, ['الوصف', 'ملاحظات', 'description', 'notes'])
      const description = this.cleanCell(rawDesc) || null

      // 9. Status
      const rawStatus = this.findFieldValue(row, ['الحالة', 'نشط', 'status', 'active', 'is_active'])
      const cleanStatus = this.cleanCell(rawStatus).toLowerCase()
      const isActive = !['معطل', 'غير نشط', 'inactive', 'false', '0', 'no', 'لا'].includes(cleanStatus)

      // Determine Action (Create vs Update)
      const existing = existingCodeMap.get(code.toLowerCase())
      let action: 'create' | 'update' | 'skip' = 'create'

      if (existing) {
        action = 'update'
        updateCount++
        if (existing.isSystem) {
          warnings.push('هذا الحساب حساب نظامي أساسي، سيتم تحديث اسمه وبياناته التوضيحية.')
        }
        if (existing.type !== mappedType) {
          warnings.push(`سيتم تغيير نوع الحساب من ${existing.type} إلى ${mappedType}.`)
        }
      } else {
        newCount++
      }

      const status: 'valid' | 'warning' | 'error' = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid'
      if (status === 'error') {
        errorCount++
      }

      parsedRows.push({
        rowIndex,
        code,
        name,
        type: mappedType,
        normalBalance: mappedBalance,
        parentCode,
        isHeader,
        currency,
        description,
        isActive,
        status,
        action,
        errors,
        warnings,
      })
    }

    const validCount = parsedRows.length - errorCount
    const canImport = errorCount === 0 && parsedRows.length > 0

    return {
      totalRows: parsedRows.length,
      validCount,
      newCount,
      updateCount,
      errorCount,
      rows: parsedRows,
      canImport,
    }
  }

  /**
   * Helper to locate column value flexibly using multiple aliases
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
   * Import or Upsert verified accounts into the database
   */
  static async importAccounts(
    businessId: string,
    accountsData: ParsedAccountRow[],
    mode: 'merge' | 'insert_only' = 'merge'
  ): Promise<{ created: number; updated: number; skipped: number }> {
    return await prisma.$transaction(
      async (tx) => {
        let created = 0
        let updated = 0
        let skipped = 0

        // Map to hold code -> account ID in DB
        const codeToIdMap = new Map<string, string>()

        // 1. Load existing accounts
        const existing = await tx.chartOfAccount.findMany({
          where: { businessId },
          select: { id: true, code: true },
        })
        existing.forEach((a) => codeToIdMap.set(a.code.toLowerCase(), a.id))

        // Filter rows based on mode
        const validRows = accountsData.filter((r) => r.status !== 'error')

        // PASS 1: Create or Update Accounts (without parentId first to avoid order dependencies)
        for (const row of validRows) {
          const lowerCode = row.code.toLowerCase()
          const existingId = codeToIdMap.get(lowerCode)

          if (existingId) {
            if (mode === 'insert_only') {
              skipped++
              continue
            }

            // Update existing account
            await tx.chartOfAccount.update({
              where: { id: existingId },
              data: {
                name: row.name,
                type: row.type,
                normalBalance: row.normalBalance,
                isHeader: row.isHeader,
                currency: row.currency || null,
                description: row.description || null,
                isActive: row.isActive,
              },
            })
            updated++
          } else {
            // Create new account
            const newAcc = await tx.chartOfAccount.create({
              data: {
                businessId,
                code: row.code,
                name: row.name,
                type: row.type,
                normalBalance: row.normalBalance,
                isHeader: row.isHeader,
                currency: row.currency || null,
                description: row.description || null,
                isActive: row.isActive,
                sortOrder: 0,
              },
            })
            codeToIdMap.set(lowerCode, newAcc.id)
            created++
          }
        }

        // PASS 2: Link parent hierarchy
        for (const row of validRows) {
          const accountId = codeToIdMap.get(row.code.toLowerCase())
          if (!accountId) continue

          let resolvedParentId: string | null = null
          if (row.parentCode) {
            resolvedParentId = codeToIdMap.get(row.parentCode.toLowerCase()) || null
          }

          await tx.chartOfAccount.update({
            where: { id: accountId },
            data: {
              parentId: resolvedParentId,
            },
          })
        }

        return { created, updated, skipped }
      },
      {
        maxWait: 30000, // 30s max wait to get connection
        timeout: 120000, // 120s max timeout for transaction execution
      }
    )
  }
}
