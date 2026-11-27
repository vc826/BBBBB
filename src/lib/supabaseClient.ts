import { createClient } from "@supabase/supabase-js";
import type { TradingSettings, Trade, NewTrade, PriceAlert, NewPriceAlert, FundingTransaction, NewFundingTransaction } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);

const SETTINGS_TABLE = "trading_settings";
const TRADES_TABLE = "trades";

export async function loadSettings(): Promise<TradingSettings | null> {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("loadSettings error", error);
    return null;
  }
  return (data as TradingSettings) ?? null;
}

export async function saveSettings(settings: TradingSettings): Promise<TradingSettings | null> {
  const payload = { ...settings, updated_at: new Date().toISOString() };
  delete (payload as Partial<TradingSettings>).id;
  const { data: existing } = await supabase.from(SETTINGS_TABLE).select("id").limit(1).maybeSingle();

  let result;
  if (existing?.id) {
    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    const { data, error } = await supabase.from(SETTINGS_TABLE).insert(payload).select().single();
    result = { data, error };
  }
  if (result.error) {
    console.error("saveSettings error", result.error);
    return null;
  }
  return result.data as TradingSettings;
}

export async function loadTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from(TRADES_TABLE)
    .select("*")
    .order("opened_at", { ascending: false });
  if (error) {
    console.error("loadTrades error", error);
    return [];
  }
  return (data as Trade[]) ?? [];
}

export async function insertTrade(t: NewTrade): Promise<Trade | null> {
  const { data, error } = await supabase
    .from(TRADES_TABLE)
    .insert(t)
    .select()
    .single();
  if (error) {
    console.error("insertTrade error", error);
    return null;
  }
  return data as Trade;
}

export async function closeTrade(
  id: string,
  exitPrice: number,
  pnl: number,
): Promise<Trade | null> {
  const { data, error } = await supabase
    .from(TRADES_TABLE)
    .update({
      status: "closed",
      exit_price: exitPrice,
      pnl,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("closeTrade error", error);
    return null;
  }
  return data as Trade;
}

export async function updateTradeExternalOrderId(id: string, orderId: string): Promise<void> {
  await supabase.from(TRADES_TABLE).update({ external_order_id: orderId }).eq("id", id);
}

const ALERTS_TABLE = "price_alerts";

export async function loadPriceAlerts(): Promise<PriceAlert[]> {
  const { data, error } = await supabase
    .from(ALERTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadPriceAlerts error", error);
    return [];
  }
  return (data as PriceAlert[]) ?? [];
}

export async function insertPriceAlert(a: NewPriceAlert): Promise<PriceAlert | null> {
  const { data, error } = await supabase
    .from(ALERTS_TABLE)
    .insert(a)
    .select()
    .single();
  if (error) {
    console.error("insertPriceAlert error", error);
    return null;
  }
  return data as PriceAlert;
}

export async function deletePriceAlert(id: string): Promise<void> {
  await supabase.from(ALERTS_TABLE).delete().eq("id", id);
}

export async function markPriceAlertTriggered(id: string): Promise<void> {
  await supabase
    .from(ALERTS_TABLE)
    .update({ triggered: true, triggered_at: new Date().toISOString() })
    .eq("id", id);
}

const FUNDING_TABLE = "funding_transactions";

export async function loadFundingTransactions(): Promise<FundingTransaction[]> {
  const { data, error } = await supabase
    .from(FUNDING_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadFundingTransactions error", error);
    return [];
  }
  return (data as FundingTransaction[]) ?? [];
}

export async function insertFundingTransaction(t: NewFundingTransaction): Promise<FundingTransaction | null> {
  const { data, error } = await supabase
    .from(FUNDING_TABLE)
    .insert(t)
    .select()
    .single();
  if (error) {
    console.error("insertFundingTransaction error", error);
    return null;
  }
  return data as FundingTransaction;
}

export async function fetchDepositAddress(
  exchange: string,
  apiKey: string,
  apiSecret: string,
  testnet: boolean,
  asset: string,
  network?: string,
): Promise<{ address: string; network: string } | { error: string }> {
  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/funding`;
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "deposit-address",
        exchange,
        apiKey,
        apiSecret,
        testnet,
        asset,
        network,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
      return { error: body?.error ?? `HTTP ${res.status}` };
    }
    return { address: body.address, network: body.network };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function submitWithdrawal(
  exchange: string,
  apiKey: string,
  apiSecret: string,
  testnet: boolean,
  asset: string,
  network: string | undefined,
  amount: number,
  address: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/funding`;
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "withdraw",
        exchange,
        apiKey,
        apiSecret,
        testnet,
        asset,
        network,
        amount,
        address,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
      return { success: false, error: body?.error ?? `HTTP ${res.status}` };
    }
    return { success: true, id: body.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
