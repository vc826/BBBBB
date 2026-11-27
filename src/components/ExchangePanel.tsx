import { useState } from "react";
import { Plus, Trash2, Plug, Zap, ShieldAlert, FlaskConical } from "lucide-react";
import type { ExchangeConnection, TradingSettings, AutoTradeConfig } from "@/lib/types";

const EXCHANGES = [
  { id: "binance", name: "Binance", note: "Spot & Futures" },
  { id: "bybit", name: "Bybit", note: "Derivatives & Spot" },
  { id: "trust", name: "Trust Wallet", note: "On-chain / DEX" },
  { id: "okx", name: "OKX", note: "Spot & Perps" },
];

interface Props {
  settings: TradingSettings;
  onSave: (s: TradingSettings) => void;
}

export function ExchangePanel({ settings, onSave }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<ExchangeConnection, "id" | "connectedAt">>({
    exchange: "binance",
    label: "",
    apiKey: "",
    apiSecret: "",
    testnet: true,
  });

  function addConnection() {
    if (!form.apiKey || !form.apiSecret) return;
    const conn: ExchangeConnection = {
      ...form,
      id: crypto.randomUUID(),
      connectedAt: Date.now(),
    };
    onSave({
      ...settings,
      exchange_connections: [...settings.exchange_connections, conn],
    });
    setAdding(false);
    setForm({ exchange: "binance", label: "", apiKey: "", apiSecret: "", testnet: true });
  }

  function removeConnection(id: string) {
    onSave({
      ...settings,
      exchange_connections: settings.exchange_connections.filter((c) => c.id !== id),
    });
  }

  function toggleAutoTrade() {
    onSave({ ...settings, auto_trade_enabled: !settings.auto_trade_enabled });
  }

  function togglePaperMode() {
    onSave({ ...settings, paper_mode: !settings.paper_mode });
  }

  function updateBalance(v: number) {
    onSave({ ...settings, paper_balance: v });
  }

  function updateConfig(patch: Partial<AutoTradeConfig>) {
    onSave({
      ...settings,
      auto_trade_config: { ...settings.auto_trade_config, ...patch },
    });
  }

  const cfg = settings.auto_trade_config;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Paper Trading Mode</h3>
          </div>
          <button
            onClick={togglePaperMode}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              settings.paper_mode ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                settings.paper_mode ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {settings.paper_mode
            ? "Trades use virtual currency — zero financial risk. Test signals, TP and SL freely."
            : "LIVE mode: real signed orders go to connected exchanges. Real money is at risk."}
        </p>
        {settings.paper_mode && (
          <label className="mt-3 block text-xs text-slate-400">
            Virtual balance (USDT)
            <input
              type="number"
              min={100}
              step={100}
              value={settings.paper_balance}
              onChange={(e) => updateBalance(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Exchange Connections</h2>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Keys are stored locally in your connected database. Use <b>testnet</b> keys first and
          restrict API permissions to trading only (no withdrawal). Auto-trade executes real
          orders with your money — losses can still occur.
        </p>
      </div>

      {adding && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Exchange
              <select
                value={form.exchange}
                onChange={(e) => setForm({ ...form, exchange: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {EXCHANGES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} — {x.note}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Label
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="My Binance account"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <label className="block text-xs text-slate-400">
            API Key
            <input
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            API Secret
            <input
              type="password"
              value={form.apiSecret}
              onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={form.testnet}
              onChange={(e) => setForm({ ...form, testnet: e.target.checked })}
              className="h-4 w-4 accent-cyan-500"
            />
            Use testnet (recommended)
          </label>
          <div className="flex gap-2">
            <button
              onClick={addConnection}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Save connection
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {settings.exchange_connections.length === 0 && (
          <p className="text-sm text-slate-500">No exchanges connected yet.</p>
        )}
        {settings.exchange_connections.map((c) => {
          const ex = EXCHANGES.find((x) => x.id === c.exchange);
          return (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {ex?.name ?? c.exchange}
                  {c.label ? ` — ${c.label}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {c.testnet ? "Testnet" : "Live"} · key …{c.apiKey.slice(-4)}
                </p>
              </div>
              <button
                onClick={() => removeConnection(c.id)}
                className="text-slate-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Auto-Trade Engine</h3>
          </div>
          <button
            onClick={toggleAutoTrade}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              settings.auto_trade_enabled ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                settings.auto_trade_enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          When enabled, the engine places orders on connected exchanges for signals above your
          confidence threshold. This uses real funds — start on testnet.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">
            Risk per trade (%)
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={cfg.riskPerTradePct}
              onChange={(e) => updateConfig({ riskPerTradePct: parseFloat(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Max open positions
            <input
              type="number"
              min={1}
              max={20}
              value={cfg.maxOpenPositions}
              onChange={(e) => updateConfig({ maxOpenPositions: parseInt(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Preferred type
            <select
              value={cfg.preferTradeType}
              onChange={(e) => updateConfig({ preferTradeType: e.target.value as "spot" | "futures" })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="spot">Spot</option>
              <option value="futures">Futures (leverage)</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Min confidence (%)
            <input
              type="number"
              min={50}
              max={95}
              value={cfg.minConfidence}
              onChange={(e) => updateConfig({ minConfidence: parseInt(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <label className="block text-xs text-slate-400">
            Max daily drawdown (%) — auto-trading pauses if exceeded
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={settings.max_daily_drawdown_pct}
              onChange={(e) => onSave({ ...settings, max_daily_drawdown_pct: parseFloat(e.target.value) || 5 })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <p className="mt-1.5 text-[11px] text-amber-300/70">
            When today's closed-trade losses exceed this percentage of your balance, auto-trading
            is automatically paused and you get a notification.
          </p>
        </div>
      </div>
    </div>
  );
}
