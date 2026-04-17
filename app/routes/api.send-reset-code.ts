import type { Route } from "./+types/api.send-reset-code";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "~/lib/supabase-admin";
import { sendEmail } from "~/lib/resend";
import { passwordResetCodeEmail } from "~/lib/email-templates";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const { email } = await request.json();
    if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

    const searchRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } }
    );
    const { users } = await searchRes.json() as any;
    const user = (users ?? []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    // Always return success — don't reveal if email exists
    if (!user) return Response.json({ ok: true });

    const code = generateCode();
    const expires = Date.now() + 15 * 60 * 1000;

    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_metadata: {
          ...(user.app_metadata ?? {}),
          reset_code: code,
          reset_expires: expires,
          reset_token: null,
        },
      }),
    });

    const appUrl = new URL(request.url).origin;
    const verifyUrl = `${appUrl}/verify-reset-code?email=${encodeURIComponent(email)}`;

    await sendEmail({
      to: email,
      subject: `Your Exotic reset code: ${code}`,
      html: passwordResetCodeEmail(code, verifyUrl),
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("send-reset-code error:", err);
    return Response.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
