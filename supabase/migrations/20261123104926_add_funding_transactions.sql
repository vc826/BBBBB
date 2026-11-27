/*
# Funding transactions table

1. New Tables
- `funding_transactions`
  - `id` (uuid, primary key)
  - `type` (text: 'deposit' | 'withdrawal')
  - `asset` (text, e.g. BTC, ETH, USDT)
  - `network` (text, e.g. BTC, ERC20, TRC20)
  - `amount` (numeric, not null)
  - `address` (text, nullable — destination address for withdrawals, source for deposits)
  - `exchange` (text, nullable — which exchange handled it)
  - `status` (text: 'pending' | 'completed' | 'failed')
  - `txid` (text, nullable — on-chain transaction id)
  - `created_at` (timestamptz, default now())
  - `completed_at` (timestamptz, nullable)
2. Security
- Enable RLS on `funding_transactions`.
- Grant CRUD to anon + authenticated (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS funding_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('deposit','withdrawal')),
  asset text NOT NULL,
  network text,
  amount numeric NOT NULL,
  address text,
  exchange text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  txid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE funding_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON funding_transactions TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_funding" ON funding_transactions;
CREATE POLICY "anon_select_funding" ON funding_transactions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_funding" ON funding_transactions;
CREATE POLICY "anon_insert_funding" ON funding_transactions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_funding" ON funding_transactions;
CREATE POLICY "anon_update_funding" ON funding_transactions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_funding" ON funding_transactions;
CREATE POLICY "anon_delete_funding" ON funding_transactions FOR DELETE
TO anon, authenticated USING (true);
