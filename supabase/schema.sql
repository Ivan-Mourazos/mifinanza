-- ============================================
-- MIFINANZA DATABASE SCHEMA
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color_code TEXT NOT NULL DEFAULT '#00FF88',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings (balance inicial)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  initial_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saving pots (apartados)
CREATE TABLE IF NOT EXISTS saving_pots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  color_code TEXT NOT NULL DEFAULT '#00D9FF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saving pot movements (historial de apartados)
CREATE TABLE IF NOT EXISTS saving_pot_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pot_id UUID REFERENCES saving_pots(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Categories RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own categories" ON categories;

CREATE POLICY "Users can manage own categories" ON categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transactions RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own transactions" ON transactions;

CREATE POLICY "Users can manage own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User settings RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;

CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Saving pots RLS
ALTER TABLE saving_pots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saving pots" ON saving_pots;

CREATE POLICY "Users can manage own saving pots" ON saving_pots
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Saving pot movements RLS
ALTER TABLE saving_pot_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saving pot movements" ON saving_pot_movements;

CREATE POLICY "Users can manage own saving pot movements" ON saving_pot_movements
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_saving_pots_user ON saving_pots(user_id);
CREATE INDEX IF NOT EXISTS idx_saving_pot_movements_user ON saving_pot_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_saving_pot_movements_pot ON saving_pot_movements(pot_id);
CREATE INDEX IF NOT EXISTS idx_saving_pot_movements_user_pot_created ON saving_pot_movements(user_id, pot_id, created_at DESC);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Function to calculate totals in the database
CREATE OR REPLACE FUNCTION get_user_transaction_totals(user_id_param UUID)
RETURNS TABLE (
  income DECIMAL(12, 2),
  expense DECIMAL(12, 2),
  balance DECIMAL(12, 2)
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense,
    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) - COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS balance
  FROM transactions
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;
