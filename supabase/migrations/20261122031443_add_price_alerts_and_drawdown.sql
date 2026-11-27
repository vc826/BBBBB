/*
# Price alerts + daily drawdown limit

1. New Tables
- `price_alerts`
  - `id` (uuid, primary key)
  - `symbol` (text, not null, e.g. BTCUSDT)
  - `base` (text, not null)
  - `target_price` (numeric, not null)
  - `direction` (text: 'above' | 'below')
  - `triggered` (boolean, default false)
  - `created_at` (timestamptz, default now())
  - `triggered_at` (timestamptz, nullable)
2. Modified Tables
- `trading_settings`: add `max_daily_drawdown_pct` (numeric, default 5)
3. Security
- Enable RLS on `price_alerts`.
- Grant CRUD to anon + authenticated (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  base text NOT NULL,
  target_price numeric NOT NULL,
  direction text NOT NULL DEFAULT 'above' CHECK (direction IN ('above','below')),
  triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  triggered_at timestamptz
);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON price_alerts TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_price_alerts" ON price_alerts;
CREATE POLICY "anon_select_price_alerts" ON price_alerts FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_price_alerts" ON price_alerts;
CREATE POLICY "anon_insert_price_alerts" ON price_alerts FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_price_alerts" ON price_alerts;
CREATE POLICY "anon_update_price_alerts" ON price_alerts FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_price_alerts" ON price_alerts;
CREATE POLICY "anon_delete_price_alerts" ON price_alerts FOR DELETE
TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_settings' AND column_name = 'max_daily_drawdown_pct') THEN
    ALTER TABLE trading_settings ADD COLUMN max_daily_drawdown_pct numeric NOT NULL DEFAULT 5;
  END IF;
END $$;
