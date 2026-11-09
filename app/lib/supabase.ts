import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { observeAuthRecovery } from "./auth";

let client: SupabaseClient | null = null;

/**
 * Creates the browser Supabase client on first use.
 * Initialization is deferred so `next build` (prerendering) does not depend on
 * the public environment variables being present at module evaluation time.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont requis.",
    );
  }

  client = createBrowserClient(url, key, { auth: { skipAutoInitialize: true } });
  observeAuthRecovery(client.auth);
  void client.auth.initialize().catch(() => undefined);
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const instance = getSupabase();
    const value = Reflect.get(instance as object, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
