// =============================================================
// Treasury & Cash Management Domain Custom Errors
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

export class TreasuryError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: any

  constructor(message: string, code = 'TREASURY_ERROR', statusCode = 400, details?: any) {
    super(message)
    this.name = 'TreasuryError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class InvalidTransferError extends TreasuryError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_TREASURY_TRANSFER', 400, details)
    this.name = 'InvalidTransferError'
  }
}

export class TransferAlreadyPostedError extends TreasuryError {
  constructor(transferNumber: string) {
    super(`Treasury transfer "${transferNumber}" is already posted and cannot be modified.`, 'TRANSFER_ALREADY_POSTED', 400, { transferNumber })
    this.name = 'TransferAlreadyPostedError'
  }
}

export class ReconciliationClosedError extends TreasuryError {
  constructor(reconciliationNumber: string) {
    super(`Reconciliation session "${reconciliationNumber}" is closed. Modifications and additions are strictly locked.`, 'RECONCILIATION_CLOSED', 400, { reconciliationNumber })
    this.name = 'ReconciliationClosedError'
  }
}

export class PeriodReopenUnauthorizedError extends TreasuryError {
  constructor() {
    super('Unauthorized: only administrators or authorized financial controllers can reopen closed reconciliation periods with a valid reason.', 'UNAUTHORIZED_REOPEN', 403)
    this.name = 'PeriodReopenUnauthorizedError'
  }
}

export class PettyCashCountAlreadyPostedError extends TreasuryError {
  constructor(countNumber: string) {
    super(`Petty cash count "${countNumber}" is already posted.`, 'PETTY_CASH_COUNT_ALREADY_POSTED', 400, { countNumber })
    this.name = 'PettyCashCountAlreadyPostedError'
  }
}

export class PettyCashVarianceMissingAccountError extends TreasuryError {
  constructor(varianceAmount: number) {
    super(`Petty cash count has a variance of $${varianceAmount.toFixed(2)}. A variance GL expense/income account must be specified before posting.`, 'MISSING_VARIANCE_ACCOUNT', 400, { varianceAmount })
    this.name = 'PettyCashVarianceMissingAccountError'
  }
}

export class TreasuryAccountNotFoundError extends TreasuryError {
  constructor(accountId: string, type = 'Treasury Account') {
    super(`${type} "${accountId}" was not found or does not belong to the active business.`, 'TREASURY_ACCOUNT_NOT_FOUND', 404, { accountId, type })
    this.name = 'TreasuryAccountNotFoundError'
  }
}
