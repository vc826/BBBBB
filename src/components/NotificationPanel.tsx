import { useState } from "react";
import { Bell, Send, Mail, MessageSquare, TestTube } from "lucide-react";
import type { NotificationConfig, TradingSettings } from "@/lib/types";
import { sendTestNotification } from "@/lib/notifications";

interface Props {
  settings: TradingSettings;
  onSave: (s: TradingSettings) => void;
}

export function NotificationPanel({ settings, onSave }: Props) {
  const cfg = settings.notifications;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function update(patch: Partial<NotificationConfig>) {
    onSave({ ...settings, notifications: { ...cfg, ...patch } });
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    const ok = await sendTestNotification(cfg);
    setTesting(false);
    setTestResult(ok ? "Notification sent — check Telegram/email." : "Failed to send. Check your bot token and chat ID.");
    setTimeout(() => setTestResult(null), 5000);
  }

  const hasChannel = !!cfg.telegramChatId || !!cfg.email;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-white">Notifications</h2>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Get alerted when high-confidence signals appear or stop-losses trigger. Telegram is instant; email is queued.
      </p>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <MessageSquare className="h-4 w-4 text-cyan-400" /> Telegram
          </div>
          <label className="block text-xs text-slate-400">
            Bot Token
            <input
              value={cfg.telegramBotToken ?? ""}
              onChange={(e) => update({ telegramBotToken: e.target.value || null })}
              placeholder="123456:ABC-DEF..."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="mt-3 block text-xs text-slate-400">
            Chat ID
            <input
              value={cfg.telegramChatId ?? ""}
              onChange={(e) => update({ telegramChatId: e.target.value || null })}
              placeholder="e.g. 123456789"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <p className="mt-2 text-[11px] text-slate-500">
            Create a bot with @BotFather, then message it and visit https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates to find your chat ID.
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <Mail className="h-4 w-4 text-cyan-400" /> Email
          </div>
          <label className="block text-xs text-slate-400">
            Email address
            <input
              type="email"
              value={cfg.email ?? ""}
              onChange={(e) => update({ email: e.target.value || null })}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="space-y-2">
          <Toggle
            label="Alert on new high-confidence signal"
            checked={cfg.alertOnSignal}
            onChange={(v) => update({ alertOnSignal: v })}
          />
          <Toggle
            label="Alert when stop-loss is hit"
            checked={cfg.alertOnStopLoss}
            onChange={(v) => update({ alertOnStopLoss: v })}
          />
          <Toggle
            label="Alert when a trade is executed"
            checked={cfg.alertOnTradeExecuted}
            onChange={(v) => update({ alertOnTradeExecuted: v })}
          />
        </div>

        <label className="block text-xs text-slate-400">
          Minimum signal confidence to alert (%)
          <input
            type="number"
            min={50}
            max={95}
            value={cfg.minSignalConfidence}
            onChange={(e) => update({ minSignalConfidence: parseInt(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>

        <button
          onClick={test}
          disabled={testing || !hasChannel}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {testing ? <TestTube className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          {testing ? "Sending…" : "Send test notification"}
        </button>
        {testResult && (
          <p className="text-center text-xs text-cyan-300">{testResult}</p>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-2.5">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-700"}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}
