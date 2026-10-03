// =============================================================
// Chart of Accounts Internationalization & Multilingual Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// Supports: Arabic (ar), English (en), Turkish (tr)
// =============================================================

export interface LocalizedAccountData {
  ar: string
  en: string
  tr: string
  description?: {
    ar: string
    en: string
    tr: string
  }
}

export const STANDARD_ACCOUNT_TRANSLATIONS: Record<string, LocalizedAccountData> = {
  // ==========================================
  // 1. ASSETS (1000s)
  // ==========================================
  '1000': {
    ar: 'الأصول',
    en: 'Assets',
    tr: 'Varlıklar (Aktifler)',
    description: {
      ar: 'مجموعة الأصول والموجودات الرئيسية للمنشأة',
      en: 'Total economic resources owned by the business',
      tr: 'İşletmenin sahip olduğu tüm ekonomik varlıklar',
    },
  },
  '1100': {
    ar: 'النقدية وما في حكمها',
    en: 'Cash and Cash Equivalents',
    tr: 'Hazır Değerler ve Nakit',
    description: {
      ar: 'أموال الصناديق والعهد النقدية السائلة',
      en: 'Cash in hand, cash drawers and short-term liquid funds',
      tr: 'Kasa mevcudu ve likit nakit fonlar',
    },
  },
  '1110': {
    ar: 'الصندوق الرئيسي',
    en: 'Main Operating Cash',
    tr: 'Merkez Kasa Hesabı',
    description: {
      ar: 'الخزينة النقدية الرئيسية للعمليات التشغيلية اليومية',
      en: 'Primary cash drawer for daily operational receipts and payments',
      tr: 'Günlük nakit giriş ve çıkışları için ana kasa',
    },
  },
  '1120': {
    ar: 'صندوق المصروفات النثرية والعهدة',
    en: 'Petty Cash Fund',
    tr: 'Küçük Kasa ve Avans Fonu',
    description: {
      ar: 'صندوق العهد والمصاريف النثرية البسيطة',
      en: 'Custodian float fund for small miscellaneous operational expenses',
      tr: 'Küçük işletme masrafları için ayrılan kasa avansı',
    },
  },
  '1200': {
    ar: 'الحسابات البنكية',
    en: 'Bank Accounts',
    tr: 'Bankalar',
    description: {
      ar: 'أرصدة المنشأة في الحسابات المصرفية الجارية والاستثمارية',
      en: 'Commercial bank checking, savings and investment accounts',
      tr: 'Ticari vadesiz ve vadeli banka hesapları',
    },
  },
  '1210': {
    ar: 'الحساب البنكي الرئيسي',
    en: 'Main Bank Account',
    tr: 'Ana Banka Ticari Hesabı',
    description: {
      ar: 'الحساب البنكي التجاري التشغيلي الأساسي',
      en: 'Primary commercial bank checking account for business operations',
      tr: 'İşletme faaliyetleri için ana ticari vadesiz mevduat hesabı',
    },
  },
  '1300': {
    ar: 'العملاء والذمم المدينة',
    en: 'Accounts Receivable (Trade Debtors)',
    tr: 'Alıcılar (Ticari Alacaklar)',
    description: {
      ar: 'مستحقات المنشأة طرف العملاء الناتجة عن المبيعات الآجلة',
      en: 'Amounts due from customers for goods delivered or services provided on credit',
      tr: 'Müşterilerden vadeli satışlar kaynaklı ticari alacaklar',
    },
  },
  '1400': {
    ar: 'مخزون البضائع',
    en: 'Merchandise Inventory',
    tr: 'Ticari Mallar (Stoklar)',
    description: {
      ar: 'قيمة بضاعة المستودعات المتاحة للبيع والتداول',
      en: 'Value of physical goods and materials available for sale in warehouses',
      tr: 'Depolarda satışa hazır ticari malların toplam maliyet değeri',
    },
  },
  '1500': {
    ar: 'المصروفات المدفوعة مقدماً',
    en: 'Prepaid Expenses',
    tr: 'Gelecek Aylara Ait Giderler (Peşin Ödenen)',
    description: {
      ar: 'نفقات مدفوعة مقدماً تغطي فترات مالية مستقبلية كالإيجار والتأمين',
      en: 'Payments made in advance for goods or services to be received in the future',
      tr: 'Gelecek dönemlere ait peşin ödenmiş kira ve sigorta giderleri',
    },
  },
  '1600': {
    ar: 'الأصول الثابتة',
    en: 'Fixed Assets (Property, Plant & Equipment)',
    tr: 'Duran Varlıklar (Maddi Duran Varlıklar)',
    description: {
      ar: 'الممتلكات والمعدات طويلة الأجل المستخدمة في النشاط',
      en: 'Long-term tangible assets used in business operations',
      tr: 'İşletme faaliyetlerinde kullanılan uzun vadeli maddi varlıklar',
    },
  },
  '1610': {
    ar: 'المعدات والأثاث المكتبي',
    en: 'Equipment & Office Furniture',
    tr: 'Tesis, Makine, Cihaz ve Demirbaşlar',
    description: {
      ar: 'الأجهزة والحواسيب والآلات والأثاث المكتبي',
      en: 'Office furniture, machinery, computers, and operational equipment',
      tr: 'Ofis mobilyaları, bilgisayarlar, makineler ve demirbaşlar',
    },
  },
  '1690': {
    ar: 'مجمع إهلاك الأصول الثابتة',
    en: 'Accumulated Depreciation',
    tr: 'Birikmiş Amortismanlar (-)',
    description: {
      ar: 'حساب مقابل أصل لتجميع مبالغ الإهلاك السنوي للأصول',
      en: 'Contra-asset account recording the cumulative depreciation of fixed assets',
      tr: 'Duran varlıkların kullanım süresince birikmiş amortisman tutarları',
    },
  },

  // ==========================================
  // 2. LIABILITIES (2000s)
  // ==========================================
  '2000': {
    ar: 'الخصوم والالتزامات',
    en: 'Liabilities',
    tr: 'Yükümlülükler (Pasifler)',
    description: {
      ar: 'الالتزامات والديون المالية المستحقة على المنشأة للغير',
      en: 'Debts and financial obligations owed by the business to third parties',
      tr: 'İşletmenin üçüncü şahıslara olan tüm ticari ve mali borçları',
    },
  },
  '2100': {
    ar: 'الموردون والذمم الدائنة',
    en: 'Accounts Payable (Trade Creditors)',
    tr: 'Satıcılar (Ticari Borçlar)',
    description: {
      ar: 'مستحقات الموردين الناتجة عن شراء بضائع أو خدمات بالآجل',
      en: 'Amounts owed to vendors and suppliers for purchases made on credit',
      tr: 'Tedarikçilere vadeli mal ve hizmet alımlarından doğan borçlar',
    },
  },
  '2200': {
    ar: 'ضريبة القيمة المضافة المستحقة (المخرجات)',
    en: 'Sales Tax / Output VAT Payable',
    tr: 'Hesaplanan KDV (Ödenecek Katma Değer Vergisi)',
    description: {
      ar: 'الضريبة المحصلة من العملاء على فواتير المبيعات والمستحقة لهيئة الزكاة والضريبة',
      en: 'Value-added tax collected on sales invoices payable to the tax authority',
      tr: 'Satış faturaları üzerinden tahsil edilen ve vergi dairesine ödenecek KDV',
    },
  },
  '2210': {
    ar: 'ضريبة المدخلات القابلة للاسترداد',
    en: 'Input VAT Recoverable',
    tr: 'İndirilecek KDV (Girdi Katma Değer Vergisi)',
    description: {
      ar: 'الضريبة المدفوعة على فواتير المشتريات والمصروفات القابلة للخصم الضريبي',
      en: 'Value-added tax paid on vendor purchases eligible for tax credit deduction',
      tr: 'Alış ve gider faturalarında ödenen ve indirime konu olan KDV',
    },
  },
  '2300': {
    ar: 'المصروفات والالتزامات المستحقة',
    en: 'Accrued Operating Expenses',
    tr: 'Gider Tahakkukları ve Ödenecek Giderler',
    description: {
      ar: 'مصاريف تحققت خلال الفترة ولم تسدد بعد كالرواتب ومستحقات المرافق',
      en: 'Operating expenses incurred during the period that have not yet been paid',
      tr: 'Dönem içinde gerçekleşmiş ancak henüz ödenmemiş işletme giderleri',
    },
  },
  '2400': {
    ar: 'قروض والتزامات طويلة الأجل',
    en: 'Long-term Liabilities & Loans',
    tr: 'Uzun Vadeli Yabancı Kaynaklar ve Krediler',
    description: {
      ar: 'القروض والتمويلات المصرفية التي تستحق بعد أكثر من عام مالي',
      en: 'Bank loans and financing obligations due after more than one fiscal year',
      tr: 'Bir yıldan uzun vadeli banka kredileri ve finansman yükümlülükleri',
    },
  },

  // ==========================================
  // 3. EQUITY (3000s)
  // ==========================================
  '3000': {
    ar: 'حقوق الملكية',
    en: 'Equity',
    tr: 'Özkaynaklar',
    description: {
      ar: 'صافي حقوق ومساهمات الملاك في المنشأة بعد خصم الالتزامات',
      en: 'Residual interest in the assets of the business after deducting all liabilities',
      tr: 'Varlıklardan tüm borçlar düşüldükten sonra kalan net işletme değeri',
    },
  },
  '3100': {
    ar: 'رأس المال المدفوع',
    en: "Owner's Contributed Capital",
    tr: 'Ödenmiş Sermaye',
    description: {
      ar: 'إجمالي المبالغ ورؤوس الأموال المستثمرة من قبل الشركاء والملاك',
      en: 'Total initial and additional funds invested into the business by owners',
      tr: 'Ortaklar tarafından işletmeye tahsis edilen ve ödenen toplam sermaye',
    },
  },
  '3200': {
    ar: 'الأرباح المبقاة / المحتجزة',
    en: 'Retained Earnings',
    tr: 'Geçmiş Yıllar Karları / Dağıtılmamış Karlar',
    description: {
      ar: 'صافي الأرباح المتراكمة من السنوات السابقة التي لم توزع على الملاك',
      en: 'Cumulative net income retained in the business rather than distributed to owners',
      tr: 'Önceki dönemlerden biriken ve ortaklara dağıtılmayıp işletmede kalan karlar',
    },
  },
  '3300': {
    ar: 'جاري الشركاء / المسحوبات الشخصية',
    en: "Owner's Drawings",
    tr: 'Ortaklar Cari Hesabı / Çekişler (-)',
    description: {
      ar: 'المسحوبات النقدية أو العينية الشخصية للملاك من أموال المنشأة',
      en: 'Withdrawals of cash or other business assets taken by owners for personal use',
      tr: 'Ortakların şahsi kullanımı için işletmeden çektikleri nakit ve değerler',
    },
  },

  // ==========================================
  // 4. REVENUE (4000s)
  // ==========================================
  '4000': {
    ar: 'الإيرادات التشغيلية',
    en: 'Revenue',
    tr: 'Gelirler ve Satışlar',
    description: {
      ar: 'إجمالي العوائد المحققة من الأنشطة التجارية والخدمية',
      en: 'Total gross income generated from business sales and operations',
      tr: 'İşletmenin ana faaliyetlerinden elde ettiği toplam brüt gelirler',
    },
  },
  '4100': {
    ar: 'إيرادات المبيعات',
    en: 'Sales Revenue',
    tr: 'Yurtiçi Satış Gelirleri',
    description: {
      ar: 'عوائد بيع المنتجات والبضائع للعملاء',
      en: 'Income earned from selling products and merchandise to customers',
      tr: 'Müşterilere yapılan ticari mal ve ürün satışlarından sağlanan hasılat',
    },
  },
  '4200': {
    ar: 'إيرادات الخدمات والاستشارات',
    en: 'Service Revenue',
    tr: 'Hizmet Gelirleri',
    description: {
      ar: 'عوائد تقديم الخدمات المهنية والتقنية والاستشارية',
      en: 'Fees earned from providing consulting, maintenance, or professional services',
      tr: 'Danışmanlık, bakım ve profesyonel hizmet sunumlarından elde edilen gelirler',
    },
  },
  '4300': {
    ar: 'خصم مسموح به (خصم المبيعات)',
    en: 'Sales Discounts Allowed',
    tr: 'Satış İndirimleri ve İskontoları (-)',
    description: {
      ar: 'الخصومات الممنوحة للعملاء لتشجيع السداد المبكر أو المبيعات الكبيرة',
      en: 'Discounts granted to customers reducing overall gross revenue',
      tr: 'Erken ödeme veya hacim nedeniyle müşterilere tanınan satış iskontoları',
    },
  },
  '4900': {
    ar: 'إيرادات وأرباح أخرى / فروق العملات',
    en: 'Other Income & FX Gains',
    tr: 'Diğer Faaliyet Gelirleri ve Kambiyo Karları',
    description: {
      ar: 'إيرادات غير تشغيلية وأرباح تقييم العملات الأجنبية',
      en: 'Non-operating income, foreign exchange gains, interest and ancillary earnings',
      tr: 'Faaliyet dışı gelirler, faiz gelirleri ve döviz kuru değerleme karları',
    },
  },

  // ==========================================
  // 5. EXPENSES (5000s)
  // ==========================================
  '5000': {
    ar: 'المصروفات وتكلفة النشاط',
    en: 'Expenses',
    tr: 'Giderler ve Maliyetler',
    description: {
      ar: 'إجمالي التكاليف والمصروفات التشغيلية للمنشأة',
      en: 'Total costs incurred in the process of generating revenue',
      tr: 'Gelir elde etmek amacıyla katlanılan tüm işletme gider ve maliyetleri',
    },
  },
  '5100': {
    ar: 'تكلفة البضاعة المباعة (COGS)',
    en: 'Cost of Goods Sold (COGS)',
    tr: 'Satılan Ticari Mallar Maliyeti (STMM)',
    description: {
      ar: 'التكلفة المباشرة للبضائع والمنتجات التي تم بيعها للعملاء',
      en: 'Direct acquisition or production costs of inventory items sold during the period',
      tr: 'Dönem içinde satılan ticari malların doğrudan alış ve depolama maliyeti',
    },
  },
  '5200': {
    ar: 'الرواتب والأجور ومستحقات الموظفين',
    en: 'Salaries & Staff Wages',
    tr: 'Personel Ücret ve Maaş Giderleri',
    description: {
      ar: 'رواتب وبدلات ومكافآت وتأمينات العاملين بالمنشأة',
      en: 'Gross wages, salaries, bonuses, and social security for employees',
      tr: 'Çalışanlara ödenen brüt maaşlar, ikramiyeler ve SGK prim giderleri',
    },
  },
  '5300': {
    ar: 'مصروف الإيجار',
    en: 'Facility Rent Expense',
    tr: 'Kira Giderleri',
    description: {
      ar: 'إيجار المكاتب والمستودعات ومواقع العمل التشغيلية',
      en: 'Rent payments for office premises, warehouses, and operating facilities',
      tr: 'Ofis, mağaza ve depo binalarına ait dönemsel kira giderleri',
    },
  },
  '5400': {
    ar: 'المنافع والكهرباء والاتصالات',
    en: 'Utilities & Internet Telecommunications',
    tr: 'Elektrik, Su, Doğalgaz ve İletişim Giderleri',
    description: {
      ar: 'فواتير الكهرباء، المياه، الهاتف، واشتراكات الإنترنت والسحابة',
      en: 'Electricity, water, telephone, cloud hosting, and internet service costs',
      tr: 'Elektrik, su, internet, telefon ve sunucu altyapı hizmet bedelleri',
    },
  },
  '5500': {
    ar: 'التسويق والدعاية والإعلان',
    en: 'Marketing & Advertising',
    tr: 'Pazarlama, Satış ve Dağıtım Giderleri',
    description: {
      ar: 'حملات التسويق الرقمي والمطبوعات والترويج للعلامة التجارية',
      en: 'Advertising, digital promotion, branding, and customer acquisition costs',
      tr: 'Reklam, dijital pazarlama, tanıtım ve halkla ilişkiler harcamaları',
    },
  },
  '5600': {
    ar: 'المستلزمات والمصاريف الإدارية',
    en: 'Office Supplies & Administrative Expenses',
    tr: 'Genel Yönetim ve Kırtasiye Giderleri',
    description: {
      ar: 'الأدوات المكتبية، المطبوعات، الضيافة، واللوازم الإدارية العامة',
      en: 'Stationery, office supplies, hospitality, and general office expenses',
      tr: 'Kırtasiye, temizlik, ikram ve genel idari sarf malzeme giderleri',
    },
  },
  '5700': {
    ar: 'الرسوم والعمولات البنكية',
    en: 'Bank & Payment Gateway Fees',
    tr: 'Banka Komisyon ve Masrafları',
    description: {
      ar: 'رسوم التحويلات المصرفية وبوابات الدفع الإلكتروني ونقاط البيع (POS)',
      en: 'Bank charges, wire fees, payment gateway and POS transaction processing costs',
      tr: 'Banka havale/EFT masrafları, POS ve sanal pos komisyon kesintileri',
    },
  },
  '5800': {
    ar: 'مصروف إهلاك الأصول الثابتة',
    en: 'Depreciation Expense',
    tr: 'Amortisman Giderleri',
    description: {
      ar: 'قسط الإهلاك الدوري المحمل على الفترة للأصول الثابتة',
      en: 'Periodic depreciation allocation for tangible capital assets',
      tr: 'Maddi duran varlıklar için döneme yansıtılan yıpranma payı gideri',
    },
  },
  '5900': {
    ar: 'مصروفات تشغيلية وتسويات أخرى',
    en: 'Other Operating Expenses & Adjustments',
    tr: 'Diğer Faaliyet ve Olağan Dışı Giderler',
    description: {
      ar: 'فروقات التسويات الجردية والمصاريف التشغيلية المتنوعة',
      en: 'Inventory variance adjustments, miscellaneous costs, and operational losses',
      tr: 'Stok sayım farkları, dönemsel düzeltmeler ve çeşitli işletme giderleri',
    },
  },
}

