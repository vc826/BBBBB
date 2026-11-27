import { useMemo, useState } from "react";
import type { Candle } from "@/lib/types";
import { ema, bollinger } from "@/lib/indicators";

interface Props {
  candles: Candle[];
  entry?: number;
  takeProfit?: number;
  stopLoss?: number;
  height?: number;
}

export function CandlestickChart({ candles, entry, takeProfit, stopLoss, height = 200 }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 520;
  const padding = { top: 8, right: 56, bottom: 16, left: 4 };

  const view = useMemo(() => {
    const recent = candles.slice(-60);
    if (recent.length === 0) return null;

    const ema20Arr = ema(candles.map((c) => c.close), 20).slice(-60);
    const ema50Arr = ema(candles.map((c) => c.close), 50).slice(-60);
    const bb = bollinger(candles.map((c) => c.close), 20, 2);
    const bbU = bb.upper.slice(-60);
    const bbL = bb.lower.slice(-60);

    const allValues = [
      ...recent.map((c) => c.high),
      ...recent.map((c) => c.low),
      ...ema20Arr.filter((v) => !Number.isNaN(v)),
      ...ema50Arr.filter((v) => !Number.isNaN(v)),
      ...bbU.filter((v) => !Number.isNaN(v)),
      ...bbL.filter((v) => !Number.isNaN(v)),
    ];
    if (entry) allValues.push(entry);
    if (takeProfit) allValues.push(takeProfit);
    if (stopLoss) allValues.push(stopLoss);

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const pad = range * 0.08;
    const yMin = min - pad;
    const yMax = max + pad;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const candleW = chartW / recent.length;

    const y = (v: number) => padding.top + ((yMax - v) / (yMax - yMin)) * chartH;
    const x = (i: number) => padding.left + i * candleW + candleW / 2;

    const linePath = (arr: number[]) => {
      let d = "";
      let started = false;
      for (let i = 0; i < arr.length; i++) {
        if (Number.isNaN(arr[i])) continue;
        const px = x(i);
        const py = y(arr[i]);
        d += started ? ` L ${px.toFixed(1)} ${py.toFixed(1)}` : `M ${px.toFixed(1)} ${py.toFixed(1)}`;
        started = true;
      }
      return d;
    };

    const bbFillPath = (() => {
      let d = "";
      let started = false;
      for (let i = 0; i < bbU.length; i++) {
        if (Number.isNaN(bbU[i]) || Number.isNaN(bbL[i])) continue;
        const px = x(i);
        d += started ? ` L ${px.toFixed(1)} ${y(bbU[i]).toFixed(1)}` : `M ${px.toFixed(1)} ${y(bbU[i]).toFixed(1)}`;
        started = true;
      }
      for (let i = bbL.length - 1; i >= 0; i--) {
        if (Number.isNaN(bbL[i])) continue;
        d += ` L ${x(i).toFixed(1)} ${y(bbL[i]).toFixed(1)}`;
      }
      d += " Z";
      return d;
    })();

    const candlesRender = recent.map((c, i) => {
      const isUp = c.close >= c.open;
      const bodyTop = y(Math.max(c.open, c.close));
      const bodyBot = y(Math.min(c.open, c.close));
      const bodyH = Math.max(bodyBot - bodyTop, 1);
      const wickX = x(i);
      return {
        x: x(i) - candleW * 0.32,
        y: bodyTop,
        w: candleW * 0.64,
        h: bodyH,
        wickX,
        wickTop: y(c.high),
        wickBot: y(c.low),
        isUp,
      };
    });

    const priceTicks = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const v = yMin + ((yMax - yMin) * i) / tickCount;
      priceTicks.push({ value: v, y: y(v) });
    }

    return {
      candlesRender, ema20Path: linePath(ema20Arr), ema50Path: linePath(ema50Arr),
      bbFillPath, priceTicks, y, x, candleW, recent, yMin, yMax,
      entryY: entry ? y(entry) : null,
      tpY: takeProfit ? y(takeProfit) : null,
      slY: stopLoss ? y(stopLoss) : null,
    };
  }, [candles, entry, takeProfit, stopLoss, height]);

  if (!view) return <div className="text-center text-xs text-slate-500 py-8">No chart data</div>;

  const fmt = (n: number) => n >= 1000 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(5);
  const hc = hoverIdx !== null ? view.recent[hoverIdx] : null;

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.floor((px - padding.left) / view.candleW);
          if (idx >= 0 && idx < view.recent.length) setHoverIdx(idx);
        }}
      >
        {/* Bollinger Band fill */}
        <path d={view.bbFillPath} fill="rgba(34,211,238,0.06)" stroke="none" />

        {/* Price grid lines + labels */}
        {view.priceTicks.map((t, i) => (
          <g key={i}>
            <line x1={padding.left} y1={t.y} x2={width - padding.right} y2={t.y} stroke="rgb(30,41,59)" strokeWidth="0.5" />
            <text x={width - padding.right + 4} y={t.y + 3} fill="rgb(100,116,139)" fontSize="9">{fmt(t.value)}</text>
          </g>
        ))}

        {/* Candles */}
        {view.candlesRender.map((c, i) => (
          <g key={i}>
            <line x1={c.wickX} y1={c.wickTop} x2={c.wickX} y2={c.wickBot}
              stroke={c.isUp ? "rgb(52,211,153)" : "rgb(248,113,113)"} strokeWidth="1" />
            <rect x={c.x} y={c.y} width={c.w} height={c.h}
              fill={c.isUp ? "rgb(52,211,153)" : "rgb(248,113,113)"} rx="0.5" />
          </g>
        ))}

        {/* EMA lines */}
        <path d={view.ema20Path} fill="none" stroke="rgb(56,189,248)" strokeWidth="1.2" opacity="0.9" />
        <path d={view.ema50Path} fill="none" stroke="rgb(251,191,36)" strokeWidth="1.2" opacity="0.9" />

        {/* Entry / TP / SL lines */}
        {view.entryY !== null && (
          <g>
            <line x1={padding.left} y1={view.entryY} x2={width - padding.right} y2={view.entryY} stroke="rgb(56,189,248)" strokeWidth="0.8" strokeDasharray="3,2" />
            <text x={padding.left + 2} y={view.entryY - 2} fill="rgb(56,189,248)" fontSize="8">Entry</text>
          </g>
        )}
        {view.tpY !== null && (
          <g>
            <line x1={padding.left} y1={view.tpY} x2={width - padding.right} y2={view.tpY} stroke="rgb(52,211,153)" strokeWidth="0.8" strokeDasharray="3,2" />
            <text x={padding.left + 2} y={view.tpY - 2} fill="rgb(52,211,153)" fontSize="8">TP</text>
          </g>
        )}
        {view.slY !== null && (
          <g>
            <line x1={padding.left} y1={view.slY} x2={width - padding.right} y2={view.slY} stroke="rgb(248,113,113)" strokeWidth="0.8" strokeDasharray="3,2" />
            <text x={padding.left + 2} y={view.slY - 2} fill="rgb(248,113,113)" fontSize="8">SL</text>
          </g>
        )}

        {/* Hover crosshair */}
        {hoverIdx !== null && (
          <line x1={view.x(hoverIdx)} y1={padding.top} x2={view.x(hoverIdx)} y2={height - padding.bottom} stroke="rgb(71,85,105)" strokeWidth="0.5" strokeDasharray="2,2" />
        )}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-emerald-400" /> Bullish</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-red-400" /> Bearish</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-sky-400" /> EMA20</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-amber-400" /> EMA50</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-cyan-400/20 border border-cyan-400/40" /> Bollinger</span>
      </div>

      {/* Hover tooltip */}
      {hc && (
        <div className="mt-1 flex gap-3 text-[10px] text-slate-400">
          <span>O {fmt(hc.open)}</span>
          <span>H {fmt(hc.high)}</span>
          <span>L {fmt(hc.low)}</span>
          <span>C {fmt(hc.close)}</span>
        </div>
      )}
    </div>
  );
}
