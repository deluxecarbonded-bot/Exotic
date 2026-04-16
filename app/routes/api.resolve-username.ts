import type { Route } from "./+types/api.resolve-username";
import { data } from "react-router";
import { createClient } from "@supabase/supabase-js";

export async function action({ request, context }: Route.ActionArgs) {
  const { username } = await request.json();
  if (!username) return data({ error: "Username required" }, { status: 400 });

  const env = context.cloudflare.env as any;
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: profile, error } = await admin
    .from("profiles")
    .select("email")
    .ilike("username", username.trim())
    .single();

  if (error || !profile?.email) {
    return data({ error: "No account found with that username." }, { status: 404 });
  }

  return data({ email: profile.email });
}
