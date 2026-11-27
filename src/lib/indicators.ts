import type { Candle } from "./types";

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(values[0]);
      continue;
    }
    const v = values[i] * k + prev * (1 - k);
    out.push(v);
    prev = v;
  }
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length <= period) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-9));
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-9));
  }
  return out;
}

export interface MacdResult {
  macd: number[];
  signal: number[];
  hist: number[];
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const hist = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, hist };
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollinger(values: number[], period = 20, stdDev = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: number[] = new Array(values.length).fill(NaN);
  const lower: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = middle[i] + stdDev * sd;
    lower[i] = middle[i] - stdDev * sd;
  }
  return { upper, middle, lower };
}

export function atr(candles: Candle[], period = 14): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
      continue;
    }
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const out: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function last(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!Number.isNaN(arr[i])) return arr[i];
  }
  return NaN;
}
