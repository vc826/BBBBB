import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, TrendingUp, AlertTriangle, Activity, Sparkles, LineChart, Bell, Settings as SettingsIcon, PauseCircle, Wallet } from "lucide-react";
import type { Signal, TradingSettings, Trade, PriceAlert, Candle, FundingTransaction } from "@/lib/types";
import { fetchKlines, fetchTopTickers, type Ticker24h } from "@/lib/marketData";
import { analyzeSymbol } from "@/lib/signalEngine";
import { loadSettings, saveSettings, loadTrades, loadPriceAlerts, markPriceAlertTriggered, loadFundingTransactions } from "@/lib/supabaseClient";
import { placeLiveOrder, placePaperOrder, checkOpenTradesAgainstPrices, getDailyDrawdownPct } from "@/lib/trading";
import { notifyNewSignal, notifyStopLossHit, notifyTradeExecuted, notifyPriceAlert, notifyDrawdownHit } from "@/lib/notifications";
import { SignalCard } from "@/components/SignalCard";
import { ExchangePanel } from "@/components/ExchangePanel";
import { PortfolioTab } from "@/components/PortfolioTab";
import { NotificationPanel } from "@/components/NotificationPanel";
import { PriceAlertPanel } from "@/components/PriceAlertPanel";
import { FundingPanel } from "@/components/FundingPanel";

const DEFAULT_SETTINGS: TradingSettings = {
  exchange_connections: [],
  auto_trade_enabled: false,
  auto_trade_config: {
    riskPerTradePct: 1,
    maxOpenPositions: 3,
    preferTradeType: "spot",
    minConfidence: 70,
  },
  paper_balance: 10000,
  paper_mode: true,
  notifications: {
    email: null,
    telegramChatId: null,
    telegramBotToken: null,
    alertOnSignal: false,
    alertOnStopLoss: false,
    alertOnTradeExecuted: false,
    minSignalConfidence: 75,
  },
  max_daily_drawdown_pct: 5,
};

const TIMEFRAMES = ["5m", "15m", "1h", "4h"];
type Tab = "signals" | "portfolio" | "funding" | "settings";

interface SignalWithCandles extends Signal {
  candles: Candle[];
}

