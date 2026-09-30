// =============================================================
// Accounting Domain Custom Errors
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

export class AccountingError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: any

  constructor(message: string, code = 'ACCOUNTING_ERROR', statusCode = 400, details?: any) {
    super(message)
    this.name = 'AccountingError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class InsufficientStockError extends AccountingError {
  constructor(productName: string, requested: number, available: number) {
    super(
      `Insufficient inventory for "${productName}". Requested: ${requested}, Available in stock: ${available}.`,
      'INSUFFICIENT_STOCK',
      400,
      { productName, requested, available }
    )
    this.name = 'InsufficientStockError'
  }
}

export class OverAllocationError extends AccountingError {
  constructor(paymentAmount: number, allocatedAmount: number) {
    super(
      `Payment over-allocation rejected. Total allocated ($${allocatedAmount.toFixed(2)}) exceeds payment amount ($${paymentAmount.toFixed(2)}).`,
      'OVER_ALLOCATION',
      400,
      { paymentAmount, allocatedAmount }
    )
    this.name = 'OverAllocationError'
  }
}

export class UnbalancedJournalError extends AccountingError {
  constructor(entryNumber: string, totalDebit: number, totalCredit: number) {
    super(
      `Journal entry "${entryNumber}" is unbalanced. Total Debits ($${totalDebit.toFixed(2)}) must equal Total Credits ($${totalCredit.toFixed(2)}).`,
      'UNBALANCED_JOURNAL',
      400,
      { entryNumber, totalDebit, totalCredit }
    )
    this.name = 'UnbalancedJournalError'
  }
}

export class TenantAccessDeniedError extends AccountingError {
  constructor(resourceName = 'Resource') {
    super(
      `Access denied: ${resourceName} does not belong to the active business or tenant access is unauthorized.`,
      'TENANT_ACCESS_DENIED',
      403
    )
    this.name = 'TenantAccessDeniedError'
  }
}

export class AlreadyPostedError extends AccountingError {
  constructor(resourceName: string, id: string) {
    super(
      `${resourceName} (${id}) is already posted and immutable. Direct edits are prohibited. Use a reversal workflow.`,
      'ALREADY_POSTED',
      400,
      { resourceName, id }
    )
    this.name = 'AlreadyPostedError'
  }
}

export class InvalidReversalError extends AccountingError {
  constructor(message: string) {
    super(message, 'INVALID_REVERSAL', 400)
    this.name = 'InvalidReversalError'
  }
}

export class ValidationError extends AccountingError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

