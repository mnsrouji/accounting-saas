-- =============================================================
-- Supabase Row Level Security (RLS) Policies
-- Run this in your Supabase SQL editor AFTER running Prisma migrations
-- =============================================================

-- ============================================================
-- HELPER FUNCTION: Check if current user is a member of a business
-- ============================================================
CREATE OR REPLACE FUNCTION is_business_member(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_users
    WHERE user_id = auth.uid()
    AND business_id = p_business_id
    AND status = 'active'
  );
$$;

-- Helper: check if user has a specific role or higher in a business
CREATE OR REPLACE FUNCTION has_business_role(p_business_id UUID, VARIADIC p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_users
    WHERE user_id = auth.uid()
    AND business_id = p_business_id
    AND status = 'active'
    AND role::TEXT = ANY(p_roles)
  );
$$;

-- ============================================================
-- USERS TABLE
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- Allow users to see other members of their businesses
CREATE POLICY "users_select_colleagues" ON users
  FOR SELECT USING (
    id IN (
      SELECT user_id FROM business_users bu
      WHERE bu.business_id IN (
        SELECT business_id FROM business_users
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- ============================================================
-- BUSINESSES TABLE
-- ============================================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businesses_select_member" ON businesses
  FOR SELECT USING (is_business_member(id));

CREATE POLICY "businesses_insert_authenticated" ON businesses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "businesses_update_owner_admin" ON businesses
  FOR UPDATE USING (
    has_business_role(id, 'owner', 'administrator')
  );

-- ============================================================
-- BUSINESS_USERS TABLE
-- ============================================================
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_users_select_member" ON business_users
  FOR SELECT USING (is_business_member(business_id));

CREATE POLICY "business_users_insert_owner_admin" ON business_users
  FOR INSERT WITH CHECK (
    has_business_role(business_id, 'owner', 'administrator')
  );

CREATE POLICY "business_users_update_owner_admin" ON business_users
  FOR UPDATE USING (
    has_business_role(business_id, 'owner', 'administrator')
  );

CREATE POLICY "business_users_delete_owner" ON business_users
  FOR DELETE USING (
    has_business_role(business_id, 'owner')
    AND user_id != auth.uid() -- Cannot remove yourself if owner
  );

-- ============================================================
-- GENERIC TENANT ISOLATION MACRO
-- Applied to: customers, suppliers, categories, products,
-- warehouses, sales, purchases, expenses, payments,
-- cash_accounts, bank_accounts, chart_of_accounts,
-- journal_entries, taxes, exchange_rates, attachments,
-- notifications, audit_logs
-- ============================================================

-- CUSTOMERS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_tenant_select" ON customers FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "customers_tenant_insert" ON customers FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "customers_tenant_update" ON customers FOR UPDATE USING (is_business_member(business_id));
CREATE POLICY "customers_tenant_delete" ON customers FOR DELETE USING (has_business_role(business_id, 'owner', 'administrator'));

-- SUPPLIERS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_tenant_select" ON suppliers FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "suppliers_tenant_insert" ON suppliers FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "suppliers_tenant_update" ON suppliers FOR UPDATE USING (is_business_member(business_id));
CREATE POLICY "suppliers_tenant_delete" ON suppliers FOR DELETE USING (has_business_role(business_id, 'owner', 'administrator'));

-- CATEGORIES
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_tenant_select" ON categories FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "categories_tenant_insert" ON categories FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "categories_tenant_update" ON categories FOR UPDATE USING (is_business_member(business_id));
CREATE POLICY "categories_tenant_delete" ON categories FOR DELETE USING (has_business_role(business_id, 'owner', 'administrator'));

-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_tenant_select" ON products FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "products_tenant_insert" ON products FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "products_tenant_update" ON products FOR UPDATE USING (is_business_member(business_id));
CREATE POLICY "products_tenant_delete" ON products FOR DELETE USING (has_business_role(business_id, 'owner', 'administrator'));

-- PRODUCT_INVENTORY (via products.business_id)
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_tenant_select" ON product_inventory FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_business_member(business_id)));
CREATE POLICY "inventory_tenant_insert" ON product_inventory FOR INSERT
  WITH CHECK (product_id IN (SELECT id FROM products WHERE is_business_member(business_id)));
CREATE POLICY "inventory_tenant_update" ON product_inventory FOR UPDATE
  USING (product_id IN (SELECT id FROM products WHERE is_business_member(business_id)));

-- WAREHOUSES
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses_tenant_select" ON warehouses FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "warehouses_tenant_insert" ON warehouses FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "warehouses_tenant_update" ON warehouses FOR UPDATE USING (is_business_member(business_id));

-- SALES
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_tenant_select" ON sales FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "sales_tenant_insert" ON sales FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "sales_tenant_update" ON sales FOR UPDATE USING (is_business_member(business_id));

-- SALE_ITEMS (via sale.business_id)
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items_tenant_select" ON sale_items FOR SELECT
  USING (sale_id IN (SELECT id FROM sales WHERE is_business_member(business_id)));
CREATE POLICY "sale_items_tenant_insert" ON sale_items FOR INSERT
  WITH CHECK (sale_id IN (SELECT id FROM sales WHERE is_business_member(business_id)));
CREATE POLICY "sale_items_tenant_update" ON sale_items FOR UPDATE
  USING (sale_id IN (SELECT id FROM sales WHERE is_business_member(business_id)));
CREATE POLICY "sale_items_tenant_delete" ON sale_items FOR DELETE
  USING (sale_id IN (SELECT id FROM sales WHERE is_business_member(business_id)));

-- PURCHASES
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_tenant_select" ON purchases FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "purchases_tenant_insert" ON purchases FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "purchases_tenant_update" ON purchases FOR UPDATE USING (is_business_member(business_id));

-- PURCHASE_ITEMS
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_items_tenant_select" ON purchase_items FOR SELECT
  USING (purchase_id IN (SELECT id FROM purchases WHERE is_business_member(business_id)));
CREATE POLICY "purchase_items_tenant_insert" ON purchase_items FOR INSERT
  WITH CHECK (purchase_id IN (SELECT id FROM purchases WHERE is_business_member(business_id)));
CREATE POLICY "purchase_items_tenant_update" ON purchase_items FOR UPDATE
  USING (purchase_id IN (SELECT id FROM purchases WHERE is_business_member(business_id)));
CREATE POLICY "purchase_items_tenant_delete" ON purchase_items FOR DELETE
  USING (purchase_id IN (SELECT id FROM purchases WHERE is_business_member(business_id)));

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_tenant_select" ON payments FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "payments_tenant_insert" ON payments FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "payments_tenant_update" ON payments FOR UPDATE USING (is_business_member(business_id));

-- EXPENSES
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_tenant_select" ON expenses FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "expenses_tenant_insert" ON expenses FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "expenses_tenant_update" ON expenses FOR UPDATE USING (is_business_member(business_id));

-- CASH_ACCOUNTS
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_accounts_tenant_select" ON cash_accounts FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "cash_accounts_tenant_insert" ON cash_accounts FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "cash_accounts_tenant_update" ON cash_accounts FOR UPDATE USING (is_business_member(business_id));

-- CASH_TRANSACTIONS
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_tx_tenant_select" ON cash_transactions FOR SELECT
  USING (cash_account_id IN (SELECT id FROM cash_accounts WHERE is_business_member(business_id)));

-- BANK_ACCOUNTS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_tenant_select" ON bank_accounts FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "bank_accounts_tenant_insert" ON bank_accounts FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "bank_accounts_tenant_update" ON bank_accounts FOR UPDATE USING (is_business_member(business_id));

-- BANK_TRANSACTIONS
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_tx_tenant_select" ON bank_transactions FOR SELECT
  USING (bank_account_id IN (SELECT id FROM bank_accounts WHERE is_business_member(business_id)));

-- CHART_OF_ACCOUNTS
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coa_tenant_select" ON chart_of_accounts FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "coa_tenant_insert" ON chart_of_accounts FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "coa_tenant_update" ON chart_of_accounts FOR UPDATE
  USING (is_business_member(business_id) AND is_system = false);

-- JOURNAL_ENTRIES
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "je_tenant_select" ON journal_entries FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "je_tenant_insert" ON journal_entries FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "je_tenant_update" ON journal_entries FOR UPDATE USING (
  is_business_member(business_id)
  AND has_business_role(business_id, 'owner', 'administrator', 'accountant')
);

-- JOURNAL_ENTRY_LINES (via journal_entry.business_id)
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jel_tenant_select" ON journal_entry_lines FOR SELECT
  USING (journal_entry_id IN (SELECT id FROM journal_entries WHERE is_business_member(business_id)));
CREATE POLICY "jel_tenant_insert" ON journal_entry_lines FOR INSERT
  WITH CHECK (journal_entry_id IN (SELECT id FROM journal_entries WHERE is_business_member(business_id)));

-- TAXES
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taxes_tenant_select" ON taxes FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "taxes_tenant_insert" ON taxes FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "taxes_tenant_update" ON taxes FOR UPDATE USING (is_business_member(business_id));

-- EXCHANGE_RATES
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchange_rates_tenant_select" ON exchange_rates FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "exchange_rates_tenant_insert" ON exchange_rates FOR INSERT WITH CHECK (is_business_member(business_id));

-- ATTACHMENTS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_tenant_select" ON attachments FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "attachments_tenant_insert" ON attachments FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "attachments_tenant_delete" ON attachments FOR DELETE USING (is_business_member(business_id));

-- NOTIFICATIONS (user-specific within business)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications FOR SELECT
  USING (user_id = auth.uid() AND is_business_member(business_id));
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- AUDIT_LOGS (read-only for members, insert via service role)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_tenant_select" ON audit_logs FOR SELECT
  USING (
    business_id IS NULL
    OR is_business_member(business_id)
  );
-- Inserts only allowed via service role (server-side)

-- ============================================================
-- TRIGGER: Auto-create user profile from Supabase Auth signup
-- ============================================================
ALTER TABLE public.users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url',
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: Verify journal entry balance before posting
-- ============================================================
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_debit  NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Only check when status changes to 'posted'
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    SELECT
      COALESCE(SUM(debit_amount), 0),
      COALESCE(SUM(credit_amount), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.id;

    IF v_total_debit != v_total_credit THEN
      RAISE EXCEPTION
        'Journal entry is not balanced. Debits: %, Credits: %',
        v_total_debit, v_total_credit;
    END IF;

    IF v_total_debit = 0 THEN
      RAISE EXCEPTION 'Journal entry has no lines';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_journal_balance
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION check_journal_balance();

-- ============================================================
-- STORAGE: Bucket & RLS for tenant-isolated file storage
-- ============================================================

-- Run in Supabase Storage:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('business-files', 'business-files', false);

CREATE POLICY "business_files_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'business-files'
    AND (storage.foldername(name))[1] = 'businesses'
    AND is_business_member(((storage.foldername(name))[2])::UUID)
  );

CREATE POLICY "business_files_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-files'
    AND (storage.foldername(name))[1] = 'businesses'
    AND is_business_member(((storage.foldername(name))[2])::UUID)
  );

CREATE POLICY "business_files_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-files'
    AND (storage.foldername(name))[1] = 'businesses'
    AND is_business_member(((storage.foldername(name))[2])::UUID)
  );
