import type { NotificationConfig, Signal, Trade, PriceAlert } from "./types";

export interface NotifyPayload {
  telegramBotToken: string | null;
  telegramChatId: string | null;
  email: string | null;
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
}

async function callNotificationEdge(payload: NotifyPayload): Promise<boolean> {
  if (!payload.telegramBotToken && !payload.telegramChatId && !payload.email) return false;
  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`;
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function notifyNewSignal(cfg: NotificationConfig, signal: Signal): Promise<boolean> {
  if (!cfg.alertOnSignal || signal.confidence < cfg.minSignalConfidence) return Promise.resolve(false);
  return callNotificationEdge({
    telegramBotToken: cfg.telegramBotToken,
    telegramChatId: cfg.telegramChatId,
    email: cfg.email,
    title: `New ${signal.side.toUpperCase()} signal: ${signal.base}`,
    message:
      `${signal.base} @ ${signal.entry.toFixed(4)}\n` +
      `Type: ${signal.tradeType} | Confidence: ${signal.confidence}%\n` +
      `TP: ${signal.takeProfit.toFixed(4)}\nSL: ${signal.stopLoss.toFixed(4)}\n` +
      `R/R: ${signal.riskRewardRatio.toFixed(2)}`,
    severity: "info",
  });
}

export function notifyStopLossHit(cfg: NotificationConfig, trade: Trade, exitPrice: number): Promise<boolean> {
  if (!cfg.alertOnStopLoss) return Promise.resolve(false);
  return callNotificationEdge({
    telegramBotToken: cfg.telegramBotToken,
    telegramChatId: cfg.telegramChatId,
    email: cfg.email,
    title: `Stop-loss hit: ${trade.base}`,
    message:
      `Your ${trade.side.toUpperCase()} on ${trade.base} closed at ${exitPrice.toFixed(4)}.\n` +
      `P&L: ${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)} USDT\n` +
      `Mode: ${trade.mode}`,
    severity: "critical",
  });
}

export function notifyTradeExecuted(cfg: NotificationConfig, signal: Signal, mode: string, exchange?: string): Promise<boolean> {
  if (!cfg.alertOnTradeExecuted) return Promise.resolve(false);
  return callNotificationEdge({
    telegramBotToken: cfg.telegramBotToken,
    telegramChatId: cfg.telegramChatId,
    email: cfg.email,
    title: `Trade executed: ${signal.side.toUpperCase()} ${signal.base}`,
    message:
      `${mode.toUpperCase()} ${signal.side.toUpperCase()} ${signal.base}\n` +
      `Entry: ${signal.entry.toFixed(4)}\n` +
      `TP: ${signal.takeProfit.toFixed(4)} | SL: ${signal.stopLoss.toFixed(4)}\n` +
      (exchange ? `Exchange: ${exchange}\n` : "") +
      `Confidence: ${signal.confidence}%`,
    severity: "info",
  });
}

export async function sendTestNotification(cfg: NotificationConfig): Promise<boolean> {
  return callNotificationEdge({
    telegramBotToken: cfg.telegramBotToken,
    telegramChatId: cfg.telegramChatId,
    email: cfg.email,
    title: "SignalDesk test notification",
    message: "Your notifications are connected. You will receive alerts for high-confidence signals and stop-loss events.",
    severity: "info",
  });
}

export function notifyPriceAlert(cfg: NotificationConfig, alert: PriceAlert, currentPrice: number): Promise<boolean> {
  return callNotificationEdge({
    telegramBotToken: cfg.telegramBotToken,
    telegramChatId: cfg.telegramChatId,
    email: cfg.email,
    title: `Price alert: ${alert.base} reached ${alert.target_price}`,
    message:
      `${alert.base} is now ${currentPrice.toFixed(4)}\n` +
      `Alert condition: ${alert.direction} ${alert.target_price}\n` +
      `Symbol: ${alert.symbol}`,
    severity: "warning",
  });
}

export function notifyDrawdownHit(cfg: NotificationConfig, lossPct: number, limitPct: number): Promise<boolean> {
  return callNotificationEdge({
    telegramBotToken: cfg.telegramBotToken,
    telegramChatId: cfg.telegramChatId,
    email: cfg.email,
    title: "Daily drawdown limit reached — auto-trade paused",
    message:
      `Today's losses hit ${lossPct.toFixed(2)}%, exceeding your ${limitPct}% daily drawdown limit.\n` +
      `Auto-trading has been paused to protect your capital.\n` +
      `Review your positions and manually re-enable when ready.`,
    severity: "critical",
  });
}
