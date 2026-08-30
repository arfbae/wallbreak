import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Max images a signed-in user may render per rolling 24h using the SERVER key. */
export const SERVER_KEY_DAILY_LIMIT = 30;

export type Caller = { userId: string | null };

/**
 * Reads the optional Supabase bearer token off the incoming request and
 * resolves the caller. Never throws — anonymous callers return userId: null.
 */
export async function resolveCaller(): Promise<Caller> {
  try {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return { userId: null };
    const token = authHeader.slice(7).trim();
    if (!token || token.split(".").length !== 3) return { userId: null };

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { userId: null };

    const supabase = createClient<Database>(url, key, {
      global: { headers: { apikey: key, Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (error || typeof sub !== "string") return { userId: null };
    return { userId: sub };
  } catch {
    return { userId: null };
  }
}

/**
 * Rolling-24h quota check for server-key usage. Returns remaining budget.
 */
export async function checkServerKeyQuota(
  userId: string,
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("generation_usage")
    .select("images")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error("[quota] lookup failed", error.message);
    // Fail closed on the metered path.
    return { allowed: false, used: 0, remaining: 0 };
  }
  const used = (data ?? []).reduce((sum, r) => sum + (r.images ?? 0), 0);
  const remaining = Math.max(0, SERVER_KEY_DAILY_LIMIT - used);
  return { allowed: remaining > 0, used, remaining };
}

export async function recordServerKeyUsage(userId: string, images: number): Promise<void> {
  if (images <= 0) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("generation_usage").insert({ user_id: userId, images });
  } catch (err) {
    console.error("[quota] record failed", err);
  }
}
