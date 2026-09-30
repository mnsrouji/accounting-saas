'use client'

import React, { useState, useTransition } from 'react'
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Layers,
  BookOpen,
  Users,
  ShoppingCart,
  Package,
  PiggyBank,
  Check,
  AlertCircle,
  FileText,
  Lock,
} from 'lucide-react'
import {
  validateBackupAction,
  restoreBackupAction,
  purgeDataAction,
  getBackupStatsAction,
} from '@/app/actions/data-management-actions'
import { PurgeType } from '@/lib/services/data-management-service'
import { Modal } from '@/components/ui/Modal'

interface Props {
  businessId: string
  businessName: string
  currency: string
  initialStats: {
    accountsCount: number
    journalEntriesCount: number
    salesCount: number
    purchasesCount: number
    paymentsCount: number
    expensesCount: number
    customersCount: number
    suppliersCount: number
    productsCount: number
    warehousesCount: number
    cashAccountsCount: number
    bankAccountsCount: number
    totalOperations: number
  }
}

export function BackupManagementClient({
  businessId,
  businessName,
  currency,
  initialStats,
}: Props) {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'purge'>('export')
  const [stats, setStats] = useState(initialStats)
  const [isPending, startTransition] = useTransition()

  // Import / Restore State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [validationResult, setValidationResult] = useState<any>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('overwrite')
  const [restoreSuccess, setRestoreSuccess] = useState<any>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  // Purge State
  const [selectedPurgeType, setSelectedPurgeType] = useState<PurgeType | null>(null)
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false)
  const [confirmPhraseInput, setConfirmPhraseInput] = useState('')
  const [purgeStatus, setPurgeStatus] = useState<{ success?: boolean; message?: string; error?: string } | null>(null)
  const [isExportingBeforePurge, setIsExportingBeforePurge] = useState(false)

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setValidationResult(null)
    setRestoreSuccess(null)
    setRestoreError(null)
    setIsValidating(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string
      setFileContent(content)
      try {
        const res = await validateBackupAction(content)
        if (res.success && res.validation?.valid) {
          setValidationResult(res.validation)
        } else {
          setRestoreError(res.error || res.validation?.error || 'الملف المرفوع غير صالح')
        }
      } catch (err: any) {
        setRestoreError('حدث خطأ أثناء فحص ملف النسخة الاحتياطية')
      } finally {
        setIsValidating(false)
      }
    }
    reader.readAsText(file)
  }

  // Handle Restore Execution
  const handleExecuteRestore = () => {
    if (!fileContent || !validationResult) return

    startTransition(async () => {
      setRestoreError(null)
      setRestoreSuccess(null)
      const res = await restoreBackupAction(businessId, fileContent, restoreMode)
      if (res.success) {
        setRestoreSuccess(res.result)
        const updated = await getBackupStatsAction(businessId)
        if (updated.success && updated.stats) {
          setStats(updated.stats)
        }
      } else {
        setRestoreError(res.error || 'فشلت عملية الاستعادة')
      }
    })
  }

  // Handle Purge Execution
  const handleExecutePurge = () => {
    if (!selectedPurgeType) return

    startTransition(async () => {
      setPurgeStatus(null)
      const res = await purgeDataAction(businessId, selectedPurgeType, confirmPhraseInput)
      if (res.success && res.result) {
        setPurgeStatus({ success: true, message: res.result.message })
        setIsPurgeModalOpen(false)
        setConfirmPhraseInput('')
        const updated = await getBackupStatsAction(businessId)
        if (updated.success && updated.stats) {
          setStats(updated.stats)
        }
      } else {
        setPurgeStatus({ success: false, error: res.error || 'فشلت عملية المسح' })
      }
    })
  }

  const getPurgeTitle = (type: PurgeType) => {
    switch (type) {
      case 'journal_entries_only':
        return 'مسح قيود اليومية المحاسبية فقط'
      case 'all_operations':
        return 'مسح جميع الحركات والعمليات التشغيلية والمالية'
      case 'factory_reset':
        return 'إعادة ضبط المصنع الكامل للمنشأة'
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metric Badges */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--color-brand-900) 0%, var(--bg-card) 100%)',
          borderColor: 'var(--color-brand-700)',
          color: 'var(--text-primary)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Database className="text-brand-400" size={24} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                منظومة النسخ الاحتياطي وإدارة البيانات (Data Management & Backup)
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              تصدير واستيراد البيانات الشاملة، مع إمكانية مسح وتصفير العمليات وفق أسس ومعايير أمان معتمدة.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
              العملة: {currency}
            </span>
            <span className="badge badge-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
              إجمالي القيود والعمليات: {stats.totalOperations}
            </span>
          </div>
        </div>

        {/* Live Counters Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-brand-400)' }}>{stats.accountsCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>دليل الحسابات</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-brand-400)' }}>{stats.journalEntriesCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>قيود اليومية</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-brand-400)' }}>{stats.salesCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>فواتير المبيعات</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-brand-400)' }}>{stats.purchasesCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>فواتير الشراء</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-brand-400)' }}>{stats.customersCount + stats.suppliersCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>العملاء والموردين</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-brand-400)' }}>{stats.productsCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>المنتجات بالمخزن</div>
          </div>
        </div>
      </div>

      {/* Main Mode Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          background: 'var(--bg-card)',
          padding: '0.375rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
        }}
      >
        <button
          onClick={() => setActiveTab('export')}
          className={`btn ${activeTab === 'export' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Download size={16} /> 1. تصدير نسخة احتياطية (Backup Export)
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`btn ${activeTab === 'import' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Upload size={16} /> 2. استيراد واسترجاع (Restore & Import)
        </button>
        <button
          onClick={() => setActiveTab('purge')}
          className={`btn ${activeTab === 'purge' ? 'btn-danger' : 'btn-ghost'}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: activeTab === 'purge' ? '#fff' : 'var(--color-danger-500)' }}
        >
          <ShieldAlert size={16} /> 3. مسح وتصفير البيانات (Data Purge)
        </button>
      </div>

      {/* Purge / Status Feedback Alert */}
      {purgeStatus && (
        <div
          className={`card ${purgeStatus.success ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400' : 'bg-rose-950/20 border-rose-800 text-rose-400'}`}
          style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          {purgeStatus.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <div>
            <div style={{ fontWeight: 600 }}>{purgeStatus.success ? 'تمت العملية بنجاح' : 'خطأ أثناء تنفيذ العملية'}</div>
            <div style={{ fontSize: '0.875rem' }}>{purgeStatus.message || purgeStatus.error}</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BACKUP & EXPORT */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ maxWidth: '600px' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCheck size={20} className="text-brand-500" />
                  تصدير ملف النسخة الاحتياطية الشاملة
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6' }}>
                  يحتوي الملف على كامل البنية المحاسبية والتشغيلية للمنشأة الحالية بصيغة JSON المعيارية، متضمناً التحقق من الموازنة المزدوجة (Double-Entry Balance Verification) وبصمة رقمية (SHA-256 Checksum).
                </p>

                <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Check size={16} className="text-emerald-500" /> شجرة الحسابات والعملات
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Check size={16} className="text-emerald-500" /> قيود اليومية ودفتر الأستاذ
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Check size={16} className="text-emerald-500" /> العملاء والموردين وجهات الاتصال
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Check size={16} className="text-emerald-500" /> فواتير المبيعات والمشتريات
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Check size={16} className="text-emerald-500" /> سندات القبض والدفع والمصروفات
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Check size={16} className="text-emerald-500" /> المخزون والمستودعات والحركات
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', minWidth: '220px' }}>
                <a
                  href={`/api/b/${businessId}/backup/export`}
                  download
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.875rem 1.5rem',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <Download size={18} /> تحميل النسخة الآن (JSON)
                </a>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  يتم التصدير الفوري مباشرة من قاعدة البيانات
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RESTORE & IMPORT */}
      {/* ========================================================================= */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={20} className="text-brand-500" />
              استيراد واسترجاع نسخة احتياطية
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              قم برفع ملف النسخة الاحتياطية (.json) للتحقق التلقائي من سلامته قبل البدء بعملية الاستعادة داخل جلسة قاعدة بيانات آمنة (Database Transaction).
            </p>

            {/* Upload Dropzone */}
            <div
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-page)',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%',
                }}
              />
              <Upload size={36} className="mx-auto text-brand-400" style={{ marginBottom: '0.75rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                {uploadedFile ? uploadedFile.name : 'اسحب وأفلت ملف النسخة الاحتياطية هنا، أو انقر للاختيار'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                يقبل ملفات JSON المتوافقة مع النظام فقط
              </div>
            </div>

            {isValidating && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', color: 'var(--color-brand-400)' }}>
                <RefreshCw size={16} className="animate-spin" /> جاري فحص بنية الملف والمطابقة المحاسبية...
              </div>
            )}

            {restoreError && (
              <div
                className="card bg-rose-950/20 border-rose-800 text-rose-400"
                style={{ padding: '1rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <AlertCircle size={18} /> {restoreError}
              </div>
            )}

            {/* Validation Preview Card */}
            {validationResult && (
              <div className="card" style={{ marginTop: '1.5rem', background: 'var(--bg-card)', borderColor: 'var(--color-brand-600)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    تم التحقق من سلامة النسخة الاحتياطية بنجاح
                  </div>
                  <span className="badge badge-success">صالح للاستعادة</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>المنشأة الأصلية:</span>{' '}
                    <strong>{validationResult.summary.businessName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>تاريخ التصدير:</span>{' '}
                    <strong>{new Date(validationResult.summary.exportedAt).toLocaleString('ar-EG')}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>العملة:</span>{' '}
                    <strong>{validationResult.summary.currency}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>إصدار النسخة:</span>{' '}
                    <strong>v{validationResult.summary.version}</strong>
                  </div>
                </div>

                {/* Mode Selector */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
                    اختر نمط الاستعادة (Restore Strategy):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div
                      onClick={() => setRestoreMode('overwrite')}
                      style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        border: `2px solid ${restoreMode === 'overwrite' ? 'var(--color-brand-500)' : 'var(--border-color)'}`,
                        background: restoreMode === 'overwrite' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <RefreshCw size={16} className="text-brand-500" /> استبدال كامل (Full Overwrite)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        يقوم بمسح البيانات الحالية للمنشأة واستعادة النسخة بدقة متطابقة لضمان سلامة القيود والأرصدة.
                      </div>
                    </div>

                    <div
                      onClick={() => setRestoreMode('merge')}
                      style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        border: `2px solid ${restoreMode === 'merge' ? 'var(--color-brand-500)' : 'var(--border-color)'}`,
                        background: restoreMode === 'merge' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Layers size={16} className="text-emerald-500" /> دمج وإلحاق (Append & Merge)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        يستورد الحسابات والعملاء والموردين والمنتجات غير الموجودة دون حذف العمليات والفواتير السابقة.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Execute Restore Button */}
                <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isPending}
                    className="btn btn-primary"
                    style={{ padding: '0.75rem 2rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isPending ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> جاري تنفيذ الاستعادة...
                      </>
                    ) : (
                      <>
                        <Upload size={16} /> بدء عملية الاستعادة الآن
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Restore Success Summary */}
            {restoreSuccess && (
              <div className="card bg-emerald-950/20 border-emerald-800 text-emerald-400" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem' }}>
                  <CheckCircle2 size={20} /> تمت استعادة البيانات بنجاح تام!
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  <div>• الحسابات: {restoreSuccess.accountsRestored}</div>
                  <div>• العملاء: {restoreSuccess.customersRestored}</div>
                  <div>• الموردين: {restoreSuccess.suppliersRestored}</div>
                  <div>• المنتجات: {restoreSuccess.productsRestored}</div>
                  <div>• فواتير البيع: {restoreSuccess.salesRestored}</div>
                  <div>• فواتير الشراء: {restoreSuccess.purchasesRestored}</div>
                  <div>• قيود اليومية: {restoreSuccess.journalEntriesRestored}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DATA PURGE & RESET (DANGER ZONE) */}
      {/* ========================================================================= */}
      {activeTab === 'purge' && (
        <div className="space-y-6">
          <div
            className="card"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.4)',
              background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.05) 0%, var(--bg-card) 100%)',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <ShieldAlert size={24} className="text-rose-500" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-danger-500)', margin: 0 }}>
                منطقة تصفير ومسح البيانات (Data Purge & Reset)
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              تتيح هذه المنظومة تصفير البيانات والقيود وفق 3 مستويات منطقية وآمنة. جميع عمليات المسح محاطة ببروتوكول تأكيد إلزامي ومسجلة في سجل التدقيق الأمني (Audit Log).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {/* Option 1: Journal Entries Only */}
              <div
                className="card"
                style={{
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  background: 'rgba(245, 158, 11, 0.03)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem' }}>
                    <BookOpen size={18} /> المستوى 1: مسح قيود اليومية فقط
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    يمسح قيود اليومية المحاسبية ويفك ارتباطها بالفواتير مع تصفير أرصدة دليل الحسابات. <strong>يحتفظ</strong> بدليل الحسابات، العملاء، الموردين، والمنتجات.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedPurgeType('journal_entries_only')
                    setIsPurgeModalOpen(true)
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '1rem', width: '100%', borderColor: '#f59e0b', color: '#f59e0b' }}
                >
                  <Trash2 size={14} /> مسح القيود المحاسبية
                </button>
              </div>

              {/* Option 2: All Operations & Invoices */}
              <div
                className="card"
                style={{
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  background: 'rgba(249, 115, 22, 0.03)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#f97316', marginBottom: '0.5rem' }}>
                    <Layers size={18} /> المستوى 2: مسح جميع الحركات والعمليات
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    يمسح فواتير البيع والشراء، السندات، حركات المخزون، والقيود المحاسبية ويصفر الأرصدة. <strong>يحتفظ</strong> بالبيانات الأساسية (العملاء، الموردين، المنتجات، دليل الحسابات).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedPurgeType('all_operations')
                    setIsPurgeModalOpen(true)
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '1rem', width: '100%', borderColor: '#f97316', color: '#f97316' }}
                >
                  <Trash2 size={14} /> مسح العمليات التشغيلية
                </button>
              </div>

              {/* Option 3: Full Factory Reset */}
              <div
                className="card"
                style={{
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--color-danger-500)', marginBottom: '0.5rem' }}>
                    <ShieldAlert size={18} /> المستوى 3: إعادة ضبط المصنع الكامل
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    مسح شامل لجميع الحركات والعملاء والموردين والمنتجات والمخازن واستعادة البنية الافتراضية الأولية للنظام.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedPurgeType('factory_reset')
                    setIsPurgeModalOpen(true)
                  }}
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  <AlertTriangle size={14} /> إعادة ضبط المصنع الكامل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PURGE CONFIRMATION SECURITY MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => {
          setIsPurgeModalOpen(false)
          setConfirmPhraseInput('')
        }}
        title={`تأكيد أمني: ${selectedPurgeType ? getPurgeTitle(selectedPurgeType) : ''}`}
        maxWidth="640px"
      >
        <div className="space-y-4" style={{ padding: '0.5rem 0' }}>
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--color-danger-500)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>تحذير أمني صارم: هذا الإجراء لا يمكن التراجع عنه!</div>
              <div>سيتم تنفيذ المسح عبر معاملة قاعدة بيانات متسلسلة وفق قيود المفاتيح الأجنبية. يوصى بشدة بتحميل نسخة احتياطية أولاً.</div>
            </div>
          </div>

          {/* Safety Backup Option */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1rem',
              background: 'var(--bg-page)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 600 }}>إجراء وقائي:</span> تحميل نسخة احتياطية فورية قبل المسح
            </div>
            <a
              href={`/api/b/${businessId}/backup/export`}
              download
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <Download size={14} /> تنزيل نسخة وقائية
            </a>
          </div>

          {/* Phrase Confirmation Input */}
          <div style={{ marginTop: '1.25rem' }}>
            <label className="form-label required" style={{ fontWeight: 600 }}>
              للتأكيد، يرجى كتابة اسم المنشأة <strong>"{businessName}"</strong> أو كلمة <strong>"CONFIRM-PURGE"</strong> أدناه:
            </label>
            <input
              type="text"
              value={confirmPhraseInput}
              onChange={(e) => setConfirmPhraseInput(e.target.value)}
              placeholder={`اكتب "${businessName}" أو "CONFIRM-PURGE"`}
              className="form-control"
              style={{
                borderColor:
                  confirmPhraseInput.trim().toLowerCase() === businessName.trim().toLowerCase() ||
                  confirmPhraseInput.trim().toUpperCase() === 'CONFIRM-PURGE' ||
                  confirmPhraseInput.trim() === 'مسح نهائي'
                    ? 'var(--color-danger-500)'
                    : 'var(--border-color)',
              }}
            />
          </div>

            {(() => {
              const trimmed = confirmPhraseInput.trim().toLowerCase()
              const bName = businessName.trim().toLowerCase()
              const isValid =
                trimmed === bName ||
                trimmed === 'confirm-purge' ||
                trimmed === 'delete-all' ||
                trimmed === 'مسح نهائي' ||
                trimmed === 'confirm' ||
                trimmed === 'yes' ||
                confirmPhraseInput.trim() === businessName.trim()

              return (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsPurgeModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePurge}
                    disabled={isPending || !isValid}
                    className="btn btn-danger"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isPending ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> جاري تنفيذ المسح...
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} /> تأكيد وتنفيذ المسح
                      </>
                    )}
                  </button>
                </div>
              )
            })()}
        </div>
      </Modal>
    </div>
  )
}
