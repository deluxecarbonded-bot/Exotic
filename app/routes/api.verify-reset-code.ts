import type { Route } from "./+types/api.verify-reset-code";

export async function action({ request, context }: Route.ActionArgs) {
  const env = ((context as any)?.cloudflare?.env ?? process.env) as any;
  const { email, code } = await request.json();

  if (!email || !code) {
    return Response.json({ error: "Email and code are required" }, { status: 400 });
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
    return Response.json({ error: "Invalid code" }, { status: 400 });
  }

  const meta = user.app_metadata ?? {};
  const storedCode = meta.reset_code as string | undefined;
  const expires = meta.reset_expires as number | undefined;

  if (!storedCode || !expires) {
    return Response.json({ error: "No reset code found. Please request a new one." }, { status: 400 });
  }

  if (Date.now() > expires) {
    return Response.json({ error: "Code has expired. Please request a new one." }, { status: 400 });
  }

  if (code.toUpperCase() !== storedCode.toUpperCase()) {
    return Response.json({ error: "Incorrect code. Please try again." }, { status: 400 });
  }

  // Generate a one-time verification token
  const verifyToken = crypto.randomUUID();

  // Store it, clear the code
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_metadata: {
        ...meta,
        reset_code: null,
        reset_expires: null,
        reset_token: verifyToken,
        reset_token_expires: Date.now() + 10 * 60 * 1000, // 10 min
      },
    }),
  });

  return Response.json({ ok: true, token: verifyToken });
}
