import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { flowType: "implicit" },
});

// Capture implicit-flow OAuth tokens before React Router strips the hash
const _hash = window.location.hash;
if (_hash.includes("access_token=")) {
  const p = new URLSearchParams(_hash.slice(1));
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (access_token && refresh_token) {
    supabase.auth.setSession({ access_token, refresh_token });
  }
}
