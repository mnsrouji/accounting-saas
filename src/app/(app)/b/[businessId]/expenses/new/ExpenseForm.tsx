'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { postExpenseAction } from '@/actions/expenses/expense-actions'
import { formatCurrency } from '@/utils/decimal'

interface ExpenseAccount {
  id: string
  code: string
  name: string
}

interface BankAccount {
  id: string
  name: string
  bankName: string
}

interface CashAccount {
  id: string
  name: string
}

interface ExpenseFormProps {
  businessId: string
  defaultCurrency: string
  expenseAccounts: ExpenseAccount[]
  bankAccounts: BankAccount[]
  cashAccounts: CashAccount[]
}

export function ExpenseForm({
  businessId,
  defaultCurrency,
  expenseAccounts,
  bankAccounts,
  cashAccounts,
}: ExpenseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [expenseNumber, setExpenseNumber] = useState(`EXP-${Date.now().toString().slice(-6)}`)
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [accountId, setAccountId] = useState(expenseAccounts[0]?.id || '')
  const [amount, setAmount] = useState<number>(0)
  const [taxAmount, setTaxAmount] = useState<number>(0)
  const [paymentType, setPaymentType] = useState<'bank' | 'cash'>('bank')
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '')
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!accountId) {
      toast.error('Please select an expense account')
      return
    }

    if (!description.trim()) {
      toast.error('Description is required')
      return
    }

    if (amount <= 0) {
      toast.error('Expense amount must be greater than zero')
      return
    }

    setLoading(true)

    try {
      const payload = {
        expenseNumber,
        expenseDate: new Date(expenseDate),
        description,
        vendor: vendor || undefined,
        accountId,
        currencyCode: defaultCurrency,
        exchangeRate: 1,
        amount: Number(amount),
        taxAmount: Number(taxAmount) || 0,
        bankAccountId: paymentType === 'bank' ? bankAccountId || undefined : undefined,
        cashAccountId: paymentType === 'cash' ? cashAccountId || undefined : undefined,
      }

      const res = await postExpenseAction(businessId, payload)

      if (res.success) {
        toast.success(`Expense ${expenseNumber} posted successfully!`)
        router.push(`/b/${businessId}/expenses`)
      } else {
        toast.error(res.error || 'Failed to post expense')
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
          <Link href={`/b/${businessId}/expenses`} className="btn btn-secondary btn-sm" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">Record Operating Expense</h1>
            <p className="page-subtitle">Post a business expense with automatic Chart of Accounts GL entry</p>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} id="post-expense-btn">
          <CheckCircle size={16} />
          {loading ? 'Posting...' : 'Post Expense'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Expense Details</span>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label required">Expense #</label>
              <input
                type="text"
                className="form-control"
                value={expenseNumber}
                onChange={(e) => setExpenseNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label required">Expense Date</label>
              <input
                type="date"
                className="form-control"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Description</label>
              <input
                type="text"
                className="form-control"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Monthly Office Electricity & Utilities"
                required
              />
            </div>

            <div>
              <label className="form-label">Vendor / Payee</label>
              <input
                type="text"
                className="form-control"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. City Power Corp"
              />
            </div>

            <div>
              <label className="form-label required">Expense Category / GL Account</label>
              <select
                className="form-control"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                {expenseAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Amount & Source</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label required">Expense Amount</label>
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

            <div>
              <label className="form-label">Input Tax Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={taxAmount || ''}
                onChange={(e) => setTaxAmount(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="form-label required">Paid From Account</label>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="bank"
                    checked={paymentType === 'bank'}
                    onChange={() => setPaymentType('bank')}
                  />
                  Bank Account
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="cash"
                    checked={paymentType === 'cash'}
                    onChange={() => setPaymentType('cash')}
                  />
                  Cash Account
                </label>
              </div>

              {paymentType === 'bank' ? (
                <select
                  className="form-control"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  required
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.bankName})
                    </option>
                  ))}
                </select>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
