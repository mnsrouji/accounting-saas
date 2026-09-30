// =============================================================
// Internationalization (i18n) — Dictionaries & Locale Helpers
// Supports: English (en), Arabic (ar), Turkish (tr)
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

export type SupportedLocale = 'en' | 'ar' | 'tr'

export interface TranslationDictionary {
  common: {
    dashboard: string
    sales: string
    purchases: string
    payments: string
    expenses: string
    inventory: string
    accounting: string
    reports: string
    settings: string
    audit: string
    save: string
    cancel: string
    delete: string
    edit: string
    create: string
    print: string
    export: string
    status: string
    date: string
    amount: string
    total: string
    balance: string
    customer: string
    supplier: string
    product: string
    loading: string
    back: string
  }
  settings: {
    title: string
    subtitle: string
    companyProfile: string
    financialSettings: string
    currencies: string
    taxes: string
    accountingDefaults: string
    numbering: string
    templates: string
    localization: string
    saveSuccess: string
    baseCurrencyNote: string
  }
  documents: {
    invoice: string
    bill: string
    receipt: string
    voucher: string
    statement: string
    subtotal: string
    discount: string
    taxTotal: string
    grandTotal: string
    paidAmount: string
    balanceDue: string
  }
}

export const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  en: {
    common: {
      dashboard: 'Dashboard',
      sales: 'Sales',
      purchases: 'Purchases',
      payments: 'Payments',
      expenses: 'Expenses',
      inventory: 'Inventory',
      accounting: 'Accounting',
      reports: 'Reports',
      settings: 'Settings',
      audit: 'Audit Trail',
      save: 'Save Changes',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      print: 'Print',
      export: 'Export',
      status: 'Status',
      date: 'Date',
      amount: 'Amount',
      total: 'Total',
      balance: 'Balance',
      customer: 'Customer',
      supplier: 'Supplier',
      product: 'Product',
      loading: 'Loading...',
      back: 'Back',
    },
    settings: {
      title: 'Business Configuration',
      subtitle: 'Manage organization details, financial settings, taxes & document templates',
      companyProfile: 'Company Profile',
      financialSettings: 'Financial & Currencies',
      currencies: 'Currencies & Rates',
      taxes: 'Tax Configuration',
      accountingDefaults: 'Default Accounts',
      numbering: 'Document Numbering',
      templates: 'Document Templates',
      localization: 'Localization & Language',
      saveSuccess: 'Settings saved successfully',
      baseCurrencyNote: 'Base currency is used for all general ledger calculations and financial reports.',
    },
    documents: {
      invoice: 'Sales Invoice',
      bill: 'Purchase Bill',
      receipt: 'Payment Receipt',
      voucher: 'Expense Voucher',
      statement: 'Account Statement',
      subtotal: 'Subtotal',
      discount: 'Discount',
      taxTotal: 'Tax Total',
      grandTotal: 'Total Amount',
      paidAmount: 'Amount Paid',
      balanceDue: 'Balance Due',
    },
  },
  ar: {
    common: {
      dashboard: 'لوحة التحكم',
      sales: 'المبيعات',
      purchases: 'المشتريات',
      payments: 'المدفوعات والمقبوضات',
      expenses: 'المصروفات',
      inventory: 'المخزون والمستودعات',
      accounting: 'المحاسبة ودفتر الأستاذ',
      reports: 'التقارير المالية',
      settings: 'الإعدادات والتهيئة',
      audit: 'سجل التدقيق',
      save: 'حفظ التعديلات',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      create: 'إنشاء',
      print: 'طباعة',
      export: 'تصدير',
      status: 'الحالة',
      date: 'التاريخ',
      amount: 'المبلغ',
      total: 'الإجمالي',
      balance: 'الرصيد',
      customer: 'العميل',
      supplier: 'المورد',
      product: 'المنتج',
      loading: 'جاري التحميل...',
      back: 'رجوع',
    },
    settings: {
      title: 'إعدادات المنشأة',
      subtitle: 'إدارة ملف الشركة، الإعدادات المالية، الضرائب وقوالب المستندات',
      companyProfile: 'ملف المنشأة',
      financialSettings: 'الإعدادات المالية والعملات',
      currencies: 'العملات وأسعار الصرف',
      taxes: 'إعدادات الضرائب',
      accountingDefaults: 'الحسابات الافتراضية',
      numbering: 'ترقيم المستندات',
      templates: 'قوالب المستندات',
      localization: 'اللغة والتهيئة الإقليمية',
      saveSuccess: 'تم حفظ الإعدادات بنجاح',
      baseCurrencyNote: 'تُستخدم العملة الأساسية في جميع حسابات دفتر الأستاذ والتقارير المالية.',
    },
    documents: {
      invoice: 'فاتورة مبيعات',
      bill: 'فاتورة مشتريات',
      receipt: 'إيصال دفع',
      voucher: 'سند صرف',
      statement: 'كشف حساب',
      subtotal: 'المجموع الفرعي',
      discount: 'الخصم',
      taxTotal: 'إجمالي الضريبة',
      grandTotal: 'المبلغ الإجمالي',
      paidAmount: 'المبلغ المدفوع',
      balanceDue: 'المبلغ المتبقي',
    },
  },
  tr: {
    common: {
      dashboard: 'Gösterge Paneli',
      sales: 'Satışlar',
      purchases: 'Satın Almalar',
      payments: 'Ödemeler',
      expenses: 'Giderler',
      inventory: 'Stok ve Envanter',
      accounting: 'Muhasebe',
      reports: 'Mali Raporlar',
      settings: 'Ayarlar',
      audit: 'Denetim İzi',
      save: 'Değişiklikleri Kaydet',
      cancel: 'İptal',
      delete: 'Sil',
      edit: 'Düzenle',
      create: 'Oluştur',
      print: 'Yazdır',
      export: 'Dışa Aktar',
      status: 'Durum',
      date: 'Tarih',
      amount: 'Tutar',
      total: 'Toplam',
      balance: 'Bakiye',
      customer: 'Müşteri',
      supplier: 'Tedarikçi',
      product: 'Ürün',
      loading: 'Yükleniyor...',
      back: 'Geri',
    },
    settings: {
      title: 'İşletme Ayarları',
      subtitle: 'Şirket profili, mali ayarlar, vergiler ve belge şablonlarını yönetin',
      companyProfile: 'Şirket Profili',
      financialSettings: 'Mali & Para Birimi Ayarları',
      currencies: 'Para Birimleri & Kurlar',
      taxes: 'Vergi Yapılandırması',
      accountingDefaults: 'Varsayılan Hesaplar',
      numbering: 'Belge Numaralandırma',
      templates: 'Belge Şablonları',
      localization: 'Dil ve Yerelleştirme',
      saveSuccess: 'Ayarlar başarıyla kaydedildi',
      baseCurrencyNote: 'Temel para birimi tüm defter-i kebir ve mali raporlar için kullanılır.',
    },
    documents: {
      invoice: 'Satış Faturası',
      bill: 'Alış Faturası',
      receipt: 'Ödeme Makbuzu',
      voucher: 'Gider Makbuzu',
      statement: 'Hesap Ekstresi',
      subtotal: 'Ara Toplam',
      discount: 'İndirim',
      taxTotal: 'Vergi Toplamı',
      grandTotal: 'Genel Toplam',
      paidAmount: 'Ödenen Tutar',
      balanceDue: 'Kalan Bakiye',
    },
  },
}

export function getDictionary(locale: SupportedLocale = 'en'): TranslationDictionary {
  return DICTIONARIES[locale] || DICTIONARIES.en
}

export function isRTL(locale: string): boolean {
  return locale === 'ar'
}
