import { useState } from "react";
import { Plus, Trash2, Bell, Target, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";
import type { PriceAlert } from "@/lib/types";
import { insertPriceAlert, deletePriceAlert } from "@/lib/supabaseClient";

interface Props {
  alerts: PriceAlert[];
  availableCoins: { symbol: string; base: string; price: number }[];
  onAlertsChanged: () => void;
}

export function PriceAlertPanel({ alerts, availableCoins, onAlertsChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [coinIdx, setCoinIdx] = useState(0);
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  async function add() {
    const coin = availableCoins[coinIdx];
    if (!coin || !target) return;
    await insertPriceAlert({
      symbol: coin.symbol,
      base: coin.base,
      target_price: parseFloat(target),
      direction,
    });
    setAdding(false);
    setTarget("");
    onAlertsChanged();
  }

  async function remove(id: string) {
    await deletePriceAlert(id);
    onAlertsChanged();
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Price Alerts</h2>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Get notified when a coin reaches your target price. Alerts send via your configured Telegram/email channels.
      </p>

      {adding && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <label className="block text-xs text-slate-400">
            Coin
            <select
              value={coinIdx}
              onChange={(e) => setCoinIdx(parseInt(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {availableCoins.map((c, i) => (
                <option key={c.symbol} value={i}>
                  {c.base} — ${c.price >= 1 ? c.price.toFixed(2) : c.price.toFixed(6)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Alert when price goes
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "above" | "below")}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Target price (USDT)
              <input
                type="number"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 100000"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={add}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Create alert
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
        {active.length === 0 && triggered.length === 0 && (
          <p className="text-sm text-slate-500">No price alerts set.</p>
        )}

        {active.length > 0 && (
          <div className="space-y-2">
            {active.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {a.direction === "above" ? (
                    <ArrowUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{a.base}</p>
                    <p className="text-xs text-slate-500">
                      {a.direction} ${a.target_price >= 1 ? a.target_price.toLocaleString() : a.target_price.toFixed(6)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {triggered.length > 0 && (
          <div className="space-y-2">
            <p className="pt-2 text-xs font-medium text-slate-500">Triggered</p>
            {triggered.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/20 px-4 py-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-white">{a.base}</p>
                    <p className="text-xs text-slate-500">
                      Hit {a.direction} ${a.target_price >= 1 ? a.target_price.toLocaleString() : a.target_price.toFixed(6)}
                      {a.triggered_at ? ` · ${new Date(a.triggered_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
