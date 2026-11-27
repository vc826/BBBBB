export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TradeType = "spot" | "futures";
export type SignalSide = "long" | "short" | "neutral";

export interface Signal {
  symbol: string;
  base: string;
  price: number;
  change24h: number;
  volume24h: number;
  side: SignalSide;
  tradeType: TradeType;
  confidence: number;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskRewardRatio: number;
  rationale: string[];
  indicators: {
    rsi: number;
    macd: number;
    macdSignal: number;
    macdHist: number;
    ema20: number;
    ema50: number;
    ema200: number;
    bbUpper: number;
    bbLower: number;
    bbMiddle: number;
    atr: number;
    trend: "uptrend" | "downtrend" | "sideways";
  };
  timeframe: string;
  updatedAt: number;
}

export interface ExchangeConnection {
  id: string;
  exchange: string;
  label: string;
  apiKey: string;
  apiSecret: string;
  connectedAt: number;
  testnet: boolean;
}

export interface AutoTradeConfig {
  riskPerTradePct: number;
  maxOpenPositions: number;
  preferTradeType: TradeType;
  minConfidence: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  base: string;
  target_price: number;
  direction: "above" | "below";
  triggered: boolean;
  created_at: string;
  triggered_at: string | null;
}

export interface NewPriceAlert {
  symbol: string;
  base: string;
  target_price: number;
  direction: "above" | "below";
}

export interface NotificationConfig {
  email: string | null;
  telegramChatId: string | null;
  telegramBotToken: string | null;
  alertOnSignal: boolean;
  alertOnStopLoss: boolean;
  alertOnTradeExecuted: boolean;
  minSignalConfidence: number;
}

export interface TradingSettings {
  id?: string;
  exchange_connections: ExchangeConnection[];
  auto_trade_enabled: boolean;
  auto_trade_config: AutoTradeConfig;
  paper_balance: number;
  paper_mode: boolean;
  notifications: NotificationConfig;
  max_daily_drawdown_pct: number;
  updated_at?: string;
}

export type TradeMode = "paper" | "live";
export type TradeStatus = "open" | "closed";

export interface Trade {
  id: string;
  mode: TradeMode;
  exchange: string | null;
  symbol: string;
  base: string;
  side: "long" | "short";
  trade_type: TradeType;
  status: TradeStatus;
  quantity: number;
  entry_price: number;
  take_profit: number;
  stop_loss: number;
  exit_price: number | null;
  pnl: number;
  confidence: number;
  timeframe: string;
  opened_at: string;
  closed_at: string | null;
  external_order_id: string | null;
}

export interface NewTrade {
  mode: TradeMode;
  exchange: string | null;
  symbol: string;
  base: string;
  side: "long" | "short";
  trade_type: TradeType;
  status: TradeStatus;
  quantity: number;
  entry_price: number;
  take_profit: number;
  stop_loss: number;
  exit_price?: number | null;
  pnl?: number;
  confidence: number;
  timeframe: string;
  external_order_id?: string | null;
}

export interface FundingTransaction {
  id: string;
  type: "deposit" | "withdrawal";
  asset: string;
  network: string | null;
  amount: number;
  address: string | null;
  exchange: string | null;
  status: "pending" | "completed" | "failed";
  txid: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface NewFundingTransaction {
  type: "deposit" | "withdrawal";
  asset: string;
  network?: string | null;
  amount: number;
  address?: string | null;
  exchange?: string | null;
  status: "pending" | "completed" | "failed";
  txid?: string | null;
}
