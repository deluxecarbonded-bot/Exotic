import type { Route } from "./+types/api.send-reset-code";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = ((context as any)?.cloudflare?.env ?? process.env) as any;
  const { email } = await request.json();

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = env.INT_RESEND_API_KEY || env.RESEND_API_KEY;

  // Find user by email via Supabase admin REST API
  const searchRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  );
  const { users } = await searchRes.json() as any;
  const user = (users ?? []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

  // Always return success — don't reveal if email exists
  if (!user) {
    return Response.json({ ok: true });
  }

  const code = generateCode();
  const expires = Date.now() + 15 * 60 * 1000; // 15 min

  // Store code in user's app_metadata
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
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

  if (!RESEND_KEY) {
    // Dev fallback: log code to console
    console.log(`[DEV] Reset code for ${email}: ${code}`);
    return Response.json({ ok: true, dev_code: code });
  }

  const appUrl = new URL(request.url).origin;
  const verifyUrl = `${appUrl}/verify-reset-code?email=${encodeURIComponent(email)}`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid #f0f0f0;">
            <div style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#0a0a0a;">Exotic</div>
            <div style="font-size:14px;color:#888;margin-top:6px;">Password Reset</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
              You requested a password reset. Enter the code below to continue.
            </p>
            <!-- Code -->
            <div style="text-align:center;margin:32px 0;">
              <div style="display:inline-block;background:#0a0a0a;color:#fff;font-size:36px;font-weight:700;letter-spacing:12px;padding:20px 40px;border-radius:12px;font-family:'Courier New',monospace;">
                ${code}
              </div>
            </div>
            <p style="margin:0 0 32px;font-size:13px;color:#888;text-align:center;">
              This code expires in 15 minutes.
            </p>
            <!-- Button -->
            <div style="text-align:center;">
              <a href="${verifyUrl}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:100px;">
                Enter Code
              </a>
            </div>
            <p style="margin:32px 0 0;font-size:12px;color:#aaa;text-align:center;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Exotic <noreply@resend.dev>",
      to: [email],
      subject: `Your Exotic reset code: ${code}`,
      html: emailHtml,
    }),
  });

  return Response.json({ ok: true });
}
