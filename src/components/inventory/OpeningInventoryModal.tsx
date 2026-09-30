'use client'

import React, { useState, useRef } from 'react'
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  PackagePlus,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/utils/decimal'
import { AccountSearchSelect, SearchableAccountItem } from '@/components/accounting/AccountSearchSelect'
import {
  validateOpeningInventoryExcelAction,
  importOpeningInventoryAction,
} from '@/actions/inventory/opening-stock-actions'
import {
  ParsedOpeningStockRow,
  OpeningStockValidationSummary,
} from '@/lib/services/opening-inventory-service'

interface OpeningInventoryModalProps {
  businessId: string
  defaultCurrency: string
  glAccounts: SearchableAccountItem[]
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
}

export function OpeningInventoryModal({
  businessId,
  defaultCurrency,
  glAccounts,
  isOpen,
  onClose,
  onImportSuccess,
}: OpeningInventoryModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)

  const [validationData, setValidationData] = useState<OpeningStockValidationSummary | null>(null)
  const [filterRowStatus, setFilterRowStatus] = useState<'all' | 'valid' | 'warning' | 'error'>('all')

  // Accounting Sync Configuration
  const [postJournalEntry, setPostJournalEntry] = useState(true)
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().split('T')[0])
  const [inventoryAccountId, setInventoryAccountId] = useState('')
  const [equityAccountId, setEquityAccountId] = useState('')

  const [importResult, setImportResult] = useState<{
    importedCount: number
    totalQuantity: number
    totalValuation: number
    journalEntryNumber?: string | null
  } | null>(null)

  const handleReset = () => {
    setSelectedFile(null)
    setValidationData(null)
    setImportResult(null)
    setActiveTab('upload')
    setFilterRowStatus('all')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleModalClose = () => {
    handleReset()
    onClose()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const processFile = async (file: File) => {
    const validExts = ['.xlsx', '.xls', '.csv']
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      toast.error('يرجى اختيار ملف إكسل صالح بصيغة (.xlsx أو .xls أو .csv)')
      return
    }

    setSelectedFile(file)
    setValidating(true)
    setValidationData(null)
    setImportResult(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      const res = await validateOpeningInventoryExcelAction(businessId, base64)

      if (res.success && res.data) {
        setValidationData(res.data)
        // Pre-fill suggested GL accounts if found
        if (res.data.suggestedInventoryAccount) {
          setInventoryAccountId(res.data.suggestedInventoryAccount.id)
        }
        if (res.data.suggestedEquityAccount) {
          setEquityAccountId(res.data.suggestedEquityAccount.id)
        }

        setActiveTab('preview')
        if (res.data.errorCount > 0) {
          toast.warning(`تم فحص الملف: وُجد ${res.data.errorCount} خطأ بحاجة للمعالجة قبل الاستيراد.`)
        } else {
          toast.success(
            `تم فحص ملف بضاعة أول المدة بنجاح! جاهز لاستيراد ${res.data.validCount} صنف بقيمة ${formatCurrency(
              res.data.totalValuation,
              defaultCurrency
            )}`
          )
        }
      } else {
        toast.error(res.error || 'فشل في تحليل الملف')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء قراءة الملف')
    } finally {
      setValidating(false)
    }
  }

  const handleExecuteImport = async () => {
    if (!validationData || !validationData.rows.length) return

    setImporting(true)
    try {
      const res = await importOpeningInventoryAction(businessId, validationData.rows, {
        postOpeningJournalEntry: postJournalEntry,
        openingDate,
        inventoryAccountId: inventoryAccountId || undefined,
        equityAccountId: equityAccountId || undefined,
        defaultWarehouseId: validationData.defaultWarehouse?.id,
      })

      if (res.success && res.result) {
        setImportResult(res.result)
        toast.success(
          `تم استيراد بضاعة أول المدة بنجاح! (${res.result.importedCount} صنف، إجمالي القيمة: ${formatCurrency(
            res.result.totalValuation,
            defaultCurrency
          )})`
        )
        onImportSuccess()
      } else {
        toast.error(res.error || 'فشل في استيراد بضاعة أول المدة')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع')
    } finally {
      setImporting(false)
    }
  }

  const filteredRows = (validationData?.rows || []).filter((r) => {
    if (filterRowStatus === 'all') return true
    return r.status === filterRowStatus
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="استيراد مخزون بضاعة أول المدة والمطابقة مع القيد الافتتاحي"
      maxWidth="1000px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Navigation Step Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud size={15} style={{ marginInlineEnd: '0.375rem' }} />
            1. تحميل القالب ورفع ملف الجرد
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('preview')}
            disabled={!validationData}
          >
            <PackagePlus size={15} style={{ marginInlineEnd: '0.375rem' }} />
            2. معاينة المخزون والتقييم والقيد الافتتاحي ({validationData?.totalRows || 0})
          </button>
        </div>

        {/* TAB 1: UPLOAD & TEMPLATE */}
        {activeTab === 'upload' && !importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Template Download Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.05))',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--border-radius)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                    قالب إكسل الجاهز لبضاعة أول المدة (Opening Stock Template)
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    حمّل النموذج المعتمد لإدخال أصناف المخزون الافتتاحي، الكميات، أسعار التكلفة، وأكواد المستودعات.
                  </p>
                </div>
              </div>

              <a
                href={`/api/b/${businessId}/inventory/opening-stock/template`}
                download
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
              >
                <Download size={16} />
                تحميل نموذج الإكسل (.xlsx)
              </a>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--border-radius)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                {validating ? <RefreshCw size={28} className="animate-spin" /> : <UploadCloud size={28} />}
              </div>

              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>
                {validating ? 'جاري فحص أصناف المخزون وحساب التقييم المالي...' : 'اسحب وأفلت ملف بضاعة أول المدة هنا، أو انقر للتصفح'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                يدعم ملفات Excel (.xlsx, .xls) و CSV • سيتم احتساب تقييم المخزون المالي تلقائياً
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE PREVIEW & OPENING JOURNAL INTEGRATION */}
        {activeTab === 'preview' && validationData && !importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Valuation & Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>إجمالي قيمة المخزون الافتتاحي</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                  {formatCurrency(validationData.totalValuation, defaultCurrency)}
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>إجمالي الأصناف</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{validationData.totalRows} صنف</div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>إجمالي الوحدات/القطع</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{validationData.totalQuantity.toLocaleString()} وحدة</div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: validationData.errorCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)',
                  border: `1px solid ${validationData.errorCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`,
                  color: validationData.errorCount > 0 ? '#ef4444' : 'var(--text-muted)',
                }}
              >
                <div style={{ fontSize: '0.75rem' }}>الأخطاء المكتشفة</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{validationData.errorCount}</div>
              </div>
            </div>

            {/* OPENING JOURNAL ENTRY SETTINGS CARD */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
                padding: '1.125rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={18} style={{ color: 'var(--primary-color)' }} />
                  <strong style={{ fontSize: '0.9rem' }}>المطابقة المحاسبية وتوليد القيد الافتتاحي (GL Opening Balance):</strong>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={postJournalEntry}
                    onChange={(e) => setPostJournalEntry(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>توليد وترحيل القيد الافتتاحي آلياً في دفتر الأستاذ العام</span>
                </label>
              </div>

              {postJournalEntry && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.775rem' }}>تاريخ القيد الافتتاحي *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={openingDate}
                      onChange={(e) => setOpeningDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.775rem' }}>حساب مخزون البضاعة (مدين) *</label>
                    <AccountSearchSelect
                      accounts={glAccounts}
                      value={inventoryAccountId}
                      onChange={(val) => setInventoryAccountId(val)}
                      placeholder="-- حساب مخزون البضاعة (1400) --"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.775rem' }}>حساب حقوق الملكية / رأس المال (دائن) *</label>
                    <AccountSearchSelect
                      accounts={glAccounts}
                      value={equityAccountId}
                      onChange={(val) => setEquityAccountId(val)}
                      placeholder="-- رأس المال / أرصدة افتتاحية (3000) --"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Journal Preview Banner */}
              {postJournalEntry && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={16} style={{ color: 'var(--primary-color)' }} />
                    <span>
                      <strong>قيد متوازن 100%:</strong> من حـ/ المخزون (مدين: {formatCurrency(validationData.totalValuation, defaultCurrency)}) إلى حـ/ رأس المال (دائن: {formatCurrency(validationData.totalValuation, defaultCurrency)})
                    </span>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>متطابق محاسبياً</span>
                </div>
              )}
            </div>

            {/* Preview Table Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${filterRowStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterRowStatus('all')}
                >
                  الكل ({validationData.rows.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${filterRowStatus === 'valid' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterRowStatus('valid')}
                >
                  <CheckCircle2 size={13} style={{ marginInlineEnd: '0.25rem', color: '#10b981' }} />
                  السليم ({validationData.rows.filter((r) => r.status === 'valid').length})
                </button>
                {validationData.errorCount > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${filterRowStatus === 'error' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilterRowStatus('error')}
                  >
                    <XCircle size={13} style={{ marginInlineEnd: '0.25rem', color: '#ef4444' }} />
                    الأخطاء ({validationData.errorCount})
                  </button>
                )}
              </div>

              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                الملف: <strong>{selectedFile?.name}</strong>
              </span>
            </div>

            {/* Preview Table */}
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
              }}
            >
              <table className="table" style={{ margin: 0, fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2 }}>
                    <th style={{ width: '40px' }}>#</th>
                    <th>كود الصنف (SKU)</th>
                    <th>اسم الصنف</th>
                    <th>المستودع</th>
                    <th>الوحدة</th>
                    <th>الكمية</th>
                    <th>سعر التكلفة</th>
                    <th>إجمالي القيمة</th>
                    <th>الحالة والملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, idx) => (
                    <tr
                      key={idx}
                      style={{
                        backgroundColor:
                          r.status === 'error'
                            ? 'rgba(239, 68, 68, 0.04)'
                            : r.status === 'warning'
                            ? 'rgba(245, 158, 11, 0.04)'
                            : undefined,
                      }}
                    >
                      <td style={{ color: 'var(--text-muted)' }}>{r.rowIndex}</td>
                      <td>
                        <strong style={{ fontFamily: 'monospace' }}>{r.sku}</strong>
                      </td>
                      <td>{r.name}</td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                          {r.warehouseCode}
                        </span>
                      </td>
                      <td>{r.unitOfMeasure}</td>
                      <td style={{ fontWeight: 600 }}>{r.quantity}</td>
                      <td>{formatCurrency(r.unitCost, defaultCurrency)}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(r.totalValue, defaultCurrency)}</td>
                      <td>
                        {r.errors.length > 0 ? (
                          <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={14} />
                            <span>{r.errors.join(', ')}</span>
                          </div>
                        ) : r.warnings.length > 0 ? (
                          <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertTriangle size={14} />
                            <span>{r.warnings.join(', ')}</span>
                          </div>
                        ) : (
                          <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={14} />
                            <span>جاهز</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        لا توجد صفوف تطابق الفلتر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SUCCESS STATE */}
        {importResult && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
              تم استيراد بضاعة أول المدة وترحيل القيد بنجاح!
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              تم تحديث أرصدة المستودعات وبطاقات الأصناف وإنشاء القيد الافتتاحي المتطابق تماماً في دفتر الأستاذ.
            </p>

            <div
              style={{
                display: 'inline-flex',
                gap: '1.5rem',
                padding: '1.25rem 2rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>أصناف تم استيرادها</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{importResult.importedCount} صنف</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>إجمالي الكمية المدخلة</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{importResult.totalQuantity.toLocaleString()} وحدة</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>إجمالي قيمة المخزون</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                  {formatCurrency(importResult.totalValuation, defaultCurrency)}
                </div>
              </div>
              {importResult.journalEntryNumber && (
                <>
                  <div style={{ borderLeft: '1px solid var(--border-color)' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>رقم القيد الافتتاحي</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)', fontFamily: 'monospace' }}>
                      {importResult.journalEntryNumber}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div>
              <button type="button" className="btn btn-primary" onClick={handleModalClose}>
                إغلاق والعودة لقائمة المخزون
              </button>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        {!importResult && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1rem',
              marginTop: '0.5rem',
            }}
          >
            <div>
              {activeTab === 'preview' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveTab('upload')}
                  disabled={importing}
                >
                  رفع ملف آخر
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={handleModalClose} disabled={importing}>
                إلغاء
              </button>

              {activeTab === 'preview' && validationData && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExecuteImport}
                  disabled={importing || validationData.validCount === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {importing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      جاري استيراد المخزون وترحيل القيد...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      تأكيد استيراد بضاعة أول المدة ({validationData.validCount} صنف)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
