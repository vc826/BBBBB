/*
# Trading app settings (single-tenant, no auth)

1. New Tables
- `trading_settings`
  - `id` (uuid, primary key, single row)
  - `exchange_connections` (jsonb): array of { exchange, apiKey, apiSecret, label, connectedAt }
  - `auto_trade_enabled` (boolean, default false): master switch for automatic order execution
  - `auto_trade_config` (jsonb): { riskPerTradePct, maxOpenPositions, preferTradeType, minConfidence }
  - `updated_at` (timestamptz)
2. Security
- Enable RLS on `trading_settings`.
- Grant CRUD to anon + authenticated (no-auth single-tenant app).
- Allow anon + authenticated full CRUD because this is a personal tool with no sign-in.
*/

CREATE TABLE IF NOT EXISTS trading_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_connections jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_trade_enabled boolean NOT NULL DEFAULT false,
  auto_trade_config jsonb NOT NULL DEFAULT '{"riskPerTradePct": 1, "maxOpenPositions": 3, "preferTradeType": "spot", "minConfidence": 70}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON trading_settings TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_trading_settings" ON trading_settings;
CREATE POLICY "anon_select_trading_settings" ON trading_settings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trading_settings" ON trading_settings;
CREATE POLICY "anon_insert_trading_settings" ON trading_settings FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trading_settings" ON trading_settings;
CREATE POLICY "anon_update_trading_settings" ON trading_settings FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trading_settings" ON trading_settings;
CREATE POLICY "anon_delete_trading_settings" ON trading_settings FOR DELETE
TO anon, authenticated USING (true);
