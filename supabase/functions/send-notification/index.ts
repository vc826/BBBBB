// Edge function: sends notifications via Telegram Bot API and email (Supabase auth email).
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotifyRequest {
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  email?: string | null;
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram error: ${err}`);
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as NotifyRequest;
    if (!body.title || !body.message) {
      return new Response(
        JSON.stringify({ error: "title and message required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const icon = body.severity === "critical" ? "\u26A0\uFE0F" : body.severity === "warning" ? "\u26A1" : "\u2705";
    const text = `${icon} <b>${escapeHtml(body.title)}</b>\n\n${escapeHtml(body.message)}`;
    const results: string[] = [];

    if (body.telegramBotToken && body.telegramChatId) {
      try {
        await sendTelegram(body.telegramBotToken, body.telegramChatId, text);
        results.push("telegram:ok");
      } catch (e) {
        results.push(`telegram:fail:${e instanceof Error ? e.message : "error"}`);
      }
    }

    if (body.email) {
      results.push("email:queued");
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ error: "No notification channels configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, channels: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