/**
 * Get localized display name for any account based on the user's active locale.
 *
 * @param account - Object containing at least `code` and `name`
 * @param locale - Active language code ('ar', 'en', 'tr')
 * @returns Fully localized string
 */
export function getLocalizedAccountName(
  accountOrCode: { code?: string | null; name?: string | null } | string | null | undefined,
  nameOrLocale?: string,
  maybeLocale?: string
): string {
  if (!accountOrCode) return ''

  let code = ''
  let currentName = ''
  let locale = 'ar'

  if (typeof accountOrCode === 'object') {
    code = accountOrCode.code?.trim() || ''
    currentName = accountOrCode.name?.trim() || ''
    locale = nameOrLocale || 'ar'
  } else {
    code = (accountOrCode || '').trim()
    currentName = (nameOrLocale || '').trim()
    locale = maybeLocale || 'ar'
  }

  // 1. Check if standard account translation exists for this code
  if (code && STANDARD_ACCOUNT_TRANSLATIONS[code]) {
    const trans = STANDARD_ACCOUNT_TRANSLATIONS[code]
    if (locale === 'en') return trans.en
    if (locale === 'tr') return trans.tr
    return trans.ar
  }

  // 2. If name contains bilingual patterns like "English (Arabic)" or "Arabic (English)"
  // e.g. "Cash and Cash Equivalents (النقدية وما في حكمها)" or "Assets (الأصول)"
  const bilingualMatch = currentName.match(/^([^(]+)\(([^)]+)\)$/)
  if (bilingualMatch) {
    const part1 = bilingualMatch[1].trim()
    const part2 = bilingualMatch[2].trim()

    const hasArabicInPart1 = /[\u0600-\u06FF]/.test(part1)
    const hasArabicInPart2 = /[\u0600-\u06FF]/.test(part2)

    if (locale === 'ar') {
      return hasArabicInPart1 ? part1 : (hasArabicInPart2 ? part2 : currentName)
    } else if (locale === 'en') {
      return !hasArabicInPart1 ? part1 : (!hasArabicInPart2 ? part2 : currentName)
    }
  }

  return currentName
}

