'use client'

// =============================================================
// Document Template View — Printable HTML Document Component
// Supports: Invoices, Bills, Receipts, Vouchers, Statements
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import React from 'react'
import { DocumentTemplateData } from '@/lib/templates/document-template-service'
import { Printer, Download, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { printElement } from '@/utils/print-report'

interface Props {
  data: DocumentTemplateData
  backUrl?: string
  locale?: 'en' | 'ar' | 'tr'
}

const LABELS = {
  en: {
    invoice: 'SALES INVOICE',
    bill: 'PURCHASE BILL',
    receipt: 'PAYMENT RECEIPT',
    voucher: 'EXPENSE VOUCHER',
    statement: 'ACCOUNT STATEMENT',
    docNo: 'Document #',
    date: 'Date',
    dueDate: 'Due Date',
    from: 'From',
    billTo: 'Bill To',
    supplier: 'Supplier',
    item: 'Description',
    qty: 'Qty',
    price: 'Unit Price',
    tax: 'Tax',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    taxTotal: 'Tax Total',
    totalAmount: 'Total Amount',
    paid: 'Amount Paid',
    balanceDue: 'Balance Due',
    bankDetails: 'Bank Details',
    terms: 'Terms & Conditions',
    notes: 'Notes',
    print: 'Print Document',
    back: 'Back',
  },
  ar: {
    invoice: 'فاتورة مبيعات',
    bill: 'فاتورة مشتريات',
    receipt: 'إيصال دفع',
    voucher: 'سند صرف',
    statement: 'كشف حساب',
    docNo: 'رقم المستند',
    date: 'التاريخ',
    dueDate: 'تاريخ الاستحقاق',
    from: 'من',
    billTo: 'إلى',
    supplier: 'المورد',
    item: 'الوصف / البند',
    qty: 'الكمية',
    price: 'سعر الوحدة',
    tax: 'الضريبة',
    total: 'الإجمالي',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    taxTotal: 'إجمالي الضريبة',
    totalAmount: 'المبلغ الإجمالي',
    paid: 'المبلغ المدفوع',
    balanceDue: 'المبلغ المتبقي',
    bankDetails: 'تفاصيل الحساب البنكي',
    terms: 'الشروط والأحكام',
    notes: 'ملاحظات',
    print: 'طباعة المستند',
    back: 'رجوع',
  },
  tr: {
    invoice: 'SATIŞ FATURASI',
    bill: 'ALIŞ FATURASI',
    receipt: 'ÖDEME MAKBUZU',
    voucher: 'GİDER MAKBUZU',
    statement: 'HESAP EKSTRESİ',
    docNo: 'Belge No',
    date: 'Tarih',
    dueDate: 'Vade Tarihi',
    from: 'Kimden',
    billTo: 'Kime',
    supplier: 'Tedarikçi',
    item: 'Açıklama',
    qty: 'Miktar',
    price: 'Birim Fiyat',
    tax: 'Vergi',
    total: 'Toplam',
    subtotal: 'Ara Toplam',
    discount: 'İndirim',
    taxTotal: 'Vergi Toplamı',
    totalAmount: 'Genel Toplam',
    paid: 'Ödenen Tutar',
    balanceDue: 'Kalan Bakiye',
    bankDetails: 'Banka Bilgileri',
    terms: 'Şartlar ve Koşullar',
    notes: 'Notlar',
    print: 'Belgeyi Yazdır',
    back: 'Geri',
  },
}

export function DocumentTemplateView({ data, backUrl, locale: propLocale }: Props) {
  const currentLocale = useLocale() as 'en' | 'ar' | 'tr'
  const locale = propLocale || currentLocale || 'en'
  const isRtl = locale === 'ar'
  const t = LABELS[locale] || LABELS.en

  const getDocTitle = () => {
    switch (data.type) {
      case 'sales_invoice':
        return t.invoice
      case 'purchase_invoice':
        return t.bill
      case 'payment_receipt':
        return t.receipt
      case 'expense_voucher':
        return t.voucher
      case 'customer_statement':
      case 'supplier_statement':
        return t.statement
      default:
        return 'DOCUMENT'
    }
  }

  const formatCurrency = (amt: number) => {
    return `${data.currency} ${amt.toLocaleString(locale === 'ar' ? 'ar-SA' : locale === 'tr' ? 'tr-TR' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const handlePrint = () => {
    printElement('printable-document', {
      title: `${getDocTitle()} - ${data.documentNumber}`,
      businessName: data.company.name,
      isAr: isRtl,
    })
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      {/* Top Action Bar (hidden when printing) */}
      <div
        className="no-print"
        style={{
          maxWidth: '850px',
          margin: '0 auto 1.5rem auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {backUrl ? (
          <Link
            href={backUrl}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={16} /> {t.back}
          </Link>
        ) : (
          <div />
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: data.accentColor || '#4f46e5' }}
          >
            <Printer size={16} /> {t.print}
          </button>
        </div>
      </div>

      {/* Main Printable Document Card */}
      <div
        id="printable-document"
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          maxWidth: '850px',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          padding: '3rem',
          color: '#1e293b',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header: Company & Title */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '2rem',
            marginBottom: '2rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: data.accentColor || '#1e293b', margin: 0 }}>
              {data.company.name}
            </h1>
            {data.company.legalName && data.company.legalName !== data.company.name && (
              <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#64748b' }}>{data.company.legalName}</p>
            )}
            <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
              {data.company.address && <div>{data.company.address}</div>}
              {data.company.phone && <div>Tel: {data.company.phone}</div>}
              {data.company.email && <div>Email: {data.company.email}</div>}
              {data.company.taxNumber && <div>Tax ID: {data.company.taxNumber}</div>}
            </div>
          </div>

          <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
                color: data.accentColor || '#4f46e5',
                marginBottom: '0.75rem',
              }}
            >
              {getDocTitle()}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
              <div>
                <strong>{t.docNo}:</strong> {data.documentNumber}
              </div>
              <div>
                <strong>{t.date}:</strong> {data.date}
              </div>
              {data.dueDate && (
                <div>
                  <strong>{t.dueDate}:</strong> {data.dueDate}
                </div>
              )}
              {data.reference && (
                <div>
                  <strong>Ref:</strong> {data.reference}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bill To / Recipient Info */}
        {data.party && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '1.25rem',
              marginBottom: '2rem',
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '0.25rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              {data.type === 'purchase_invoice' ? t.supplier : t.billTo}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{data.party.name}</div>
            {data.party.companyName && data.party.companyName !== data.party.name && (
              <div style={{ fontSize: '0.875rem', color: '#475569' }}>{data.party.companyName}</div>
            )}
            {data.party.address && <div style={{ fontSize: '0.875rem', color: '#475569' }}>{data.party.address}</div>}
            {data.party.taxNumber && (
              <div style={{ fontSize: '0.875rem', color: '#475569' }}>Tax ID: {data.party.taxNumber}</div>
            )}
          </div>
        )}

        {/* Items Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '2rem',
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f1f5f9' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>#</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                {t.item}
              </th>
              <th
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#334155',
                  textAlign: isRtl ? 'left' : 'right',
                }}
              >
                {t.qty}
              </th>
              <th
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#334155',
                  textAlign: isRtl ? 'left' : 'right',
                }}
              >
                {t.price}
              </th>
              {data.taxTotal > 0 && (
                <th
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#334155',
                    textAlign: isRtl ? 'left' : 'right',
                  }}
                >
                  {t.tax}
                </th>
              )}
              <th
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#334155',
                  textAlign: isRtl ? 'left' : 'right',
                }}
              >
                {t.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#64748b' }}>{idx + 1}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  {item.description && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{item.description}</div>
                  )}
                </td>
                <td
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    textAlign: isRtl ? 'left' : 'right',
                    color: '#334155',
                  }}
                >
                  {item.quantity}
                </td>
                <td
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    textAlign: isRtl ? 'left' : 'right',
                    color: '#334155',
                  }}
                >
                  {formatCurrency(item.unitPrice)}
                </td>
                {data.taxTotal > 0 && (
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      textAlign: isRtl ? 'left' : 'right',
                      color: '#64748b',
                    }}
                  >
                    {item.taxRate ? `${item.taxRate}%` : '—'}
                  </td>
                )}
                <td
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textAlign: isRtl ? 'left' : 'right',
                    color: '#0f172a',
                  }}
                >
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
          <div style={{ width: '320px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '0.875rem',
                color: '#475569',
              }}
            >
              <span>{t.subtotal}:</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>

            {data.discountTotal > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.875rem',
                  color: '#e11d48',
                }}
              >
                <span>{t.discount}:</span>
                <span>-{formatCurrency(data.discountTotal)}</span>
              </div>
            )}

            {data.taxTotal > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.875rem',
                  color: '#475569',
                }}
              >
                <span>{t.taxTotal}:</span>
                <span>{formatCurrency(data.taxTotal)}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.75rem 0',
                borderBottom: '2px solid #0f172a',
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              <span>{t.totalAmount}:</span>
              <span>{formatCurrency(data.total)}</span>
            </div>

            {data.amountPaid > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.875rem',
                  color: '#16a34a',
                }}
              >
                <span>{t.paid}:</span>
                <span>{formatCurrency(data.amountPaid)}</span>
              </div>
            )}

            {data.balanceDue > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#e11d48',
                }}
              >
                <span>{t.balanceDue}:</span>
                <span>{formatCurrency(data.balanceDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Banking & Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', fontSize: '0.85rem' }}>
          <div>
            {data.bankDetails && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#334155', display: 'block', marginBottom: '0.25rem' }}>{t.bankDetails}</strong>
                <p style={{ margin: 0, color: '#64748b', whiteSpace: 'pre-line' }}>{data.bankDetails}</p>
              </div>
            )}
            {data.terms && (
              <div>
                <strong style={{ color: '#334155', display: 'block', marginBottom: '0.25rem' }}>{t.terms}</strong>
                <p style={{ margin: 0, color: '#64748b' }}>{data.terms}</p>
              </div>
            )}
          </div>

          <div>
            {data.notes && (
              <div>
                <strong style={{ color: '#334155', display: 'block', marginBottom: '0.25rem' }}>{t.notes}</strong>
                <p style={{ margin: 0, color: '#64748b', whiteSpace: 'pre-line' }}>{data.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '3rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#94a3b8',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '1rem',
          }}
        >
          {data.company.name} • {data.company.website || data.company.email || 'AccountFlow ERP'}
        </div>
      </div>

      {/* Global CSS for Print Mode */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-document {
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          aside, header, nav, .sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
