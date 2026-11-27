/*
# Portfolio trades, paper trading, and notification settings

1. New Tables
- `trades`
  - `id` (uuid, primary key)
  - `mode` (text: 'paper' | 'live')
  - `exchange` (text, nullable for paper)
  - `symbol` (text, not null, e.g. BTCUSDT)
  - `base` (text, not null, e.g. BTC)
  - `side` (text: 'long' | 'short')
  - `trade_type` (text: 'spot' | 'futures')
  - `status` (text: 'open' | 'closed')
  - `quantity` (numeric, not null)
  - `entry_price` (numeric, not null)
  - `take_profit` (numeric, not null)
  - `stop_loss` (numeric, not null)
  - `exit_price` (numeric, nullable)
  - `pnl` (numeric, default 0)
  - `confidence` (integer)
  - `timeframe` (text)
  - `opened_at` (timestamptz, default now())
  - `closed_at` (timestamptz, nullable)
  - `external_order_id` (text, nullable, for live exchange order ids)
2. Modified Tables
- `trading_settings`: add columns
  - `paper_balance` (numeric, default 10000)
  - `paper_mode` (boolean, default true)
  - `notifications` (jsonb): { email: string|null, telegramChatId: string|null, telegramBotToken: string|null, alertOnSignal: bool, alertOnStopLoss: bool, minSignalConfidence: int }
3. Security
- Enable RLS on `trades`.
- Grant CRUD to anon + authenticated (single-tenant, no auth).
- Allow anon + authenticated full CRUD on trades.
4. Notes
- Single-tenant app with no sign-in; data is intentionally shared.
*/

CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper','live')),
  exchange text,
  symbol text NOT NULL,
  base text NOT NULL,
  side text NOT NULL CHECK (side IN ('long','short')),
  trade_type text NOT NULL DEFAULT 'spot' CHECK (trade_type IN ('spot','futures')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  quantity numeric NOT NULL DEFAULT 0,
  entry_price numeric NOT NULL DEFAULT 0,
  take_profit numeric NOT NULL DEFAULT 0,
  stop_loss numeric NOT NULL DEFAULT 0,
  exit_price numeric,
  pnl numeric NOT NULL DEFAULT 0,
  confidence integer NOT NULL DEFAULT 0,
  timeframe text NOT NULL DEFAULT '15m',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  external_order_id text
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON trades TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_trades" ON trades;
CREATE POLICY "anon_select_trades" ON trades FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trades" ON trades;
CREATE POLICY "anon_insert_trades" ON trades FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trades" ON trades;
CREATE POLICY "anon_update_trades" ON trades FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trades" ON trades;
CREATE POLICY "anon_delete_trades" ON trades FOR DELETE
TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_settings' AND column_name = 'paper_balance') THEN
    ALTER TABLE trading_settings ADD COLUMN paper_balance numeric NOT NULL DEFAULT 10000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_settings' AND column_name = 'paper_mode') THEN
    ALTER TABLE trading_settings ADD COLUMN paper_mode boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_settings' AND column_name = 'notifications') THEN
    ALTER TABLE trading_settings ADD COLUMN notifications jsonb NOT NULL DEFAULT '{"email":null,"telegramChatId":null,"telegramBotToken":null,"alertOnSignal":false,"alertOnStopLoss":false,"alertOnTradeExecuted":false,"minSignalConfidence":75}'::jsonb;
  END IF;
END $$;