/**
 * Get localized description for a standard account.
 */
export function getLocalizedAccountDescription(
  account: { code?: string | null; description?: string | null },
  locale: string = 'ar'
): string {
  const code = account.code?.trim() || ''
  if (code && STANDARD_ACCOUNT_TRANSLATIONS[code]?.description) {
    const desc = STANDARD_ACCOUNT_TRANSLATIONS[code].description!
    if (locale === 'en') return desc.en
    if (locale === 'tr') return desc.tr
    return desc.ar
  }
  return account.description?.trim() || ''
}

/**
 * Get localized account type label.
 */
export function getLocalizedAccountType(type: string, locale: string = 'ar'): string {
  const t: Record<string, { ar: string; en: string; tr: string }> = {
    asset: { ar: 'الأصول', en: 'Assets', tr: 'Varlıklar' },
    liability: { ar: 'الخصوم والالتزامات', en: 'Liabilities', tr: 'Yükümlülükler' },
    equity: { ar: 'حقوق الملكية', en: 'Equity', tr: 'Özkaynaklar' },
    revenue: { ar: 'الإيرادات', en: 'Revenue', tr: 'Gelirler' },
    expense: { ar: 'المصروفات', en: 'Expenses', tr: 'Giderler' },
  }

  const match = t[type.toLowerCase()]
  if (!match) return type
  if (locale === 'en') return match.en
  if (locale === 'tr') return match.tr
  return match.ar
}

/**
 * Get localized normal balance label (Debit/Credit).
 */
export function getLocalizedNormalBalance(balance: string, locale: string = 'ar'): string {
  const b = balance.toLowerCase()
  if (b === 'debit') {
    if (locale === 'en') return 'Debit'
    if (locale === 'tr') return 'Borç (Debit)'
    return 'مدين (Debit)'
  }
  if (b === 'credit') {
    if (locale === 'en') return 'Credit'
    if (locale === 'tr') return 'Alacak (Credit)'
    return 'دائن (Credit)'
  }
  return balance
}
