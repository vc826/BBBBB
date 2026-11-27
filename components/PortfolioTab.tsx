import { useMemo, useState } from "react";
import { Wallet, Trophy, TrendingDown, TrendingUp, X, History, Percent, Download } from "lucide-react";
import type { Trade } from "@/lib/types";
import { closeTradeAtPrice, exportTradesCsv } from "@/lib/trading";

function fmtPrice(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

interface Props {
  trades: Trade[];
  paperBalance: number;
  onTradesChanged: () => void;
  livePrices: Record<string, number>;
}

export function PortfolioTab({ trades, paperBalance, onTradesChanged, livePrices }: Props) {
  const [closing, setClosing] = useState<string | null>(null);

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.status === "closed");
    const wins = closed.filter((t) => t.pnl > 0);
    const losses = closed.filter((t) => t.pnl < 0);
    const totalPnl = closed.reduce((a, t) => a + t.pnl, 0);
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
    const open = trades.filter((t) => t.status === "open");
    const unrealized = open.reduce((a, t) => {
      const p = livePrices[t.symbol];
      if (!p) return a;
      const dir = t.side === "long" ? 1 : -1;
      return a + (p - t.entry_price) * t.quantity * dir;
    }, 0);
    return {
      closed,
      wins: wins.length,
      losses: losses.length,
      totalPnl,
      winRate,
      open,
      unrealized,
    };
  }, [trades, livePrices]);

  async function manualClose(trade: Trade) {
    const p = livePrices[trade.symbol];
    if (!p) return;
    setClosing(trade.id);
    await closeTradeAtPrice(trade, p);
    setClosing(null);
    onTradesChanged();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Wallet className="h-4 w-4" />} label="Paper Balance" value={`$${paperBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Realized P&L" value={`${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`} color={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        <Stat icon={<Percent className="h-4 w-4" />} label="Unrealized" value={`${stats.unrealized >= 0 ? "+" : ""}$${stats.unrealized.toFixed(2)}`} color={stats.unrealized >= 0 ? "text-emerald-400" : "text-red-400"} />
        <Stat icon={<Trophy className="h-4 w-4" />} label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Wins" value={String(stats.wins)} color="text-emerald-400" />
        <Stat icon={<TrendingDown className="h-4 w-4" />} label="Losses" value={String(stats.losses)} color="text-red-400" />
        <Stat icon={<History className="h-4 w-4" />} label="Open" value={String(stats.open.length)} color="text-amber-400" />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Wallet className="h-4 w-4 text-cyan-400" /> Open Positions
        </h3>
        {stats.open.length === 0 ? (
          <p className="text-sm text-slate-500">No open positions.</p>
        ) : (
          <div className="space-y-2">
            {stats.open.map((t) => {
              const p = livePrices[t.symbol];
              const dir = t.side === "long" ? 1 : -1;
              const u = p ? (p - t.entry_price) * t.quantity * dir : 0;
              return (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${t.side === "long" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      {t.side.toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{t.base} <span className="text-xs text-slate-500">{t.trade_type}</span></p>
                      <p className="text-xs text-slate-500">
                        Entry {fmtPrice(t.entry_price)} · Qty {t.quantity.toFixed(4)} · {t.mode}
                        {t.exchange ? ` · ${t.exchange}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${u >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {u >= 0 ? "+" : ""}{u.toFixed(2)}
                      </p>
                      {p && <p className="text-xs text-slate-500">@ {fmtPrice(p)}</p>}
                    </div>
                    <button
                      onClick={() => manualClose(t)}
                      disabled={closing === t.id || !p}
                      className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <History className="h-4 w-4 text-cyan-400" /> Trade History
          </h3>
          <button
            onClick={() => exportTradesCsv(trades)}
            disabled={trades.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        {stats.closed.length === 0 ? (
          <p className="text-sm text-slate-500">No closed trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-2 pr-3">Coin</th>
                  <th className="pb-2 pr-3">Side</th>
                  <th className="pb-2 pr-3">Mode</th>
                  <th className="pb-2 pr-3">Entry</th>
                  <th className="pb-2 pr-3">Exit</th>
                  <th className="pb-2 pr-3">Qty</th>
                  <th className="pb-2 pr-3">P&L</th>
                  <th className="pb-2">Closed</th>
                </tr>
              </thead>
              <tbody>
                {stats.closed.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3 font-medium text-white">{t.base}</td>
                    <td className={`py-2 pr-3 ${t.side === "long" ? "text-emerald-400" : "text-red-400"}`}>{t.side.toUpperCase()}</td>
                    <td className="py-2 pr-3 text-slate-400">{t.mode}</td>
                    <td className="py-2 pr-3 text-slate-300">{fmtPrice(t.entry_price)}</td>
                    <td className="py-2 pr-3 text-slate-300">{t.exit_price ? fmtPrice(t.exit_price) : "—"}</td>
                    <td className="py-2 pr-3 text-slate-400">{t.quantity.toFixed(4)}</td>
                    <td className={`py-2 pr-3 font-semibold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {t.closed_at ? new Date(t.closed_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color = "text-white" }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
