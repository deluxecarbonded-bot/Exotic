import type { Route } from "./+types/api.resolve-username";
import { data } from "react-router";
import { supabaseAdmin } from "~/lib/supabase-admin";

export async function action({ request }: Route.ActionArgs) {
  try {
    const { username } = await request.json();
    if (!username) return data({ error: "Username required" }, { status: 400 });

    const { data: profile, error } = await supabaseAdmin
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
