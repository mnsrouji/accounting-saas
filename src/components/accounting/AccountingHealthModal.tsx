'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Scale,
  FileSpreadsheet,
  Layers,
  Wrench,
  Check,
  XCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import {
  runAccountingDiagnosticAction,
  healAndRepostLedgerAction,
} from '@/actions/accounting/accounting-health-actions'
import { AccountingHealthReport } from '@/lib/services/accounting-health-service'
import { formatCurrency } from '@/utils/decimal'

interface Props {
  businessId: string
  defaultCurrency?: string
  initialReport?: AccountingHealthReport | null
  triggerLabel?: string
  buttonClassName?: string
  showBannerWhenUnbalanced?: boolean
  isBalanced?: boolean
  variance?: number
}

export function AccountingHealthModal({
  businessId,
  defaultCurrency = 'USD',
  initialReport = null,
  triggerLabel,
  buttonClassName = 'btn btn-secondary btn-sm',
  showBannerWhenUnbalanced = false,
  isBalanced = true,
  variance = 0,
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isOpen, setIsOpen] = useState(false)
  const [report, setReport] = useState<AccountingHealthReport | null>(initialReport)
  const [loading, setLoading] = useState(false)
  const [healing, setHealing] = useState(false)
  const [healResult, setHealResult] = useState<any>(null)

  const t = {
    modalTitle: isAr ? 'فاحص ومصحح سلامة القيود والأستاذ العام' : isTr ? 'Muhasebe ve Yevmiye Sağlık Denetçisi' : 'General Ledger Diagnostic & Health Check',
    defaultTrigger: isAr ? 'تشخيص سلامة القيود والحسابات' : isTr ? 'Muhasebe Denetimi' : 'Ledger Diagnostic',
    healthScore: isAr ? 'مؤشر سلامة الدفاتر:' : isTr ? 'Sağlık Puanı:' : 'Health Score:',
    perfectStatus: isAr ? 'الدفاتر متزنة وسليمة بنسبة 100%' : isTr ? 'Kayıtlar %100 Dengeli ve Sağlıklı' : 'Ledgers are 100% Balanced & Sound',
    warningStatus: isAr ? 'تم رصد فروقات أو مستندات تحتاج تدقيقاً وترحيلاً' : isTr ? 'Düzeltme veya eşitleme gereken kayıtlar var' : 'Discrepancies or unposted documents detected',
    runDiagnosticBtn: isAr ? 'إعادة الفحص والتشخيص' : isTr ? 'Yeniden Denetle' : 'Re-Run Diagnostic',
    healLedgersBtn: isAr ? 'إعادة ترحيل القيود وتصحيح الخلل آلياً' : isTr ? 'Kayıtları Otomatik Düzelt ve Yeniden İşle' : 'Auto-Heal & Re-Post Ledgers',
    healing: isAr ? 'جارٍ التدقيق والترحيل...' : isTr ? 'Düzeltiliyor...' : 'Healing & Re-posting...',
    scanning: isAr ? 'جارٍ الفحص والتشخيص...' : isTr ? 'Denetleniyor...' : 'Running Diagnostic...',
    tbCheck: isAr ? 'توازن ميزان المراجعة (Debit = Credit)' : isTr ? 'Mizan Eşitliği (Borç = Alacak)' : 'Trial Balance (Debit = Credit)',
    bsCheck: isAr ? 'معادلة الميزانية العمومية (Assets = Liabilities + Equity)' : isTr ? 'Bilanço Denkliği (Varlıklar = Kaynaklar)' : 'Balance Sheet Equation',
    jeCheck: isAr ? 'سلامة وتوازن القيود المزدوجة' : isTr ? 'Yevmiye Maddeleri Denkliği' : 'Double-Entry Integrity',
    unpostedDocs: isAr ? 'المستندات والفواتير المعلقة غير المرحلة' : isTr ? 'İşlenmemiş Belgeler ve Faturalar' : 'Unposted Operational Documents',
    issuesListTitle: isAr ? 'سجل الملاحظات والخلل المرصود تفصيلياً' : isTr ? 'Tespit Edilen Uyumsuzluklar ve Detaylar' : 'Detected Discrepancies & Details',
    noIssues: isAr ? 'لا توجد أي قيود غير متوازنة أو مستندات غير مرحلة في النظام.' : isTr ? 'Sistemde dengesiz yevmiye kaydı veya işlenmemiş belge bulunmamaktadır.' : 'No unbalanced journal entries or orphaned records found.',
    closeBtn: isAr ? 'إغلاق' : isTr ? 'Kapat' : 'Close',
    successHealMsg: (count: number) => isAr ? `تمت معالجة وترحيل ${count} مستند وقيد محاسبي بنجاح!` : isTr ? `${count} belge başarıyla düzeltildi ve muhasebeleştirildi!` : `Successfully healed & synchronized ${count} documents!`,
    bannerText: (v: number) => isAr ? `انقر هنا لتشخيص سبب عدم التوازن (${formatCurrency(v, defaultCurrency)}) وإصلاحه آلياً` : isTr ? `Dengesizlik nedenini incelemek ve otomatik düzeltmek için tıklayın` : `Click to diagnose variance (${formatCurrency(v, defaultCurrency)}) & auto-heal`,
  }

  const handleOpen = async () => {
    setIsOpen(true)
    if (!report) {
      await handleRunDiagnostic()
    }
  }

  const handleRunDiagnostic = async () => {
    setLoading(true)
    try {
      const res = await runAccountingDiagnosticAction(businessId)
      if (res.success && res.report) {
        setReport(res.report)
      } else {
        toast.error(res.error || 'فشل الفحص')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleHeal = async () => {
    setHealing(true)
    try {
      const res = await healAndRepostLedgerAction(businessId)
      if (res.success && res.report) {
        setReport(res.report)
        setHealResult(res.healed)
        toast.success(t.successHealMsg(res.healed?.total || 0))
        router.refresh()
      } else {
        toast.error(res.error || 'فشل في المعالجة')
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء المعالجة')
    } finally {
      setHealing(false)
    }
  }

  return (
    <>
      {/* Trigger Button or Unbalanced Alert Banner */}
      {showBannerWhenUnbalanced && !isBalanced ? (
        <button
          type="button"
          onClick={handleOpen}
          className="btn btn-sm btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.85rem',
            fontWeight: 700,
            fontSize: '0.8125rem',
            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
          }}
        >
          <Wrench size={14} />
          {t.bannerText(variance)}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={buttonClassName}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Wrench size={15} />
          {triggerLabel || t.defaultTrigger}
        </button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t.modalTitle}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh', overflowY: 'auto', direction: isAr ? 'rtl' : 'ltr' }}>
          
          {/* Health Score Banner */}
          {report ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: report.isHealthy ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${report.isHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                {report.isHealthy ? (
                  <CheckCircle2 size={32} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                ) : (
                  <ShieldAlert size={32} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem', color: report.isHealthy ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {t.healthScore} {report.healthScore}%
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {report.isHealthy ? t.perfectStatus : t.warningStatus}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={loading || healing}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  {loading ? t.scanning : t.runDiagnosticBtn}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
              {t.scanning}
            </div>
          )}

          {/* 4-Pillar Health Audit Grid */}
          {report && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              
              {/* 1. Trial Balance */}
              <div style={{ padding: '0.875rem', background: 'var(--bg-page)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.tbCheck}</span>
                  {report.trialBalance.isBalanced ? (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>متزن ✓</span>
                  ) : (
                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>غير متزن ✕</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                  Debit: {formatCurrency(report.trialBalance.totalDebit, defaultCurrency)} | Credit: {formatCurrency(report.trialBalance.totalCredit, defaultCurrency)}
                </div>
              </div>

              {/* 2. Balance Sheet */}
              <div style={{ padding: '0.875rem', background: 'var(--bg-page)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.bsCheck}</span>
                  {report.balanceSheet.isBalanced ? (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>متطابقة ✓</span>
                  ) : (
                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>غير متطابقة ✕</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                  Assets: {formatCurrency(report.balanceSheet.totalAssets, defaultCurrency)} = L+E: {formatCurrency(report.balanceSheet.totalLiabilitiesAndEquity, defaultCurrency)}
                </div>
              </div>

              {/* 3. Double-Entry Integrity */}
              <div style={{ padding: '0.875rem', background: 'var(--bg-page)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.jeCheck}</span>
                  {report.stats.unbalancedEntriesCount === 0 ? (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>سليمة ({report.stats.totalJournalEntries})</span>
                  ) : (
                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>{report.stats.unbalancedEntriesCount} غير متزن</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  إجمالي القيود في الأستاذ العام: {report.stats.totalJournalEntries} قيد
                </div>
              </div>

              {/* 4. Unposted Documents */}
              <div style={{ padding: '0.875rem', background: 'var(--bg-page)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.unpostedDocs}</span>
                  {report.stats.unlinkedSalesCount + report.stats.unlinkedPurchasesCount + report.stats.unlinkedPaymentsCount + report.stats.unlinkedExpensesCount + report.stats.unlinkedTransfersCount === 0 ? (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>مرحلة بالكامل ✓</span>
                  ) : (
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                      {report.stats.unlinkedSalesCount + report.stats.unlinkedPurchasesCount + report.stats.unlinkedPaymentsCount + report.stats.unlinkedExpensesCount + report.stats.unlinkedTransfersCount} معلق
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  مبيعات: {report.stats.unlinkedSalesCount} | مشتريات: {report.stats.unlinkedPurchasesCount} | سندات: {report.stats.unlinkedPaymentsCount}
                </div>
              </div>
            </div>
          )}

          {/* Itemized Issues Breakdown */}
          {report && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: '0.75rem 1rem' }}>
                <span className="card-title" style={{ fontSize: '0.875rem' }}>
                  {t.issuesListTitle} ({report.issues.length})
                </span>
              </div>
              <div className="card-body" style={{ padding: 0, maxHeight: 260, overflowY: 'auto' }}>
                {report.issues.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={18} /> {t.noIssues}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {report.issues.map((issue) => (
                      <div
                        key={issue.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid var(--border-color)',
                          background: issue.severity === 'error' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                        }}
                      >
                        {issue.severity === 'error' ? (
                          <XCircle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                        ) : (
                          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: issue.severity === 'error' ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                            {isAr ? issue.titleAr : issue.titleEn}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {isAr ? issue.descriptionAr : issue.descriptionEn}
                          </div>
                        </div>
                        {issue.amount && (
                          <div style={{ fontWeight: 700, fontSize: '0.8125rem', direction: 'ltr', color: issue.severity === 'error' ? 'var(--color-danger)' : '#f59e0b' }}>
                            {formatCurrency(issue.amount, defaultCurrency)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn btn-secondary"
            >
              {t.closeBtn}
            </button>

            <button
              type="button"
              onClick={handleHeal}
              disabled={loading || healing}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
            >
              <Wrench size={16} className={healing ? 'animate-spin' : ''} />
              {healing ? t.healing : t.healLedgersBtn}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