export default function App() {
  const [tickers, setTickers] = useState<Ticker24h[]>([]);
  const [signals, setSignals] = useState<SignalWithCandles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("15m");
  const [settings, setSettings] = useState<TradingSettings>(DEFAULT_SETTINGS);
  const [filter, setFilter] = useState<"all" | "long" | "short">("all");
  const [executed, setExecuted] = useState<Record<string, string>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [fundingTxns, setFundingTxns] = useState<FundingTransaction[]>([]);
  const [tab, setTab] = useState<Tab>("signals");
  const [autoExecuting, setAutoExecuting] = useState(false);
  const [drawdownPaused, setDrawdownPaused] = useState(false);
  const notifiedSignals = useRef<Set<string>>(new Set());
  const notifiedAlerts = useRef<Set<string>>(new Set());
  const drawdownNotified = useRef<boolean>(false);

  useEffect(() => {
    loadSettings().then((s) => {
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
    });
    loadTrades().then(setTrades);
    loadPriceAlerts().then(setAlerts);
    loadFundingTransactions().then(setFundingTxns);
  }, []);

  const handleSave = useCallback((s: TradingSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const refreshTrades = useCallback(() => {
    loadTrades().then(setTrades);
  }, []);

  const refreshAlerts = useCallback(() => {
    loadPriceAlerts().then(setAlerts);
  }, []);

  const refreshFunding = useCallback(() => {
    loadFundingTransactions().then(setFundingTxns);
  }, []);

  const livePrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of signals) map[s.symbol] = s.price;
    for (const t of tickers) map[t.symbol] = t.lastPrice;
    return map;
  }, [signals, tickers]);

  const availableCoins = useMemo(
    () => signals.map((s) => ({ symbol: s.symbol, base: s.base, price: s.price })),
    [signals],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const top = await fetchTopTickers();
      setTickers(top);
      const top10 = top.slice(0, 10);
      const results: SignalWithCandles[] = [];
      for (const t of top10) {
        try {
          const candles = await fetchKlines(t.symbol, timeframe, 300);
          const base = t.symbol.replace("USDT", "");
          results.push({ ...analyzeSymbol(t.symbol, base, candles, t, timeframe), candles });
        } catch {
          // skip failing symbol
        }
      }
      results.sort((a, b) => b.confidence - a.confidence);
      setSignals(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load market data");
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [refresh]);

  // Check open trades against live prices for TP/SL hits
  useEffect(() => {
    if (signals.length === 0 || trades.length === 0) return;
    const openTrades = trades.filter((t) => t.status === "open");
    if (openTrades.length === 0) return;
    checkOpenTradesAgainstPrices(openTrades, livePrices).then((closed) => {
      if (closed.length > 0) {
        refreshTrades();
        for (const ct of closed) {
          notifyStopLossHit(settings.notifications, ct, ct.stop_loss);
        }
      }
    });
  }, [signals, trades, livePrices, settings.notifications, refreshTrades]);

  // Check price alerts against live prices
  useEffect(() => {
    const active = alerts.filter((a) => !a.triggered);
    if (active.length === 0 || signals.length === 0) return;
    for (const alert of active) {
      const price = livePrices[alert.symbol];
      if (!price) continue;
      const hit = alert.direction === "above" ? price >= alert.target_price : price <= alert.target_price;
      if (hit && !notifiedAlerts.current.has(alert.id)) {
        notifiedAlerts.current.add(alert.id);
        markPriceAlertTriggered(alert.id);
        notifyPriceAlert(settings.notifications, alert, price);
        refreshAlerts();
      }
    }
  }, [signals, alerts, livePrices, settings.notifications, refreshAlerts]);

  // Send notifications for new high-confidence signals
  useEffect(() => {
    for (const s of signals) {
      if (s.side === "neutral") continue;
      const key = `${s.symbol}-${s.updatedAt}`;
      if (notifiedSignals.current.has(key)) continue;
      if (s.confidence >= settings.notifications.minSignalConfidence) {
        notifiedSignals.current.add(key);
        if (settings.notifications.alertOnSignal) {
          notifyNewSignal(settings.notifications, s);
        }
      }
    }
  }, [signals, settings.notifications]);

  // Daily drawdown check — pause auto-trading if exceeded
  const dailyDrawdownPct = useMemo(
    () => getDailyDrawdownPct(trades, settings.paper_balance),
    [trades, settings.paper_balance],
  );

  useEffect(() => {
    if (dailyDrawdownPct >= settings.max_daily_drawdown_pct && !drawdownNotified.current) {
      drawdownNotified.current = true;
      setDrawdownPaused(true);
      if (settings.auto_trade_enabled) {
        handleSave({ ...settings, auto_trade_enabled: false });
      }
      notifyDrawdownHit(settings.notifications, dailyDrawdownPct, settings.max_daily_drawdown_pct);
    }
    // Reset at start of new day
    if (dailyDrawdownPct < settings.max_daily_drawdown_pct) {
      drawdownNotified.current = false;
    }
  }, [dailyDrawdownPct, settings.max_daily_drawdown_pct, settings, handleSave]);

  const bestPick = useMemo(() => {
    const actionable = signals.filter((s) => s.side !== "neutral");
    return actionable[0] ?? null;
  }, [signals]);

  const filtered = useMemo(() => {
    if (filter === "all") return signals;
    return signals.filter((s) => s.side === filter);
  }, [signals, filter]);

  const stats = useMemo(() => {
    const longs = signals.filter((s) => s.side === "long").length;
    const shorts = signals.filter((s) => s.side === "short").length;
    const avgConf = signals.length
      ? Math.round(signals.reduce((a, s) => a + s.confidence, 0) / signals.length)
      : 0;
    return { longs, shorts, avgConf };
  }, [signals]);

  async function executeSignal(s: Signal) {
    if (s.side === "neutral") return;
    if (drawdownPaused) {
      setExecuted((p) => ({ ...p, [s.symbol]: "Auto-trading paused due to daily drawdown limit. Resume manually." }));
      return;
    }
    setExecuted((p) => ({ ...p, [s.symbol]: "Placing order…" }));

    let result;
    if (settings.paper_mode) {
      result = await placePaperOrder(s, settings);
    } else {
      if (!settings.auto_trade_enabled) {
        setExecuted((p) => ({ ...p, [s.symbol]: "Enable auto-trade to place live orders." }));
        return;
      }
      const conn = settings.exchange_connections.find(
        (c) => c.exchange === "binance" || c.exchange === "bybit",
      );
      if (!conn) {
        setExecuted((p) => ({ ...p, [s.symbol]: "No Binance/Bybit connection for live orders." }));
        return;
      }
      result = await placeLiveOrder(s, settings, conn);
    }

    if (result.success) {
      const mode = settings.paper_mode ? "paper" : "live";
      setExecuted((p) => ({
        ...p,
        [s.symbol]: `${mode.toUpperCase()} ${s.side.toUpperCase()} ${s.base} placed. Entry ${s.entry.toFixed(4)} | TP ${s.takeProfit.toFixed(4)} | SL ${s.stopLoss.toFixed(4)}`,
      }));
      notifyTradeExecuted(settings.notifications, s, mode);
      refreshTrades();
    } else {
      setExecuted((p) => ({ ...p, [s.symbol]: `Failed: ${result.error}` }));
    }
  }

  // Auto-execute
  useEffect(() => {
    if (autoExecuting) return;
    if (signals.length === 0) return;
    if (drawdownPaused) return;
    const minConf = settings.auto_trade_config.minConfidence;
    const openCount = trades.filter((t) => t.status === "open").length;
    const maxOpen = settings.auto_trade_config.maxOpenPositions;
    if (openCount >= maxOpen) return;

    const candidate = signals.find(
      (s) => s.side !== "neutral" && s.confidence >= minConf,
    );
    if (!candidate) return;
    const key = `auto-${candidate.symbol}-${candidate.updatedAt}`;
    if (notifiedSignals.current.has(key)) return;
    notifiedSignals.current.add(key);

    if (settings.paper_mode || settings.auto_trade_enabled) {
      setAutoExecuting(true);
      executeSignal(candidate).finally(() => setAutoExecuting(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, trades, settings.paper_mode, settings.auto_trade_enabled, settings.auto_trade_config, drawdownPaused]);

  function resumeAfterDrawdown() {
    setDrawdownPaused(false);
    drawdownNotified.current = false;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "signals", label: "Signals", icon: <LineChart className="h-4 w-4" /> },
    { id: "portfolio", label: "Portfolio", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "funding", label: "Funding", icon: <Wallet className="h-4 w-4" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500">
              <TrendingUp className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">SignalDesk</h1>
              <p className="text-xs text-slate-500">
                {settings.paper_mode ? "Paper trading (virtual)" : "Live trading (real funds)"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {TIMEFRAMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Scanning…" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.icon}
              {t.label}
              {t.id === "settings" && settings.notifications.alertOnSignal && (
                <Bell className="h-3 w-3 text-cyan-400" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200/90">
            <b>Risk disclaimer:</b> No system can guarantee profit or zero losses — crypto is
            volatile. Paper mode is risk-free. Live mode sends real signed orders to exchanges
            using your API keys. Use stop-losses, start on testnet, and never trade money you
            can't afford to lose.
          </p>
        </div>

        {drawdownPaused && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <div className="flex items-center gap-3">
              <PauseCircle className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-300">
                  Auto-trading paused — daily drawdown limit of {settings.max_daily_drawdown_pct}% reached
                </p>
                <p className="text-xs text-red-400/70">
                  Today's losses: {dailyDrawdownPct.toFixed(2)}% of balance. Review your positions before resuming.
                </p>
              </div>
            </div>
            <button
              onClick={resumeAfterDrawdown}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30"
            >
              Resume trading
            </button>
          </div>
        )}

        {tab === "signals" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Top Coins" value={String(tickers.length)} icon={<Activity className="h-4 w-4" />} />
                <StatCard label="Long Signals" value={String(stats.longs)} color="text-emerald-400" />
                <StatCard label="Short Signals" value={String(stats.shorts)} color="text-red-400" />
                <StatCard label="Avg Confidence" value={`${stats.avgConf}%`} color="text-cyan-400" />
              </div>

              {bestPick && (
                <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-slate-900/40 p-5">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-semibold uppercase tracking-wide">Best opportunity right now</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <h2 className="text-2xl font-bold text-white">{bestPick.base}</h2>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                      bestPick.side === "long" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {bestPick.side.toUpperCase()}
                    </span>
                    <span className="text-sm text-slate-300">
                      {bestPick.tradeType === "futures" ? "Futures" : "Spot"} · {bestPick.confidence}% confidence
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span className="text-slate-400">Entry <b className="text-white">{bestPick.entry.toFixed(4)}</b></span>
                    <span className="text-emerald-400">TP <b>{bestPick.takeProfit.toFixed(4)}</b></span>
                    <span className="text-red-400">SL <b>{bestPick.stopLoss.toFixed(4)}</b></span>
                    <span className="text-slate-400">R/R <b className="text-white">{bestPick.riskRewardRatio.toFixed(2)}</b></span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {(["all", "long", "short"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
                      filter === f ? "bg-cyan-500 text-slate-950" : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {loading && signals.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-slate-500">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading live market data…
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((s) => (
                    <div key={s.symbol}>
                      <SignalCard
                        signal={s}
                        candles={s.candles}
                        autoTrade={settings.auto_trade_enabled}
                        paperMode={settings.paper_mode}
                        onExecute={executeSignal}
                      />
                      {executed[s.symbol] && (
                        <p className="mt-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-cyan-300">
                          {executed[s.symbol]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <ExchangePanel settings={settings} onSave={handleSave} />
              <PriceAlertPanel alerts={alerts} availableCoins={availableCoins} onAlertsChanged={refreshAlerts} />
            </div>
          </div>
        )}

        {tab === "portfolio" && (
          <PortfolioTab
            trades={trades}
            paperBalance={settings.paper_balance}
            onTradesChanged={refreshTrades}
            livePrices={livePrices}
          />
        )}

        {tab === "funding" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <FundingPanel
              connections={settings.exchange_connections}
              transactions={fundingTxns}
              onTransactionsChanged={refreshFunding}
            />
            <div className="space-y-4">
              <ExchangePanel settings={settings} onSave={handleSave} />
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ExchangePanel settings={settings} onSave={handleSave} />
            <div className="space-y-4">
              <NotificationPanel settings={settings} onSave={handleSave} />
              <PriceAlertPanel alerts={alerts} availableCoins={availableCoins} onAlertsChanged={refreshAlerts} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color = "text-white", icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
