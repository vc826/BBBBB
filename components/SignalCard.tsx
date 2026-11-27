import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Target, Shield, Activity, ChevronDown, ChevronRight } from "lucide-react";
import type { Signal, Candle } from "@/lib/types";
import { CandlestickChart } from "./CandlestickChart";

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

interface Props {
  signal: Signal;
  autoTrade: boolean;
  paperMode: boolean;
  candles: Candle[];
  onExecute: (s: Signal) => void;
}

export function SignalCard({ signal, autoTrade, paperMode, candles, onExecute }: Props) {
  const [showChart, setShowChart] = useState(false);
  const sideConfig = {
    long: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: TrendingUp, label: "LONG" },
    short: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: TrendingDown, label: "SHORT" },
    neutral: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-700", icon: Minus, label: "NEUTRAL" },
  }[signal.side];

  const SideIcon = sideConfig.icon;
  const tpPct = ((signal.takeProfit - signal.entry) / signal.entry) * 100;
  const slPct = ((signal.stopLoss - signal.entry) / signal.entry) * 100;

  return (
    <div className={`rounded-2xl border ${sideConfig.border} bg-slate-900/60 p-5 transition-transform hover:scale-[1.01]`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">{signal.base}</h3>
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${sideConfig.bg} ${sideConfig.color}`}>
              {sideConfig.label}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-white">${fmtPrice(signal.price)}</p>
          <p className={`text-sm ${signal.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {signal.change24h >= 0 ? "+" : ""}{signal.change24h.toFixed(2)}% · 24h vol {fmtVol(signal.volume24h)}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Activity className="h-3.5 w-3.5" /> {signal.timeframe}
          </div>
          <p className="mt-1 text-xs text-slate-500">Confidence</p>
          <p className={`text-2xl font-bold ${sideConfig.color}`}>{signal.confidence}%</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-2">
          <p className="text-xs text-slate-500">Entry</p>
          <p className="text-sm font-semibold text-white">${fmtPrice(signal.entry)}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
          <p className="flex items-center justify-center gap-1 text-xs text-emerald-400">
            <Target className="h-3 w-3" /> Take Profit
          </p>
          <p className="text-sm font-semibold text-emerald-300">${fmtPrice(signal.takeProfit)}</p>
          <p className="text-[10px] text-emerald-500/70">{tpPct >= 0 ? "+" : ""}{tpPct.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
          <p className="flex items-center justify-center gap-1 text-xs text-red-400">
            <Shield className="h-3 w-3" /> Stop Loss
          </p>
          <p className="text-sm font-semibold text-red-300">${fmtPrice(signal.stopLoss)}</p>
          <p className="text-[10px] text-red-500/70">{slPct >= 0 ? "+" : ""}{slPct.toFixed(2)}%</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          Type: <span className="font-medium text-cyan-300">{signal.tradeType === "futures" ? "Futures" : "Spot"}</span>
        </span>
        <span className="text-slate-400">
          R/R: <span className="font-medium text-white">{signal.riskRewardRatio.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">
          Trend: <span className="font-medium text-white capitalize">{signal.indicators.trend}</span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <div className="rounded bg-slate-800/40 p-2 text-center">
          <p className="text-slate-500">RSI</p>
          <p className="font-semibold text-white">{signal.indicators.rsi.toFixed(1)}</p>
        </div>
        <div className="rounded bg-slate-800/40 p-2 text-center">
          <p className="text-slate-500">MACD</p>
          <p className="font-semibold text-white">{signal.indicators.macdHist.toFixed(4)}</p>
        </div>
        <div className="rounded bg-slate-800/40 p-2 text-center">
          <p className="text-slate-500">ATR</p>
          <p className="font-semibold text-white">{signal.indicators.atr.toFixed(2)}</p>
        </div>
        <div className="rounded bg-slate-800/40 p-2 text-center">
          <p className="text-slate-500">EMA200</p>
          <p className="font-semibold text-white">{fmtPrice(signal.indicators.ema200)}</p>
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={() => setShowChart((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/50"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            Candlestick chart with EMA & Bollinger overlays
          </span>
          {showChart ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {showChart && (
          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <CandlestickChart
              candles={candles}
              entry={signal.entry}
              takeProfit={signal.takeProfit}
              stopLoss={signal.stopLoss}
            />
          </div>
        )}
      </div>

      <details className="mt-3 text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300 hover:text-white">Why this signal</summary>
        <ul className="mt-2 space-y-1 pl-4">
          {signal.rationale.map((r, i) => (
            <li key={i} className="list-disc">{r}</li>
          ))}
        </ul>
      </details>

      <button
        onClick={() => onExecute(signal)}
        disabled={signal.side === "neutral"}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
      >
        <SideIcon className="h-4 w-4" />
        {signal.side === "neutral"
          ? "No trade signal"
          : paperMode
            ? `Paper trade ${sideConfig.label} (virtual)`
            : autoTrade
              ? `Execute ${sideConfig.label} on exchange`
              : `Execute ${sideConfig.label} (enable auto-trade for live)`}
      </button>
    </div>
  );
}
