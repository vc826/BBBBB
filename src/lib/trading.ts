import { supabase, insertTrade, closeTrade } from "./supabaseClient";
import type { Signal, TradingSettings, Trade, ExchangeConnection } from "./types";

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  tradeId?: string;
}

function calcQuantity(signal: Signal, balance: number, riskPct: number): number {
  const riskAmount = balance * (riskPct / 100);
  const slDistance = Math.abs(signal.entry - signal.stopLoss) || signal.entry * 0.01;
  const qty = riskAmount / slDistance;
  return Math.max(qty, 0);
}

export async function placeLiveOrder(
  signal: Signal,
  settings: TradingSettings,
  connection: ExchangeConnection,
): Promise<OrderResult> {
  const balance = settings.paper_balance > 0 ? settings.paper_balance : 10000;
  const qty = calcQuantity(signal, balance, settings.auto_trade_config.riskPerTradePct);
  if (qty <= 0) return { success: false, error: "Computed quantity is zero" };

  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/place-order`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      exchange: connection.exchange,
      apiKey: connection.apiKey,
      apiSecret: connection.apiSecret,
      testnet: connection.testnet,
      symbol: signal.symbol,
      side: signal.side,
      tradeType: signal.tradeType,
      quantity: qty,
      takeProfit: signal.takeProfit,
      stopLoss: signal.stopLoss,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    return { success: false, error: body?.error ?? `Order HTTP ${res.status}` };
  }

  const trade = await insertTrade({
    mode: "live",
    exchange: connection.exchange,
    symbol: signal.symbol,
    base: signal.base,
    side: signal.side as "long" | "short",
    trade_type: signal.tradeType,
    status: "open",
    quantity: qty,
    entry_price: signal.entry,
    take_profit: signal.takeProfit,
    stop_loss: signal.stopLoss,
    confidence: signal.confidence,
    timeframe: signal.timeframe,
    external_order_id: body.orderId ?? null,
  });

  return { success: true, orderId: body.orderId, tradeId: trade?.id };
}

export async function placePaperOrder(
  signal: Signal,
  settings: TradingSettings,
): Promise<OrderResult> {
  const qty = calcQuantity(signal, settings.paper_balance, settings.auto_trade_config.riskPerTradePct);
  if (qty <= 0) return { success: false, error: "Computed quantity is zero" };

  const trade = await insertTrade({
    mode: "paper",
    exchange: null,
    symbol: signal.symbol,
    base: signal.base,
    side: signal.side as "long" | "short",
    trade_type: signal.tradeType,
    status: "open",
    quantity: qty,
    entry_price: signal.entry,
    take_profit: signal.takeProfit,
    stop_loss: signal.stopLoss,
    confidence: signal.confidence,
    timeframe: signal.timeframe,
  });

  return { success: true, tradeId: trade?.id };
}

export interface CloseResult {
  success: boolean;
  pnl: number;
  error?: string;
}

export async function closeTradeAtPrice(trade: Trade, exitPrice: number): Promise<CloseResult> {
  const dir = trade.side === "long" ? 1 : -1;
  const pnl = (exitPrice - trade.entry_price) * trade.quantity * dir;
  const updated = await closeTrade(trade.id, exitPrice, pnl);
  return { success: !!updated, pnl };
}

export async function checkOpenTradesAgainstPrices(
  trades: Trade[],
  prices: Record<string, number>,
): Promise<Trade[]> {
  const closed: Trade[] = [];
  for (const trade of trades) {
    if (trade.status !== "open") continue;
    const price = prices[trade.symbol];
    if (!price) continue;

    const hitTp = trade.side === "long" ? price >= trade.take_profit : price <= trade.take_profit;
    const hitSl = trade.side === "long" ? price <= trade.stop_loss : price >= trade.stop_loss;

    if (hitTp) {
      const r = await closeTradeAtPrice(trade, trade.take_profit);
      if (r.success) closed.push(trade);
    } else if (hitSl) {
      const r = await closeTradeAtPrice(trade, trade.stop_loss);
      if (r.success) closed.push(trade);
    }
  }
  return closed;
}

export function getDailyDrawdownPct(trades: Trade[], balance: number): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayClosed = trades.filter(
    (t) => t.status === "closed" && t.closed_at && new Date(t.closed_at) >= startOfDay,
  );
  const todayLoss = todayClosed.reduce((a, t) => a + Math.min(0, t.pnl), 0);
  if (balance <= 0 || todayLoss >= 0) return 0;
  return (Math.abs(todayLoss) / balance) * 100;
}

export function exportTradesCsv(trades: Trade[]): void {
  const headers = [
    "Symbol", "Base", "Side", "Mode", "Type", "Status",
    "Quantity", "Entry Price", "Take Profit", "Stop Loss",
    "Exit Price", "PnL", "Confidence", "Timeframe",
    "Opened At", "Closed At", "Exchange", "Order ID",
  ];
  const rows = trades.map((t) => [
    t.symbol, t.base, t.side, t.mode, t.trade_type, t.status,
    t.quantity, t.entry_price, t.take_profit, t.stop_loss,
    t.exit_price ?? "", t.pnl, t.confidence, t.timeframe,
    t.opened_at, t.closed_at ?? "", t.exchange ?? "", t.external_order_id ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `signaldesk-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
