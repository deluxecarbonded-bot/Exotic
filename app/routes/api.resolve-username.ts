import type { Route } from "./+types/api.resolve-username";
import { data } from "react-router";
import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://jzbpmajvncwslqdrzijr.supabase.co";

export async function action({ request, context }: Route.ActionArgs) {
  try {
    const { username } = await request.json();
    if (!username) return data({ error: "Username required" }, { status: 400 });

    const env = ((context as any)?.cloudflare?.env ?? process.env) as any;
    const supabaseUrl = env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return data({ error: "Server configuration error." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error } = await admin
      .from("profiles")
      .select("email")
      .ilike("username", username.trim())
      .single();

    if (error || !profile?.email) {
      return data({ error: "No account found with that username." }, { status: 404 });
    }

    return data({ email: profile.email });
  } catch (err) {
    console.error("resolve-username error:", err);
    return data({ error: "Server error. Please try again." }, { status: 500 });
  }
}
