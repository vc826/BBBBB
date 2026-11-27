// Edge function: places signed orders on Binance / Bybit private APIs.
// Binance: HMAC-SHA256 query-string signing (spot testnet + mainnet).
// Bybit: HMAC-SHA256 on JSON body + headers (V5 API).
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderRequest {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  symbol: string;
  side: "long" | "short";
  tradeType: "spot" | "futures";
  quantity: number;
  takeProfit?: number;
  stopLoss?: number;
}

async function hmacSha256Hex(key: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function roundQty(q: number): string {
  if (q >= 1) return q.toFixed(3);
  return q.toFixed(6);
}

async function placeBinanceOrder(req: OrderRequest): Promise<{ orderId: string; raw: unknown }> {
  const base = req.testnet
    ? "https://testnet.binance.vision"
    : "https://api.binance.com";
  const path = req.tradeType === "futures" ? "/fapi/v1/order" : "/api/v3/order";

  const params = new URLSearchParams();
  params.set("symbol", req.symbol);
  params.set("side", req.side === "long" ? "BUY" : "SELL");
  params.set("type", "MARKET");
  params.set("quantity", roundQty(req.quantity));
  params.set("recvWindow", "10000");
  params.set("timestamp", String(Date.now()));

  const queryString = params.toString();
  const signature = await hmacSha256Hex(req.apiSecret, queryString);
  params.set("signature", signature);

  const url = `${base}${path}?${params.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-MBX-APIKEY": req.apiKey },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Binance order failed: ${(body as { msg?: string }).msg ?? res.status}`);
  }
  return { orderId: String((body as { orderId?: number | string }).orderId ?? ""), raw: body };
}

async function placeBybitOrder(req: OrderRequest): Promise<{ orderId: string; raw: unknown }> {
  const base = req.testnet
    ? "https://api-testnet.bybit.com"
    : "https://api.bybit.com";
  const category = req.tradeType === "futures" ? "linear" : "spot";

  const body: Record<string, unknown> = {
    category,
    symbol: req.symbol,
    side: req.side === "long" ? "Buy" : "Sell",
    orderType: "Market",
    qty: String(roundQty(req.quantity)),
  };
  if (req.tradeType === "futures") {
    body.takeProfit = String(req.takeProfit ?? 0);
    body.stopLoss = String(req.stopLoss ?? 0);
    body.tpTriggerBy = "LastPrice";
    body.slTriggerBy = "LastPrice";
  }

  const ts = Date.now().toString();
  const recvWindow = "20000";
  const payload = `${ts}${req.apiKey}${recvWindow}${JSON.stringify(body)}`;
  const signature = await hmacSha256Hex(req.apiSecret, payload);

  const res = await fetch(`${base}/v5/order/create`, {
    method: "POST",
    headers: {
      "X-BAPI-API-KEY": req.apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-SIGN-TYPE": "2",
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.retCode !== 0) {
    throw new Error(`Bybit order failed: ${json.retMsg ?? res.status}`);
  }
  const orderId = String(json?.result?.orderId ?? "");
  return { orderId, raw: json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const reqBody = (await req.json()) as OrderRequest;
    if (!reqBody.apiKey || !reqBody.apiSecret || !reqBody.symbol) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result;
    if (reqBody.exchange === "binance") {
      result = await placeBinanceOrder(reqBody);
    } else if (reqBody.exchange === "bybit") {
      result = await placeBybitOrder(reqBody);
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported exchange: ${reqBody.exchange}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, orderId: result.orderId, raw: result.raw }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
