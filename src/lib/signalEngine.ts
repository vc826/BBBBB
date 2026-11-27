import type { Candle, Signal, TradeType, SignalSide } from "./types";
import { atr, bollinger, ema, last, macd, rsi } from "./indicators";
import type { Ticker24h } from "./marketData";

export function analyzeSymbol(
  symbol: string,
  base: string,
  candles: Candle[],
  ticker: Ticker24h | null,
  timeframe = "15m",
): Signal {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];

  const rsiArr = rsi(closes, 14);
  const macdRes = macd(closes);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const bb = bollinger(closes, 20, 2);
  const atrArr = atr(candles, 14);

  const rsiVal = last(rsiArr);
  const macdVal = last(macdRes.macd);
  const macdSig = last(macdRes.signal);
  const macdH = last(macdRes.hist);
  const e20 = last(ema20);
  const e50 = last(ema50);
  const e200 = last(ema200);
  const bbU = last(bb.upper);
  const bbL = last(bb.lower);
  const bbM = last(bb.middle);
  const atrVal = last(atrArr);

  let trend: "uptrend" | "downtrend" | "sideways" = "sideways";
  if (e20 > e50 && e50 > e200) trend = "uptrend";
  else if (e20 < e50 && e50 < e200) trend = "downtrend";

  const rationale: string[] = [];
  let bullScore = 0;
  let bearScore = 0;

  if (trend === "uptrend") {
    bullScore += 2;
    rationale.push("EMA 20 > 50 > 200 confirms an uptrend");
  } else if (trend === "downtrend") {
    bearScore += 2;
    rationale.push("EMA 20 < 50 < 200 confirms a downtrend");
  } else {
    rationale.push("EMAs are mixed — market is ranging");
  }

  if (rsiVal < 30) {
    bullScore += 2;
    rationale.push(`RSI ${rsiVal.toFixed(1)} is oversold — bounce likely`);
  } else if (rsiVal > 70) {
    bearScore += 2;
    rationale.push(`RSI ${rsiVal.toFixed(1)} is overbought — pullback likely`);
  } else if (rsiVal > 50) {
    bullScore += 1;
    rationale.push(`RSI ${rsiVal.toFixed(1)} favours buyers`);
  } else {
    bearScore += 1;
    rationale.push(`RSI ${rsiVal.toFixed(1)} favours sellers`);
  }

  if (macdVal > macdSig) {
    bullScore += 2;
    rationale.push("MACD above signal line — bullish momentum");
  } else {
    bearScore += 2;
    rationale.push("MACD below signal line — bearish momentum");
  }

  if (price <= bbL) {
    bullScore += 1;
    rationale.push("Price at lower Bollinger Band — statistically oversold");
  } else if (price >= bbU) {
    bearScore += 1;
    rationale.push("Price at upper Bollinger Band — statistically overbought");
  }

  let side: SignalSide = "neutral";
  if (bullScore - bearScore >= 3) side = "long";
  else if (bearScore - bullScore >= 3) side = "short";

  const tradeType: TradeType = trend === "sideways" ? "spot" : "futures";

  const confidence = Math.min(
    95,
    Math.max(10, 50 + (side === "long" ? bullScore : side === "short" ? -bearScore : 0) * 6 + Math.abs(macdH / price) * 1000),
  );

  const atrPct = atrVal / price;
  const tpMult = 2.2;
  const slMult = 1.3;

  let entry = price;
  let takeProfit = price;
  let stopLoss = price;

  if (side === "long") {
    takeProfit = price + atrVal * tpMult;
    stopLoss = price - atrVal * slMult;
  } else if (side === "short") {
    takeProfit = price - atrVal * tpMult;
    stopLoss = price + atrVal * slMult;
  } else {
    takeProfit = price + atrVal * tpMult * 0.6;
    stopLoss = price - atrVal * slMult * 0.6;
  }

  const riskRewardRatio = Math.abs(takeProfit - entry) / (Math.abs(stopLoss - entry) || 1e-9);

  const change24h = ticker?.priceChangePercent ?? 0;
  const volume24h = ticker?.quoteVolume ?? 0;

  return {
    symbol,
    base,
    price,
    change24h,
    volume24h,
    side,
    tradeType,
    confidence: Math.round(confidence),
    entry,
    takeProfit,
    stopLoss,
    riskRewardRatio,
    rationale,
    indicators: {
      rsi: rsiVal,
      macd: macdVal,
      macdSignal: macdSig,
      macdHist: macdH,
      ema20: e20,
      ema50: e50,
      ema200: e200,
      bbUpper: bbU,
      bbLower: bbL,
      bbMiddle: bbM,
      atr: atrVal,
      trend,
    },
    timeframe,
    updatedAt: Date.now(),
  };
}
