'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  FileSpreadsheet,
  Plus,
  Upload,
  Eye,
  CheckCircle2,
  Lock,
  Unlock,
  Trash2,
  FileText,
  Landmark,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { importBankStatementAction } from '@/actions/treasury/treasury-actions'

interface StatementRow {
  id: string
  statementNumber: string
  bankAccountId: string
  bankAccountName: string
  bankName: string
  accountNumber: string
  currency: string
  startDate: string
  endDate: string
  openingBalance: number
  closingBalance: number
  totalDebit: number
  totalCredit: number
  lineCount: number
  isReconciled: boolean
  createdAt: string
}

interface BankStatementsClientProps {
  businessId: string
  defaultCurrency: string
  statements: StatementRow[]
  bankAccounts: Array<{ id: string; name: string; bankName: string; currency: string; balance: number }>
}

interface StatementLineInput {
  date: string
  description: string
  reference: string
  amount: string
  type: 'debit' | 'credit'
  externalTxnId: string
}

export function BankStatementsClient({
  businessId,
  defaultCurrency,
  statements,
  bankAccounts,
}: BankStatementsClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [importMode, setImportMode] = useState<'grid' | 'csv'>('grid')
  const [csvText, setCsvText] = useState('')

  // Form State
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '')
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingBalance, setClosingBalance] = useState('')

  const [lines, setLines] = useState<StatementLineInput[]>([
    {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      reference: '',
      amount: '',
      type: 'credit',
      externalTxnId: '',
    },
  ])

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        date: new Date().toISOString().slice(0, 10),
        description: '',
        reference: '',
        amount: '',
        type: 'credit',
        externalTxnId: '',
      },
    ])
  }

  const handleRemoveLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx))
    }
  }

  const handleLineChange = (idx: number, field: keyof StatementLineInput, val: string) => {
    const updated = [...lines]
    updated[idx] = { ...updated[idx], [field]: val }
    setLines(updated)
  }

  const handleParseCsv = () => {
    if (!csvText.trim()) {
      toast.error(isAr ? 'يرجى لصق نص CSV' : isTr ? 'Lütfen CSV metnini yapıştırın' : 'Please paste CSV text')
      return
    }

    try {
      const rows = csvText.trim().split('\n')
      const parsedLines: StatementLineInput[] = []

      for (const row of rows) {
        if (!row.trim()) continue
        const cols = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        // Expect: Date, Description, Reference, Amount, Type (debit/credit), ExternalTxnId
        if (cols.length >= 4) {
          const rawAmount = parseFloat(cols[3]) || 0
          const rawType = (cols[4] || (rawAmount < 0 ? 'debit' : 'credit')).toLowerCase()
          parsedLines.push({
            date: cols[0] || new Date().toISOString().slice(0, 10),
            description: cols[1] || (isAr ? 'حركة بنكية' : isTr ? 'Banka işlemi' : 'Bank transaction'),
            reference: cols[2] || '',
            amount: Math.abs(rawAmount).toString(),
            type: rawType.includes('deb') ? 'debit' : 'credit',
            externalTxnId: cols[5] || '',
          })
        }
      }

      if (parsedLines.length === 0) {
        toast.error(isAr ? 'لم يتم العثور على أسطر صالحة في ملف CSV' : isTr ? 'CSV metninden geçerli satır ayrıştırılamadı' : 'No valid lines parsed from CSV')
        return
      }

      setLines(parsedLines)
      setImportMode('grid')
      toast.success(
        isAr
          ? `تم استخراج ${parsedLines.length} حركة بنكية بنجاح من نص CSV!`
          : isTr
          ? `CSV'den ${parsedLines.length} işlem satırı başarıyla ayrıştırıldı!`
          : `Successfully parsed ${parsedLines.length} transaction lines from CSV!`
      )
    } catch (e: any) {
      toast.error((isAr ? 'خطأ في معالجة CSV: ' : isTr ? 'CSV işleme hatası: ' : 'Error parsing CSV: ') + e.message)
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankAccountId) {
      toast.error(isAr ? 'يرجى اختيار الحساب البنكي' : isTr ? 'Lütfen bir banka hesabı seçin' : 'Please select a bank account')
      return
    }
    if (!openingBalance || !closingBalance) {
      toast.error(isAr ? 'الرصيد الافتتاحي والختامي مطلوبان' : isTr ? 'Açılış ve kapanış bakiyeleri zorunludur' : 'Opening and Closing balances are required')
      return
    }

    const validLines = lines.filter((l) => l.description.trim() && parseFloat(l.amount) > 0)
    if (validLines.length === 0) {
      toast.error(isAr ? 'يجب إدخال حركة بنكية صالحة واحدة على الأقل' : isTr ? 'En az bir geçerli işlem satırı gereklidir' : 'At least one valid transaction line is required')
      return
    }

    setLoading(true)
    try {
      const res = await importBankStatementAction(businessId, {
        bankAccountId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        openingBalance: parseFloat(openingBalance),
        closingBalance: parseFloat(closingBalance),
        lines: validLines.map((l) => ({
          date: new Date(l.date),
          description: l.description.trim(),
          reference: l.reference.trim() || undefined,
          amount: parseFloat(l.amount),
          type: l.type,
          externalTxnId: l.externalTxnId.trim() || undefined,
        })),
      })

      if (res.success) {
        toast.success(
          isAr
            ? `تم استيراد كشف الحساب ${(res.statement as any)?.statementNumber || ''} بنجاح!`
            : isTr
            ? `Banka ekstresi ${(res.statement as any)?.statementNumber || ''} başarıyla içe aktarıldı!`
            : `Bank Statement ${(res.statement as any)?.statementNumber || ''} imported successfully!`
        )
        setIsModalOpen(false)
        setLines([{ date: new Date().toISOString().slice(0, 10), description: '', reference: '', amount: '', type: 'credit', externalTxnId: '' }])
        setCsvText('')
        router.refresh()
      } else {
        toast.error(res.error || (isAr ? 'فشل استيراد كشف الحساب' : isTr ? 'Ekstre içe aktarılamadı' : 'Failed to import statement'))
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ ما' : isTr ? 'Bir hata oluştu' : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<StatementRow>[] = [
    {
      key: 'statementNumber',
      header: isAr ? 'رقم الكشف' : isTr ? 'Ekstre No' : 'Statement #',
      sortable: true,
      sortValue: (r) => r.statementNumber,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/treasury/statements/${r.id}`}
          style={{ fontWeight: 600, color: 'var(--color-brand-600)', textDecoration: 'none' }}
        >
          {r.statementNumber}
        </Link>
      ),
    },
    {
      key: 'bankAccount',
      header: isAr ? 'الحساب البنكي' : isTr ? 'Banka Hesabı' : 'Bank Account',
      sortable: true,
      sortValue: (r) => r.bankAccountName,
      accessor: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.bankAccountName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.bankName} • {r.accountNumber}</div>
        </div>
      ),
    },
    {
      key: 'period',
      header: isAr ? 'فترة الكشف' : isTr ? 'Ekstre Dönemi' : 'Statement Period',
      accessor: (r) => (
        <span style={{ fontSize: '0.8125rem' }}>
          {new Date(r.startDate).toLocaleDateString()} — {new Date(r.endDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'balances',
      header: isAr ? 'افتتاحي / ختامي' : isTr ? 'Açılış / Kapanış' : 'Opening / Closing',
      accessor: (r) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>{isAr ? 'افتتاحي:' : isTr ? 'Açılış:' : 'Open:'}</span> {formatCurrency(r.openingBalance, r.currency)}</div>
          <div style={{ fontWeight: 600 }}><span style={{ color: 'var(--text-muted)' }}>{isAr ? 'ختامي:' : isTr ? 'Kapanış:' : 'Close:'}</span> {formatCurrency(r.closingBalance, r.currency)}</div>
        </div>
      ),
    },
    {
      key: 'totals',
      header: isAr ? 'المدين / الدائن' : isTr ? 'Borç / Alacak' : 'Debits / Credits',
      accessor: (r) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <div style={{ color: 'var(--color-danger)' }}>{isAr ? 'مدين:' : isTr ? 'Borç:' : 'Debits:'} -{formatCurrency(r.totalDebit, r.currency)}</div>
          <div style={{ color: 'var(--color-success)' }}>{isAr ? 'دائن:' : isTr ? 'Alacak:' : 'Credits:'} +{formatCurrency(r.totalCredit, r.currency)}</div>
        </div>
      ),
    },
    {
      key: 'lines',
      header: isAr ? 'الأسطر' : isTr ? 'Satırlar' : 'Lines',
      accessor: (r) => <span className="badge badge-neutral">{r.lineCount} {isAr ? 'سطر' : isTr ? 'satır' : 'lines'}</span>,
    },
    {
      key: 'status',
      header: isAr ? 'حالة التسوية' : isTr ? 'Mutabakat Durumu' : 'Reconciliation',
      accessor: (r) => (
        <span className={`badge ${r.isReconciled ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          {r.isReconciled ? <Lock size={12} /> : <Unlock size={12} />}
          {r.isReconciled ? (isAr ? 'تمت التسوية' : isTr ? 'Mutabık' : 'Reconciled') : (isAr ? 'غير مسوى' : isTr ? 'Mutabakat Bekliyor' : 'Unreconciled')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: isAr ? 'الإجراءات' : isTr ? 'İşlemler' : 'Actions',
      accessor: (r) => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <Link
            href={`/b/${businessId}/treasury/statements/${r.id}`}
            className="btn btn-ghost btn-sm"
            title={isAr ? 'عرض التفاصيل' : isTr ? 'Detayları Gör' : 'View Details'}
          >
            <Eye size={14} /> {isAr ? 'عرض' : isTr ? 'Gör' : 'View'}
          </Link>
          <Link
            href={`/b/${businessId}/treasury/reconciliation`}
            className="btn btn-secondary btn-sm"
            title={isAr ? 'تسوية الكشف' : isTr ? 'Ekstreyi Eşleştir' : 'Reconcile Statement'}
          >
            {isAr ? 'تسوية' : isTr ? 'Mutabakat' : 'Reconcile'}
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {isAr ? 'الخزينة' : isTr ? 'Hazine' : 'Treasury'}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>
              {isAr ? 'كشوف الحسابات البنكية' : isTr ? 'Banka Ekstreleri' : 'Bank Statements'}
            </span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={26} className="text-brand-600" />
            {isAr ? 'كشوف الحسابات والتغذية البنكية الإلكترونية' : isTr ? 'Banka Ekstreleri ve Elektronik Akışlar' : 'Bank Statements & Electronic Feeds'}
          </h1>
          <p className="page-subtitle">
            {isAr
              ? 'استيراد ملفات الكشوف البنكية، فرز الحركات الدائنة والمدينة، وإدارة فترات التدقيق المحاسبي'
              : isTr
              ? 'Ekstre dosyalarını içe aktarın, borç/alacak satırlarını ayrıştırın ve denetim dönemlerini yönetin'
              : 'Import statement files, parse debits/credits, and maintain audit statement periods'}
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Upload size={16} />
          {isAr ? 'استيراد كشف حساب بنكي' : isTr ? 'Banka Ekstresi İçe Aktar' : 'Import Bank Statement'}
        </button>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="card-body">
          <DataTable
            data={statements}
            columns={columns}
            searchKey={(r) => `${r.statementNumber} ${r.bankAccountName} ${r.bankName}`}
            searchPlaceholder={isAr ? 'ابحث برقم الكشف، اسم الحساب، أو البنك...' : isTr ? 'Ekstre no, banka veya hesap adı ile ara...' : 'Search statements by number, bank account, or date...'}
            emptyTitle={isAr ? 'لم يتم استيراد أي كشوف حسابات بنكية بعد' : isTr ? 'Henüz banka ekstresi içe aktarılmadı' : 'No bank statements imported yet'}
            emptySubtext={isAr ? "انقر على 'استيراد كشف حساب بنكي' لرفع كشف الحساب الإلكتروني." : isTr ? "Elektronik ekstrenizi yüklemek için 'Banka Ekstresi İçe Aktar' düğmesine tıklayın." : "Click 'Import Bank Statement' to upload your electronic statement."}
          />
        </div>
      </div>

      {/* Import Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isAr ? 'استيراد كشف حساب بنكي إلكتروني' : isTr ? 'Elektronik Banka Ekstresi İçe Aktar' : 'Import Electronic Bank Statement'}
      >
        <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto', direction: isAr ? 'rtl' : 'ltr' }}>
          
          {/* Account Selection */}
          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {isAr ? 'الحساب البنكي المستهدف *' : isTr ? 'Hedef Banka Hesabı *' : 'Target Bank Account *'}
            </label>
            <select
              className="form-input"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)' }}
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              required
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.bankName} - {b.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Period & Balances */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? 'تاريخ بداية الفترة *' : isTr ? 'Dönem Başlangıç Tarihi *' : 'Period Start Date *'}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', padding: '0.4rem 0.6rem' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? 'تاريخ نهاية الفترة *' : isTr ? 'Dönem Bitiş Tarihi *' : 'Period End Date *'}
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', padding: '0.4rem 0.6rem' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? 'الرصيد الافتتاحي للكشف *' : isTr ? 'Ekstre Açılış Bakiyesi *' : 'Opening Statement Balance *'}
              </label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                style={{ width: '100%', padding: '0.4rem 0.6rem' }}
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                {isAr ? 'الرصيد الختامي للكشف *' : isTr ? 'Ekstre Kapanış Bakiyesi *' : 'Closing Statement Balance *'}
              </label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                style={{ width: '100%', padding: '0.4rem 0.6rem' }}
                placeholder="0.00"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Import Mode Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${importMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setImportMode('grid')}
            >
              {isAr ? `إدخال يدوي للأسطر (${lines.length})` : isTr ? `Manuel Satır Tablosu (${lines.length})` : `Manual Line Grid (${lines.length})`}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${importMode === 'csv' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setImportMode('csv')}
            >
              {isAr ? 'لصق نص CSV' : isTr ? 'CSV Metni Yapıştır' : 'Paste CSV Text'}
            </button>
          </div>

          {importMode === 'csv' ? (
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                {isAr ? 'الصيغة:' : isTr ? 'Biçim:' : 'Format:'} <code>YYYY-MM-DD, Description, Reference, Amount, credit/debit, ExternalTxnID</code>
              </p>
              <textarea
                className="form-input"
                rows={6}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8125rem' }}
                placeholder={`2026-03-01, Customer Wire Payment, INV-1001, 5000.00, credit, TXN-9988\n2026-03-02, Bank Account Monthly Fee, REF-FEE, 50.00, debit, TXN-9989`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.5rem' }}
                onClick={handleParseCsv}
              >
                {isAr ? 'معالجة أسطر CSV' : isTr ? 'CSV Satırlarını Ayrıştır' : 'Parse CSV Lines'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lines.map((l, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 90px 80px 30px', gap: '0.375rem', alignItems: 'center' }}>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      value={l.date}
                      onChange={(e) => handleLineChange(idx, 'date', e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      placeholder={isAr ? 'البيان *' : isTr ? 'Açıklama *' : 'Description *'}
                      value={l.description}
                      onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      placeholder={isAr ? 'المبلغ *' : isTr ? 'Tutar *' : 'Amount *'}
                      value={l.amount}
                      onChange={(e) => handleLineChange(idx, 'amount', e.target.value)}
                      required
                    />
                    <select
                      className="form-input"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      value={l.type}
                      onChange={(e) => handleLineChange(idx, 'type', e.target.value as any)}
                    >
                      <option value="credit">{isAr ? 'دائن (+)' : isTr ? 'Alacak (+)' : 'Credit (+)'}</option>
                      <option value="debit">{isAr ? 'مدين (-)' : isTr ? 'Borç (-)' : 'Debit (-)'}</option>
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      placeholder={isAr ? 'رقم المعاملة' : isTr ? 'İşlem No' : 'Txn ID'}
                      value={l.externalTxnId}
                      onChange={(e) => handleLineChange(idx, 'externalTxnId', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0 }}
                      title={isAr ? 'حذف السطر' : isTr ? 'Satırı Sil' : 'Remove Line'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: '0.5rem', color: 'var(--color-brand-600)' }}
                onClick={handleAddLine}
              >
                <Plus size={14} />
                {isAr ? 'إضافة سطر حركة' : isTr ? 'İşlem Satırı Ekle' : 'Add Transaction Line'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
            >
              {isAr ? 'إلغاء' : isTr ? 'İptal' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isAr ? 'جاري الاستيراد...' : isTr ? 'İçe Aktarılıyor...' : 'Importing...') : (isAr ? 'استيراد كشف الحساب' : isTr ? 'Ekstreyi İçe Aktar' : 'Import Statement')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
