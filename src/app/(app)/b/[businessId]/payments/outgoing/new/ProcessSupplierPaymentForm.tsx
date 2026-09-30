'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { processPaymentAction } from '@/actions/payments/payment-actions'
import { formatCurrency } from '@/utils/decimal'

interface Supplier {
  id: string
  name: string
  currency: string
}

interface BankAccount {
  id: string
  name: string
  bankName: string
  accountNumber: string
}

interface CashAccount {
  id: string
  name: string
}

interface OpenPurchase {
  id: string
  supplierId: string
  purchaseNumber: string
  purchaseDate: string
  totalAmount: number
  balanceDue: number
  currencyCode: string
}

interface ProcessSupplierPaymentFormProps {
  businessId: string
  defaultCurrency: string
  suppliers: Supplier[]
  bankAccounts: BankAccount[]
  cashAccounts: CashAccount[]
  openPurchases: OpenPurchase[]
}

export function ProcessSupplierPaymentForm({
  businessId,
  defaultCurrency,
  suppliers,
  bankAccounts,
  cashAccounts,
  openPurchases,
}: ProcessSupplierPaymentFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [paymentNumber, setPaymentNumber] = useState(`PAY-OUT-${Date.now().toString().slice(-6)}`)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState<'bank_transfer' | 'cash' | 'cheque' | 'card'>('bank_transfer')
  const [depositType, setDepositType] = useState<'bank' | 'cash'>('bank')
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '')
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id || '')
  const [amount, setAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')

  const [allocations, setAllocations] = useState<Record<string, number>>({})

  const supplierOpenPurchases = useMemo(() => {
    return openPurchases.filter((p) => p.supplierId === supplierId)
  }, [openPurchases, supplierId])

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((acc, val) => acc + (Number(val) || 0), 0)
  }, [allocations])

  const remainingUnallocated = amount - totalAllocated
  const isOverAllocated = totalAllocated > amount

  const handleAllocationChange = (purchaseId: string, val: number, maxBalance: number) => {
    const safeVal = Math.max(0, Math.min(val, maxBalance))
    setAllocations((prev) => ({
      ...prev,
      [purchaseId]: safeVal,
    }))
  }

  const handleAutoAllocate = () => {
    let remainingToDistribute = amount
    const nextAllocations: Record<string, number> = {}

    for (const purch of supplierOpenPurchases) {
      if (remainingToDistribute <= 0) break
      const alloc = Math.min(remainingToDistribute, purch.balanceDue)
      nextAllocations[purch.id] = alloc
      remainingToDistribute -= alloc
    }

    setAllocations(nextAllocations)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (amount <= 0) {
      toast.error('Payment amount must be greater than zero')
      return
    }

    if (isOverAllocated) {
      toast.error('Allocated amount cannot exceed total payment amount!')
      return
    }

    setLoading(true)

    try {
      const activeAllocations = Object.entries(allocations)
        .filter(([_, alloc]) => alloc > 0)
        .map(([purchaseId, allocatedAmount]) => ({
          purchaseId,
          allocatedAmount,
        }))

      const payload = {
        paymentNumber,
        paymentDate: new Date(paymentDate),
        type: 'outgoing' as const,
        method,
        supplierId,
        bankAccountId: depositType === 'bank' ? bankAccountId || undefined : undefined,
        cashAccountId: depositType === 'cash' ? cashAccountId || undefined : undefined,
        amount: Number(amount),
        currencyCode: defaultCurrency,
        exchangeRate: 1,
        notes: notes || undefined,
        allocations: activeAllocations,
      }

      const res = await processPaymentAction(businessId, payload)

      if (res.success) {
        toast.success(`Supplier payment ${paymentNumber} processed successfully!`)
        router.push(`/b/${businessId}/payments`)
      } else {
        toast.error(res.error || 'Failed to process payment')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href={`/b/${businessId}/payments`} className="btn btn-secondary btn-sm" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">Pay Supplier Bill</h1>
            <p className="page-subtitle">Process outgoing supplier payment & allocate against purchase bills</p>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading || isOverAllocated}>
          <CheckCircle size={16} />
          {loading ? 'Processing...' : 'Post Payment'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Payment Source & Supplier Details</span>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label required">Supplier</label>
              <select
                className="form-control"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value)
                  setAllocations({})
                }}
                required
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label required">Payment Number</label>
              <input
                type="text"
                className="form-control"
                value={paymentNumber}
                onChange={(e) => setPaymentNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label required">Payment Date</label>
              <input
                type="date"
                className="form-control"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label required">Payment Method</label>
              <select
                className="form-control"
                value={method}
                onChange={(e: any) => setMethod(e.target.value)}
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Credit/Debit Card</option>
              </select>
            </div>

            <div>
              <label className="form-label required">Paid From</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="depositType"
                    value="bank"
                    checked={depositType === 'bank'}
                    onChange={() => setDepositType('bank')}
                  />
                  Bank Account
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="depositType"
                    value="cash"
                    checked={depositType === 'cash'}
                    onChange={() => setDepositType('cash')}
                  />
                  Cash Account
                </label>
              </div>
            </div>

            <div>
              {depositType === 'bank' ? (
                <>
                  <label className="form-label required">Bank Account</label>
                  <select
                    className="form-control"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    required
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.bankName} - {b.accountNumber})
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="form-label required">Cash Account</label>
                  <select
                    className="form-control"
                    value={cashAccountId}
                    onChange={(e) => setCashAccountId(e.target.value)}
                    required
                  >
                    {cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Amount Summary</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label required">Total Payment Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-control"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0.00"
                required
                style={{ fontSize: '1.25rem', fontWeight: 700 }}
              />
            </div>

            <div style={{ background: 'var(--bg-page)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Payment:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(amount, defaultCurrency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Allocated:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-brand-500)' }}>{formatCurrency(totalAllocated, defaultCurrency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontWeight: 700 }}>
                <span>Unallocated / Remaining:</span>
                <span style={{ color: isOverAllocated ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {formatCurrency(remainingUnallocated, defaultCurrency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="card-title">Allocate Payment Across Unpaid Supplier Bills</span>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Found {supplierOpenPurchases.length} open bill(s) for this supplier
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAutoAllocate}
            disabled={amount <= 0 || supplierOpenPurchases.length === 0}
          >
            Auto Allocate
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>Purchase #</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>Total Amount</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>Balance Due</th>
                <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', width: '220px', textAlign: 'right' }}>Allocated Amount</th>
              </tr>
            </thead>
            <tbody>
              {supplierOpenPurchases.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No open purchase bills found for this supplier. Payment will be saved as unallocated supplier advance.
                  </td>
                </tr>
              ) : (
                supplierOpenPurchases.map((purch) => {
                  const currentAlloc = allocations[purch.id] || ''

                  return (
                    <tr key={purch.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-brand-500)' }}>
                        {purch.purchaseNumber}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {new Date(purch.purchaseDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right' }}>
                        {formatCurrency(purch.totalAmount, purch.currencyCode)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-danger)' }}>
                        {formatCurrency(purch.balanceDue, purch.currencyCode)}
                      </td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={purch.balanceDue}
                          className="form-control"
                          value={currentAlloc}
                          onChange={(e) => handleAllocationChange(purch.id, Number(e.target.value), purch.balanceDue)}
                          placeholder="0.00"
                          style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  )
}
