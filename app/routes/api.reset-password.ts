import type { Route } from "./+types/api.reset-password";

export async function action({ request, context }: Route.ActionArgs) {
  const env = ((context as any)?.cloudflare?.env ?? process.env) as any;
  const { email, token, password } = await request.json();

  if (!email || !token || !password) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  // Find user by email
  const searchRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  );
  const { users } = await searchRes.json() as any;
  const user = (users ?? []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const meta = user.app_metadata ?? {};
  const storedToken = meta.reset_token as string | undefined;
  const tokenExpires = meta.reset_token_expires as number | undefined;

  if (!storedToken || storedToken !== token) {
    return Response.json({ error: "Invalid or expired session. Please start over." }, { status: 400 });
  }

  if (!tokenExpires || Date.now() > tokenExpires) {
    return Response.json({ error: "Session expired. Please start over." }, { status: 400 });
  }

  // Update password via admin API
  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json() as any;
    return Response.json({ error: err.message ?? "Failed to update password" }, { status: 500 });
  }

  // Clear the token
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_metadata: { ...meta, reset_token: null, reset_token_expires: null },
    }),
  });

  return Response.json({ ok: true });
}
