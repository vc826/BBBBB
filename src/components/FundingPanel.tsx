import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Copy, AlertTriangle, Loader2, History, Wallet } from "lucide-react";
import type { ExchangeConnection, FundingTransaction } from "@/lib/types";
import { fetchDepositAddress, submitWithdrawal, insertFundingTransaction } from "@/lib/supabaseClient";

interface Props {
  connections: ExchangeConnection[];
  transactions: FundingTransaction[];
  onTransactionsChanged: () => void;
}

const ASSETS = ["USDT", "BTC", "ETH", "SOL", "BNB", "XRP"];
const NETWORKS: Record<string, string[]> = {
  USDT: ["ERC20", "TRC20", "BEP20", "SOL"],
  BTC: ["BTC", "BEP20"],
  ETH: ["ERC20", "BEP20"],
  SOL: ["SOL", "BEP20"],
  BNB: ["BEP20", "ERC20"],
  XRP: ["XRP"],
};

export function FundingPanel({ connections, transactions, onTransactionsChanged }: Props) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [connIdx, setConnIdx] = useState(0);
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [amount, setAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [depositAddr, setDepositAddr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const tradeableConns = connections.filter((c) => c.exchange === "binance" || c.exchange === "bybit");

  async function getDepositAddress() {
    if (tradeableConns.length === 0) {
      setMsg({ type: "error", text: "Connect a Binance or Bybit account first." });
      return;
    }
    setLoading(true);
    setMsg(null);
    setDepositAddr(null);
    const conn = tradeableConns[connIdx] ?? tradeableConns[0];
    const result = await fetchDepositAddress(conn.exchange, conn.apiKey, conn.apiSecret, conn.testnet, asset, network);
    setLoading(false);
    if ("error" in result) {
      setMsg({ type: "error", text: result.error });
    } else {
      setDepositAddr(result.address);
      await insertFundingTransaction({
        type: "deposit",
        asset,
        network,
        amount: 0,
        address: result.address,
        exchange: conn.exchange,
        status: "pending",
      });
      onTransactionsChanged();
    }
  }

  async function doWithdraw() {
    if (tradeableConns.length === 0) {
      setMsg({ type: "error", text: "Connect a Binance or Bybit account first." });
      return;
    }
    if (!withdrawAddress || !amount) {
      setMsg({ type: "error", text: "Enter a destination address and amount." });
      return;
    }
    const amt = parseFloat(amount);
    if (amt <= 0) {
      setMsg({ type: "error", text: "Amount must be positive." });
      return;
    }

    if (!confirm(
      `Confirm withdrawal of ${amt} ${asset} via ${network} to:\n${withdrawAddress}\n\n` +
      `This sends REAL funds from your ${tradeableConns[connIdx]?.exchange ?? ""} account. Proceed?`
    )) return;

    setLoading(true);
    setMsg(null);
    const conn = tradeableConns[connIdx] ?? tradeableConns[0];
    const result = await submitWithdrawal(
      conn.exchange, conn.apiKey, conn.apiSecret, conn.testnet,
      asset, network, amt, withdrawAddress,
    );
    setLoading(false);
    if (result.success) {
      setMsg({ type: "success", text: `Withdrawal submitted. ID: ${result.id}` });
      setAmount("");
      setWithdrawAddress("");
      await insertFundingTransaction({
        type: "withdrawal",
        asset,
        network,
        amount: amt,
        address: withdrawAddress,
        exchange: conn.exchange,
        status: "pending",
        txid: result.id,
      });
      onTransactionsChanged();
    } else {
      setMsg({ type: "error", text: result.error ?? "Withdrawal failed." });
    }
  }

  function copyAddress() {
    if (!depositAddr) return;
    navigator.clipboard.writeText(depositAddr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-white">Funding — Deposits & Withdrawals</h2>
      </div>

      <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-xs text-red-300/90">
            <b>Real funds:</b> Deposits and withdrawals move actual cryptocurrency on the blockchain
            through your linked exchange account. Triple-check addresses and networks — wrong
            networks cause permanent loss. Start with testnet and small amounts.
          </p>
        </div>
      </div>

      {tradeableConns.length === 0 ? (
        <p className="text-sm text-slate-500">
          No Binance or Bybit account connected. Add one in Exchange Connections to enable funding.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("deposit"); setMsg(null); setDepositAddr(null); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "deposit" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "border border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <ArrowDownToLine className="h-4 w-4" /> Deposit
            </button>
            <button
              onClick={() => { setMode("withdraw"); setMsg(null); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "withdraw" ? "bg-red-500/15 text-red-300 border border-red-500/30" : "border border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <ArrowUpFromLine className="h-4 w-4" /> Withdraw
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-xs text-slate-400">
              Exchange account
              <select
                value={connIdx}
                onChange={(e) => setConnIdx(parseInt(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {tradeableConns.map((c, i) => (
                  <option key={c.id} value={i}>
                    {c.exchange.toUpperCase()} {c.testnet ? "(Testnet)" : "(Live)"}{c.label ? ` — ${c.label}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Asset
                <select
                  value={asset}
                  onChange={(e) => { setAsset(e.target.value); setNetwork(NETWORKS[e.target.value]?.[0] ?? ""); setDepositAddr(null); }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Network
                <select
                  value={network}
                  onChange={(e) => { setNetwork(e.target.value); setDepositAddr(null); }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {(NETWORKS[asset] ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>

            {mode === "deposit" ? (
              <div>
                <button
                  onClick={getDepositAddress}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                  Get deposit address
                </button>

                {depositAddr && (
                  <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-xs text-emerald-400">Your {asset} deposit address ({network})</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-slate-950/60 px-2 py-1.5 text-xs text-white">
                        {depositAddr}
                      </code>
                      <button
                        onClick={copyAddress}
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                      >
                        {copied ? <Copy className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Send only {asset} via the {network} network to this address. Sending other assets or networks will result in permanent loss.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs text-slate-400">
                  Destination address
                  <input
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder={`Enter ${asset} ${network} address`}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Amount ({asset})
                  <input
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  onClick={doWithdraw}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />}
                  Withdraw {asset}
                </button>
              </div>
            )}

            {msg && (
              <div className={`rounded-lg p-3 text-sm ${msg.type === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                {msg.text}
              </div>
            )}
          </div>
        </>
      )}

      {transactions.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400">
            <History className="h-3.5 w-3.5" /> Funding History
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {transactions.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-800/30 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 font-bold ${
                    t.type === "deposit" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {t.type === "deposit" ? "IN" : "OUT"}
                  </span>
                  <span className="text-white">{t.amount > 0 ? t.amount : "—"} {t.asset}</span>
                  <span className="text-slate-500">{t.network ?? ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 ${
                    t.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                    t.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>{t.status}</span>
                  <span className="text-slate-500">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
