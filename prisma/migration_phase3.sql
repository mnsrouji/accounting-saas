-- =============================================================
-- Migration: Phase 3 — Data Integrity & Fiscal Period Locking
-- AccountFlow Multi-Tenant SaaS Accounting Platform
-- Date: 2026-09-30
-- =============================================================

-- ----------------------------------------------------------------
-- 1. ACCOUNTING PERIODS TABLE (Fiscal Period Locking)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounting_periods (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  fiscal_year   INTEGER     NOT NULL,
  fiscal_month  INTEGER     NOT NULL,   -- 1-12 monthly, 0 = annual

  period_start  DATE        NOT NULL,
  period_end    DATE        NOT NULL,

  status        TEXT        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'locked')),

  locked_at     TIMESTAMPTZ,
  locked_by     UUID,
  closed_at     TIMESTAMPTZ,
  closed_by     UUID,
  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT accounting_periods_business_year_month_key
    UNIQUE (business_id, fiscal_year, fiscal_month)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_business_status
  ON accounting_periods(business_id, status);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_business_dates
  ON accounting_periods(business_id, period_start, period_end);

-- ----------------------------------------------------------------
-- 2. INVENTORY BALANCE SAFETY CONSTRAINTS
-- ----------------------------------------------------------------
-- PostgreSQL does NOT support "ADD CONSTRAINT IF NOT EXISTS" for CHECK.
-- We use DO blocks to check existence before adding.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_balances_qty_non_negative'
      AND conrelid = 'inventory_balances'::regclass
  ) THEN
    ALTER TABLE inventory_balances
      ADD CONSTRAINT inventory_balances_qty_non_negative
      CHECK (quantity >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_balances_available_qty_non_negative'
      AND conrelid = 'inventory_balances'::regclass
  ) THEN
    ALTER TABLE inventory_balances
      ADD CONSTRAINT inventory_balances_available_qty_non_negative
      CHECK (available_quantity >= -0.0001);
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 3. ROW LEVEL SECURITY FOR ACCOUNTING PERIODS
-- ----------------------------------------------------------------

ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting_periods_tenant_isolation" ON accounting_periods;
CREATE POLICY "accounting_periods_tenant_isolation"
  ON accounting_periods
  FOR ALL
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      INNER JOIN business_users bu ON bu.business_id = b.id
      WHERE bu.user_id = auth.uid()
        AND bu.status = 'active'
    )
  );

-- ----------------------------------------------------------------
-- 4. AUTO-UPDATE updated_at TRIGGER
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_accounting_periods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounting_periods_updated_at ON accounting_periods;
CREATE TRIGGER trg_accounting_periods_updated_at
  BEFORE UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION update_accounting_periods_updated_at();
