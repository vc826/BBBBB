// Edge function: handles real deposits and withdrawals on Binance / Bybit private APIs.
// Actions:
//   - "deposit-address": fetch a deposit address for an asset+network from the exchange
//   - "withdraw": submit a real withdrawal request to the exchange
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FundingRequest {
  action: "deposit-address" | "withdraw";
  exchange: string;
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  asset: string;
  network?: string;
  amount?: number;
  address?: string;
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

// ─── Binance ───

async function binanceDepositAddress(req: FundingRequest): Promise<{ address: string; network: string }> {
  const base = req.testnet ? "https://testnet.binance.vision" : "https://api.binance.com";
  const params = new URLSearchParams();
  params.set("coin", req.asset);
  if (req.network) params.set("network", req.network);
  params.set("recvWindow", "10000");
  params.set("timestamp", String(Date.now()));

  const qs = params.toString();
  const sig = await hmacSha256Hex(req.apiSecret, qs);
  params.set("signature", sig);

  const res = await fetch(`${base}/sapi/v1/capital/deposit/address?${params.toString()}`, {
    headers: { "X-MBX-APIKEY": req.apiKey },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Binance deposit address failed: ${(body as { msg?: string }).msg ?? res.status}`);
  }
  return { address: (body as { address: string }).address, network: (body as { network?: string }).network ?? req.network ?? "" };
}

async function binanceWithdraw(req: FundingRequest): Promise<{ id: string; raw: unknown }> {
  const base = req.testnet ? "https://testnet.binance.vision" : "https://api.binance.com";
  const params = new URLSearchParams();
  params.set("coin", req.asset);
  params.set("address", req.address ?? "");
  params.set("amount", String(req.amount ?? 0));
  if (req.network) params.set("network", req.network);
  params.set("recvWindow", "10000");
  params.set("timestamp", String(Date.now()));

  const qs = params.toString();
  const sig = await hmacSha256Hex(req.apiSecret, qs);
  params.set("signature", sig);

  const res = await fetch(`${base}/sapi/v1/capital/withdraw/submit?${params.toString()}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": req.apiKey },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Binance withdrawal failed: ${(body as { msg?: string }).msg ?? res.status}`);
  }
  return { id: String((body as { id?: string }).id ?? ""), raw: body };
}

// ─── Bybit ───

async function bybitDepositAddress(req: FundingRequest): Promise<{ address: string; network: string }> {
  const base = req.testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
  const params: Record<string, unknown> = { coin: req.asset };
  if (req.network) params.chainType = req.network;

  const ts = Date.now().toString();
  const recvWindow = "20000";
  const paramStr = JSON.stringify(params);
  const payload = `${ts}${req.apiKey}${recvWindow}${paramStr}`;
  const signature = await hmacSha256Hex(req.apiSecret, payload);

  const res = await fetch(`${base}/v5/asset/deposit/deposit-address?${new URLSearchParams({ coin: req.asset, ...(req.network ? { chainType: req.network } : {}) }).toString()}`, {
    headers: {
      "X-BAPI-API-KEY": req.apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-SIGN-TYPE": "2",
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recvWindow,
    },
  });
  const json = await res.json();
  if (!res.ok || json.retCode !== 0) {
    throw new Error(`Bybit deposit address failed: ${json.retMsg ?? res.status}`);
  }
  const chains = json?.result?.chains ?? [];
  const addr = chains.find((c: { chain: string }) => c.chain === req.network) ?? chains[0];
  return { address: addr?.addressDeposit ?? "", network: addr?.chain ?? req.network ?? "" };
}

async function bybitWithdraw(req: FundingRequest): Promise<{ id: string; raw: unknown }> {
  const base = req.testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
  const body: Record<string, unknown> = {
    coin: req.asset,
    address: req.address,
    amount: String(req.amount ?? 0),
    timestamp: Date.now(),
  };
  if (req.network) body.chain = req.network;

  const ts = Date.now().toString();
  const recvWindow = "20000";
  const payload = `${ts}${req.apiKey}${recvWindow}${JSON.stringify(body)}`;
  const signature = await hmacSha256Hex(req.apiSecret, payload);

  const res = await fetch(`${base}/v5/asset/withdraw/create`, {
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
    throw new Error(`Bybit withdrawal failed: ${json.retMsg ?? res.status}`);
  }
  return { id: String(json?.result?.id ?? ""), raw: json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const reqBody = (await req.json()) as FundingRequest;
    if (!reqBody.apiKey || !reqBody.apiSecret || !reqBody.exchange || !reqBody.asset) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result: unknown;
    if (reqBody.action === "deposit-address") {
      if (reqBody.exchange === "binance") {
        result = await binanceDepositAddress(reqBody);
      } else if (reqBody.exchange === "bybit") {
        result = await bybitDepositAddress(reqBody);
      } else {
        return new Response(
          JSON.stringify({ error: `Unsupported exchange: ${reqBody.exchange}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, action: "deposit-address", ...result as object }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (reqBody.action === "withdraw") {
      if (!reqBody.address || !reqBody.amount || reqBody.amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Withdrawal requires address and positive amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      let wd;
      if (reqBody.exchange === "binance") {
        wd = await binanceWithdraw(reqBody);
      } else if (reqBody.exchange === "bybit") {
        wd = await bybitWithdraw(reqBody);
      } else {
        return new Response(
          JSON.stringify({ error: `Unsupported exchange: ${reqBody.exchange}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Log the withdrawal to the database
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      await supabase.from("funding_transactions").insert({
        type: "withdrawal",
        asset: reqBody.asset,
        network: reqBody.network ?? null,
        amount: reqBody.amount,
        address: reqBody.address,
        exchange: reqBody.exchange,
        status: "pending",
        txid: wd.id,
      });

      return new Response(
        JSON.stringify({ success: true, action: "withdraw", id: wd.id, raw: wd.raw }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${reqBody.action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
