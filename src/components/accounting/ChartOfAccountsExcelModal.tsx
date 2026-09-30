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
  HelpCircle,
  FileCheck,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import {
  validateChartOfAccountsExcelAction,
  importChartOfAccountsExcelAction,
} from '@/actions/accounting/coa-excel-actions'
import { ParsedAccountRow, ValidationSummary } from '@/lib/services/coa-excel-service'

interface ChartOfAccountsExcelModalProps {
  businessId: string
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
}

export function ChartOfAccountsExcelModal({
  businessId,
  isOpen,
  onClose,
  onImportSuccess,
}: ChartOfAccountsExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMode, setImportMode] = useState<'merge' | 'insert_only'>('merge')
  const [validationData, setValidationData] = useState<ValidationSummary | null>(null)
  const [filterRowStatus, setFilterRowStatus] = useState<'all' | 'valid' | 'warning' | 'error'>('all')
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null)

  // Reset state when closed or re-opened
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

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  // Handle Drag & Drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const processFile = async (file: File) => {
    // Validate file extension
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

      const res = await validateChartOfAccountsExcelAction(businessId, base64)

      if (res.success && res.data) {
        setValidationData(res.data)
        setActiveTab('preview')
        if (res.data.errorCount > 0) {
          toast.warning(`تم فحص الملف: وُجد ${res.data.errorCount} خطأ بحاجة للمعالجة قبل الاستيراد.`)
        } else {
          toast.success(`تم فحص الملف بنجاح! جاهز لاستيراد ${res.data.validCount} حساب.`)
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

  // Handle Import Execution
  const handleExecuteImport = async () => {
    if (!validationData || !validationData.rows.length) return

    setImporting(true)
    try {
      const res = await importChartOfAccountsExcelAction(businessId, validationData.rows, importMode)

      if (res.success && res.result) {
        setImportResult(res.result)
        toast.success(
          `تم استيراد الدليل بنجاح! (تم إنشاء ${res.result.created} جديد، تحديث ${res.result.updated}، تخطي ${res.result.skipped})`
        )
        onImportSuccess()
      } else {
        toast.error(res.error || 'فشل في تنفيذ الاستيراد')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع')
    } finally {
      setImporting(false)
    }
  }

  // Filtered rows for preview table
  const filteredRows = (validationData?.rows || []).filter((r) => {
    if (filterRowStatus === 'all') return true
    return r.status === filterRowStatus
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="استيراد وتصدير دليل الحسابات (Excel Import / Export)"
      maxWidth="960px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Navigation / Step Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud size={15} style={{ marginInlineEnd: '0.375rem' }} />
            1. تحميل النموذج ورفع الملف
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('preview')}
            disabled={!validationData}
          >
            <FileCheck size={15} style={{ marginInlineEnd: '0.375rem' }} />
            2. معاينة الحسابات والتحقق ({validationData?.totalRows || 0})
          </button>
        </div>

        {/* Tab 1: Upload & Template Download */}
        {activeTab === 'upload' && !importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Template Download Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(99, 102, 241, 0.04))',
                border: '1px solid rgba(59, 130, 246, 0.25)',
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
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6',
                  }}
                >
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                    قالب إكسل الجاهز لدليل الحسابات (Official Template)
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    حمّل النموذج المنسق الجاهز الذي يحتوي على أمثلة للشجرة المحاسبية والتعليمات الكاملة للتعبئة.
                  </p>
                </div>
              </div>

              <a
                href={`/api/b/${businessId}/accounting/chart-of-accounts/template`}
                download
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
              >
                <Download size={16} />
                تحميل نموذج الإكسل (.xlsx)
              </a>
            </div>

            {/* Drag & Drop Dropzone */}
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
                {validating ? 'جاري تحليل الملف والتحقق من الحسابات...' : 'اسحب وأفلت ملف الإكسل هنا، أو انقر للتصفح'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                يدعم صيغ Excel (.xlsx, .xls) و CSV • الحد الأقصى للحجم 10MB
              </p>
            </div>

            {/* Import Strategy Settings */}
            <div
              className="card"
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
                استراتيجية معالجة الحسابات الموجودة مسبقاً (Import Strategy):
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: importMode === 'merge' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                    border: `1px solid ${importMode === 'merge' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>دمج وتحديث (Merge & Update)</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      تحديث أسماء وتفاصيل الحسابات الموجودة مسبقاً وإنشاء الحسابات الجديدة.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: importMode === 'insert_only' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                    border: `1px solid ${importMode === 'insert_only' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="insert_only"
                    checked={importMode === 'insert_only'}
                    onChange={() => setImportMode('insert_only')}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>إضافة الجديد فقط (Insert Only)</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      إضافة الحسابات الجديدة فقط وتخطي أي حساب يحمل كوداً موجوداً في النظام.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Live Preview & Validation Matrix */}
        {activeTab === 'preview' && validationData && !importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>إجمالي الصفوف</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{validationData.totalRows}</div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#10b981',
                }}
              >
                <div style={{ fontSize: '0.75rem' }}>حسابات جديدة</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{validationData.newCount}</div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  color: '#3b82f6',
                }}
              >
                <div style={{ fontSize: '0.75rem' }}>تحديثات لحسابات سابقة</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{validationData.updateCount}</div>
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
                <div style={{ fontSize: '0.75rem' }}>أخطاء تعيق الاستيراد</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{validationData.errorCount}</div>
              </div>
            </div>

            {/* Filter Pills for Preview Table */}
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
                <button
                  type="button"
                  className={`btn btn-sm ${filterRowStatus === 'warning' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterRowStatus('warning')}
                >
                  <AlertTriangle size={13} style={{ marginInlineEnd: '0.25rem', color: '#f59e0b' }} />
                  تحذيرات ({validationData.rows.filter((r) => r.status === 'warning').length})
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
                maxHeight: '340px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
              }}
            >
              <table className="table" style={{ margin: 0, fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2 }}>
                    <th style={{ width: '45px' }}>#</th>
                    <th>كود الحساب</th>
                    <th>اسم الحساب</th>
                    <th>النوع</th>
                    <th>طبيعة الرصيد</th>
                    <th>كود الأب</th>
                    <th>رئيسي</th>
                    <th>الإجراء</th>
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
                        <strong style={{ fontFamily: 'monospace' }}>{r.code}</strong>
                      </td>
                      <td>{r.name}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.725rem' }}>
                          {r.type}
                        </span>
                      </td>
                      <td>{r.normalBalance === 'debit' ? 'مدين' : 'دائن'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.parentCode || '-'}</td>
                      <td>{r.isHeader ? 'نعم' : 'لا'}</td>
                      <td>
                        {r.action === 'create' ? (
                          <span className="badge badge-success" style={{ fontSize: '0.725rem' }}>
                            إنشاء جديد
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.725rem' }}>
                            تحديث
                          </span>
                        )}
                      </td>
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
                            <span>صالح</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        لا توجد صفوف تطابق الفلتر المحدد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Error Banner if blocking */}
            {validationData.errorCount > 0 && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--border-radius)',
                  padding: '0.875rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                }}
              >
                <XCircle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>يوجد {validationData.errorCount} خطأ في البيانات:</strong> يرجى تصحيح الأخطاء في ملف الإكسل وإعادة
                  رفعه، أو متابعة الاستيراد لتخطي الصفوف المعطوبة فقط.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Success State */}
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
              تم استيراد دليل الحسابات بنجاح!
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              تمت معالجة الشجرة المحاسبية وربط كافة الحسابات الرئيسية والفرعية بنجاح.
            </p>

            <div
              style={{
                display: 'inline-flex',
                gap: '1.5rem',
                padding: '1rem 2rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>حسابات أُنشئت</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{importResult.created}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>حسابات حُدثت</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{importResult.updated}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>حسابات تم تخطيها</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {importResult.skipped}
                </div>
              </div>
            </div>

            <div>
              <button type="button" className="btn btn-primary" onClick={handleModalClose}>
                إغلاق والعودة للدليل
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
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
                      جاري الاستيراد والتحديث...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      تأكيد استيراد ({validationData.validCount} حساب)
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
