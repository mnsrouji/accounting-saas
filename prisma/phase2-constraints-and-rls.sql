-- =============================================================
-- Phase 02: Database Constraints, Accounting Triggers & RLS Policies
-- Multi-Tenant SaaS Accounting & Business Management Platform
-- =============================================================

-- =============================================================
-- 1. DATABASE CHECK CONSTRAINTS
-- =============================================================

-- Journal Entry Lines Constraints
ALTER TABLE journal_entry_lines
  DROP CONSTRAINT IF EXISTS chk_journal_line_debit_non_negative,
  ADD CONSTRAINT chk_journal_line_debit_non_negative CHECK (debit_amount >= 0);

ALTER TABLE journal_entry_lines
  DROP CONSTRAINT IF EXISTS chk_journal_line_credit_non_negative,
  ADD CONSTRAINT chk_journal_line_credit_non_negative CHECK (credit_amount >= 0);

ALTER TABLE journal_entry_lines
  DROP CONSTRAINT IF EXISTS chk_journal_line_single_side,
  ADD CONSTRAINT chk_journal_line_single_side CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (debit_amount = 0 AND credit_amount > 0)
  );

-- Payment Allocations Constraints: Exactly one target (Sale OR Purchase)
ALTER TABLE payment_allocations
  DROP CONSTRAINT IF EXISTS chk_payment_allocation_target,
  ADD CONSTRAINT chk_payment_allocation_target CHECK (
    (sale_id IS NOT NULL AND purchase_id IS NULL) OR
    (sale_id IS NULL AND purchase_id IS NOT NULL)
  );

ALTER TABLE payment_allocations
  DROP CONSTRAINT IF EXISTS chk_payment_allocation_amount_positive,
  ADD CONSTRAINT chk_payment_allocation_amount_positive CHECK (allocated_amount > 0);

-- Inventory Balance Constraints
ALTER TABLE inventory_balances
  DROP CONSTRAINT IF EXISTS chk_inv_balance_quantity,
  ADD CONSTRAINT chk_inv_balance_quantity CHECK (quantity >= 0);

ALTER TABLE inventory_balances
  DROP CONSTRAINT IF EXISTS chk_inv_balance_reserved,
  ADD CONSTRAINT chk_inv_balance_reserved CHECK (reserved_quantity >= 0);

-- =============================================================
-- 2. ACCOUNTING ENFORCEMENT & IMMUTABILITY TRIGGERS
-- =============================================================

-- A. Journal Entry Balance Enforcement Trigger
CREATE OR REPLACE FUNCTION verify_journal_balance_before_post()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_debit_sum  NUMERIC(20,4);
  v_credit_sum NUMERIC(20,4);
  v_line_count INT;
