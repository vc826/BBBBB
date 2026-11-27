import type { Candle } from "./types";

const BINANCE_MIRROR = "https://data-api.binance.vision/api/v3";
const BINANCE_PRIMARY = "https://api.binance.com/api/v3";
const OKX = "https://www.okx.com/api/v5";

async function fetchWithFallback(urls: string[]): Promise<Response> {
  let lastErr: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} from ${url}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
}

export async function fetchKlines(
  symbol: string,
  interval = "15m",
  limit = 300,
): Promise<Candle[]> {
  const okxInstId = symbol.replace("USDT", "-USDT");
  const okxBar = interval.replace("m", "m");

  // Try Binance mirror, then primary, then OKX
  try {
    const res = await fetchWithFallback([
      `${BINANCE_MIRROR}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      `${BINANCE_PRIMARY}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    ]);
    const raw = (await res.json()) as unknown[][];
    return raw.map((k) => ({
      time: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));
  } catch {
    // Fallback to OKX
  }

  const okxRes = await fetchWithFallback([
    `${OKX}/market/candles?instId=${okxInstId}&bar=${okxBar}&limit=${limit}`,
  ]);
  const okxBody = (await okxRes.json()) as { code: string; data: string[][] };
  if (okxBody.code !== "0" || !okxBody.data) throw new Error(`OKX klines failed for ${symbol}`);
  return okxBody.data.reverse().map((k) => ({
    time: parseInt(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
}

export async function fetchTopTickers(): Promise<Ticker24h[]> {
  // Try Binance mirror first, then primary, then OKX
  try {
    const res = await fetchWithFallback([
      `${BINANCE_MIRROR}/ticker/24hr`,
      `${BINANCE_PRIMARY}/ticker/24hr`,
    ]);
    const raw = (await res.json()) as Record<string, string>[];
    return raw
      .filter((t) =>
        t.symbol.endsWith("USDT") &&
        !t.symbol.includes("UP") && !t.symbol.includes("DOWN") &&
        !t.symbol.includes("BULL") && !t.symbol.includes("BEAR"))
      .map((t) => ({
        symbol: t.symbol,
        lastPrice: parseFloat(t.lastPrice),
        priceChangePercent: parseFloat(t.priceChangePercent),
        quoteVolume: parseFloat(t.quoteVolume),
        highPrice: parseFloat(t.highPrice),
        lowPrice: parseFloat(t.lowPrice),
      }))
      .filter((t) => t.quoteVolume > 50_000_000)
      .sort((a, b) => b.quoteVolume - a.quoteVolume)
      .slice(0, 30);
  } catch {
    // Fallback to OKX
  }

  const okxRes = await fetchWithFallback([
    `${OKX}/market/tickers?instType=SPOT`,
  ]);
  const okxBody = (await okxRes.json()) as {
    code: string;
    data: { instId: string; last: string; open24h: string; vol24h: string; high24h: string; low24h: string }[];
  };
  if (okxBody.code !== "0" || !okxBody.data) throw new Error("OKX tickers failed");

  return okxBody.data
    .filter((t) => t.instId.endsWith("-USDT"))
    .map((t) => {
      const last = parseFloat(t.last);
      const open = parseFloat(t.open24h);
      return {
        symbol: t.instId.replace("-", ""),
        lastPrice: last,
        priceChangePercent: open > 0 ? ((last - open) / open) * 100 : 0,
        quoteVolume: parseFloat(t.vol24h) * last,
        highPrice: parseFloat(t.high24h),
        lowPrice: parseFloat(t.low24h),
      };
    })
    .filter((t) => t.quoteVolume > 50_000_000)
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, 30);
}

export const COIN_PRESETS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "TONUSDT",
];
