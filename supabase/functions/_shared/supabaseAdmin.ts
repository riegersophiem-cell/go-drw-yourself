import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

// Edge Functions run with the service role key, which bypasses RLS — this is
// intentional and required: this is the ONLY code path allowed to read/write
// `game_states` (the table holding every player's real hand).
export function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

export function errorResponse(code: string, message: string, status = 400) {
  return jsonResponse({ error: { code, message } }, status);
}