BEGIN
  -- Only execute when status becomes 'posted'
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    SELECT
      COALESCE(SUM(debit_amount), 0),
      COALESCE(SUM(credit_amount), 0),
      COUNT(*)
    INTO
      v_debit_sum,
      v_credit_sum,
      v_line_count
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'Accounting Error: Journal entry % must have at least 2 lines to be posted.', NEW.entry_number;
    END IF;

    IF v_debit_sum != v_credit_sum THEN
      RAISE EXCEPTION 'Accounting Error: Journal entry % is unbalanced (Debits: %, Credits: %).', NEW.entry_number, v_debit_sum, v_credit_sum;
    END IF;

    -- Automatically set posted_at if not set
    NEW.posted_at := COALESCE(NEW.posted_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_journal_balance ON journal_entries;
CREATE TRIGGER trg_verify_journal_balance
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION verify_journal_balance_before_post();

-- B. Immutability of Posted Journal Entries
CREATE OR REPLACE FUNCTION enforce_posted_journal_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If already posted, only allow transition to 'reversed' or 'voided' with reversal link
  IF OLD.status = 'posted' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Audit Security: Posted journal entry % cannot be deleted. Use a reversal entry instead.', OLD.entry_number;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW.status NOT IN ('reversed', 'voided') THEN
        RAISE EXCEPTION 'Audit Security: Posted journal entry % is immutable and cannot be edited. Create a reversal entry.', OLD.entry_number;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_journal_immutability ON journal_entries;
CREATE TRIGGER trg_enforce_posted_journal_immutability
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_posted_journal_immutability();

-- C. Prevent editing or deleting lines of a posted journal entry
CREATE OR REPLACE FUNCTION enforce_posted_journal_lines_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_status TEXT;
  v_entry_id UUID;
BEGIN
  v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END;

  SELECT status::TEXT INTO v_parent_status
  FROM journal_entries
  WHERE id = v_entry_id;

  IF v_parent_status = 'posted' THEN
    RAISE EXCEPTION 'Audit Security: Cannot add, edit, or delete lines of a posted journal entry.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_journal_lines_immutability ON journal_entry_lines;
CREATE TRIGGER trg_enforce_posted_journal_lines_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_posted_journal_lines_immutability();

-- =============================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR NEW & EXISTING TABLES
-- =============================================================

-- Helper functions must be available:
CREATE OR REPLACE FUNCTION is_business_member(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_users
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- RLS: ROLES & PERMISSIONS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_tenant_policy" ON roles;
CREATE POLICY "roles_tenant_policy" ON roles
  FOR ALL USING (business_id IS NULL OR is_business_member(business_id));

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_read_all" ON permissions;
CREATE POLICY "permissions_read_all" ON permissions
  FOR SELECT USING (true);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_tenant_policy" ON role_permissions;
CREATE POLICY "role_permissions_tenant_policy" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND (r.business_id IS NULL OR is_business_member(r.business_id))
    )
  );

-- RLS: INVENTORY BALANCES & MOVEMENTS
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_balances_tenant_policy" ON inventory_balances;
CREATE POLICY "inventory_balances_tenant_policy" ON inventory_balances
  FOR ALL USING (is_business_member(business_id));

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_movements_tenant_policy" ON inventory_movements;
CREATE POLICY "inventory_movements_tenant_policy" ON inventory_movements
  FOR ALL USING (is_business_member(business_id));

-- RLS: SALES ORDERS & ITEMS
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_orders_tenant_policy" ON sales_orders;
CREATE POLICY "sales_orders_tenant_policy" ON sales_orders
  FOR ALL USING (is_business_member(business_id));

ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_order_items_tenant_policy" ON sales_order_items;
CREATE POLICY "sales_order_items_tenant_policy" ON sales_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_id AND is_business_member(so.business_id)
    )
  );

-- RLS: PURCHASE ORDERS & ITEMS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_orders_tenant_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_tenant_policy" ON purchase_orders
  FOR ALL USING (is_business_member(business_id));

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_order_items_tenant_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_tenant_policy" ON purchase_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_id AND is_business_member(po.business_id)
    )
  );

-- RLS: PAYMENT ALLOCATIONS
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_allocations_tenant_policy" ON payment_allocations;
CREATE POLICY "payment_allocations_tenant_policy" ON payment_allocations
  FOR ALL USING (is_business_member(business_id));

-- RLS: CURRENCIES & EXCHANGE RATES
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "currencies_read_all" ON currencies;
CREATE POLICY "currencies_read_all" ON currencies
  FOR SELECT USING (true);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exchange_rates_tenant_policy" ON exchange_rates;
CREATE POLICY "exchange_rates_tenant_policy" ON exchange_rates
  FOR ALL USING (is_business_member(business_id));

-- RLS: SaaS SUBSCRIPTIONS & PLANS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_plans_read_all" ON subscription_plans;
CREATE POLICY "subscription_plans_read_all" ON subscription_plans
  FOR SELECT USING (true);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_tenant_policy" ON subscriptions;
CREATE POLICY "subscriptions_tenant_policy" ON subscriptions
  FOR ALL USING (is_business_member(business_id));
