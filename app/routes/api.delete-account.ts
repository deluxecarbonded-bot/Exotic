import type { Route } from "./+types/api.delete-account";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "~/lib/supabase-admin";

export async function action({ request }: Route.ActionArgs) {
  try {
    const { user_id } = await request.json();
    if (!user_id) return Response.json({ error: "Missing user_id" }, { status: 400 });

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return Response.json({ error: err.message ?? "Failed to delete account" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("delete-account error:", err);
    return Response.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
