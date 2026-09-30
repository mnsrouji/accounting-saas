import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SettingsService } from '@/lib/services/settings-service'
import { SettingsNav } from '@/components/settings/settings-nav'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import {
  Building,
  DollarSign,
  Coins,
  Percent,
  BookOpen,
  Hash,
  FileText,
  Globe,
  ArrowRight,
  Database,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Settings Overview | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function SettingsOverviewPage({ params }: PageProps) {
  const { businessId } = await params
  await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const settings = await SettingsService.getBusinessSettings(businessId)

  const cards = [
    {
      title: isAr ? 'النسخ الاحتياطي وإدارة البيانات' : isTr ? 'Yedekleme ve Veri Yönetimi' : 'Backup & Data Management',
      desc: isAr
        ? 'تصدير نسخ احتياطية بصيغة JSON، استعادة لقطات سابقة، أو تفريغ البيانات التشغيلية بأمان'
        : isTr
        ? 'JSON yedekleri dışa aktarın, geçmiş anlık görüntüleri geri yükleyin veya verileri yönetin'
        : 'Export JSON backups, restore historical snapshots, or safely purge operational data',
      href: `/b/${businessId}/settings/backup`,
      icon: Database,
      status: isAr ? 'نشط ومحمي' : isTr ? 'Aktif ve Korumalı' : 'Active & Protected',
    },
    {
      title: isAr ? 'الملف التعريفي للشركة' : isTr ? 'Şirket Profili' : 'Company Profile',
      desc: isAr
        ? 'الاسم القانوني للمنشأة، العنوان، الرقم الضريبي، السجل التجاري، وبيانات الاتصال'
        : isTr
        ? 'Şirket yasal adı, adresi, vergi numarası, ticaret sicili ve iletişim bilgileri'
        : 'Business legal name, address, tax ID, registration and contact details',
      href: `/b/${businessId}/settings/company`,
      icon: Building,
      status: settings.company.name,
    },
    {
      title: isAr ? 'الإعدادات المالية والسنة المالية' : isTr ? 'Mali ve Hesap Dönemi' : 'Financial & Fiscal Year',
      desc: isAr
        ? 'عملة الأساس التشغيلية، جدول السنة المالية، شروط السداد، وتنسيقات الأرقام'
        : isTr
        ? 'Ana faaliyet para birimi, mali yıl takvimi, ödeme vadeleri ve biçimlendirme'
        : 'Base operating currency, fiscal year schedule, payment terms and formatting',
      href: `/b/${businessId}/settings/financial`,
      icon: DollarSign,
      status: `${isAr ? 'الأساس: ' : isTr ? 'Ana: ' : 'Base: '}${settings.financial.baseCurrency}`,
    },
    {
      title: isAr ? 'العملات وأسعار الصرف' : isTr ? 'Para Birimleri ve Kurlar' : 'Currencies & Exchange Rates',
      desc: isAr
        ? 'العملات العالمية المدعومة، أسعار الصرف الحية، والتحويلات متعددة العملات'
        : isTr
        ? 'Desteklenen küresel para birimleri, döviz kurları ve çoklu para birimi dönüşümleri'
        : 'Supported global currencies, exchange rates and multi-currency conversions',
      href: `/b/${businessId}/settings/currencies`,
      icon: Coins,
      status: isAr ? 'متعدد العملات نشط' : isTr ? 'Çoklu Para Birimi Aktif' : 'Multi-Currency Active',
    },
    {
      title: isAr ? 'إعدادات وضرائب القيمة المضافة' : isTr ? 'Vergi Yapılandırması' : 'Tax Configuration',
      desc: isAr
        ? 'نسب ضريبة المبيعات والمشتريات، قواعد ضريبة القيمة المضافة، وربط حسابات الضرائب بدليل الحسابات'
        : isTr
        ? 'Satış ve alış vergi oranları, KDV kuralları ve büyük defter vergi hesabı eşleştirmeleri'
        : 'Sales and purchase tax rates, VAT rules, and General Ledger tax account mappings',
      href: `/b/${businessId}/settings/taxes`,
      icon: Percent,
      status: isAr ? 'قابل للتعديل' : isTr ? 'Yapılandırılabilir' : 'Configurable',
    },
    {
      title: isAr ? 'الحسابات الافتراضية التلقائية' : isTr ? 'Varsayılan Hesaplar' : 'Default Accounts',
      desc: isAr
        ? 'ربط الحسابات الافتراضية لقيود الذمم المدينة والدائنة والإيرادات وتكلفة المبيعات والمخزون الآلية'
        : isTr
        ? 'Otomatik alacak, borç, gelir, SMM ve stok kayıtları için varsayılan hesap planı eşleştirmesi'
        : 'Map default Chart of Accounts for automated AR, AP, Revenue, COGS, and Inventory entries',
      href: `/b/${businessId}/settings/accounting`,
      icon: BookOpen,
      status: isAr ? 'مربوط' : isTr ? 'Eşleştirildi' : 'Mapped',
    },
    {
      title: isAr ? 'ترقيم وتسلسل المستندات' : isTr ? 'Belge Numaralandırma' : 'Document Numbering',
      desc: isAr
        ? 'البادئات، عدد الخانات، وأنماط التسلسل التلقائي للفواتير والسندات والقيود'
        : isTr
        ? 'Faturalar, makbuzlar, ödemeler ve yevmiyeler için önek ve sıra şablonları'
        : 'Prefixes, padding, and sequence patterns for invoices, bills, payments, and journals',
      href: `/b/${businessId}/settings/numbering`,
      icon: Hash,
      status: isAr ? 'متسلسل' : isTr ? 'Sıralandı' : 'Sequenced',
    },
    {
      title: isAr ? 'قوالب وتصاميم المستندات' : isTr ? 'Belge Şablonları' : 'Document Templates',
      desc: isAr
        ? 'تخطيطات الطباعة المخصصة، ألوان الهوية، بيانات الدفع البنكي، والشروط والأحكام'
        : isTr
        ? 'Markalı yazdırılabilir tasarımlar, tema renkleri, banka bilgileri ve şartlar'
        : 'Branded printable layouts, accent colors, bank payment info, terms & conditions',
      href: `/b/${businessId}/settings/templates`,
      icon: FileText,
      status: isAr ? 'قابل للتخصيص' : isTr ? 'Özelleştirilebilir' : 'Customizable',
    },
    {
      title: isAr ? 'اللغة والتعريب الإقليمي' : isTr ? 'Yerelleştirme ve Dil' : 'Localization & Language',
      desc: isAr
        ? 'اختيار لغة العرض (العربية، التركية، الإنجليزية)، اتجاه الواجهة (RTL/LTR)، والتنسيقات الإقليمية'
        : isTr
        ? 'Dil seçimi (İngilizce, Arapça, Türkçe), RTL/LTR yönü ve bölgesel biçimlendirme'
        : 'Language selection (English, Arabic, Turkish), RTL/LTR direction, and regional formats',
      href: `/b/${businessId}/settings/localization`,
      icon: Globe,
      status: settings.localization.defaultLanguage.toUpperCase(),
    },
  ]

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isAr ? 'إعدادات وتهيئة المنشأة' : isTr ? 'İşletme Ayarları ve Yapılandırma' : 'Business Settings & Configuration'}
          </h1>
          <p className="page-subtitle">
            {isAr
              ? 'تهيئة ملف المنشأة، القواعد المالية، ربط الضرائب، وقوالب المستندات الرسمية'
              : isTr
              ? 'Kuruluş profilini, mali kuralları, vergi eşleştirmelerini ve belge şablonlarını yapılandırın'
              : 'Configure organization profile, financial rules, tax mappings, and document templates'}
          </p>
        </div>
      </div>

      <SettingsNav businessId={businessId} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                className="card table-row-hover"
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        background: 'rgba(79, 70, 229, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-brand-500, #4f46e5)',
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                      {card.status}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {card.desc}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    marginTop: '1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--color-brand-500, #4f46e5)',
                  }}
                >
                  {isAr ? 'تهيئة الإعدادات' : isTr ? 'Yapılandır' : 'Configure'}{' '}
                  <ArrowRight size={14} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
