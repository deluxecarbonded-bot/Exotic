import type { Route } from "./+types/api.send-reset-code";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "~/lib/supabase-admin";
import { sendEmail } from "~/lib/resend";

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
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid #f0f0f0;">
            <div style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#0a0a0a;">Exotic</div>
            <div style="font-size:14px;color:#888;margin-top:6px;">Password Reset</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
              You requested a password reset. Enter the code below to continue.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <div style="display:inline-block;background:#0a0a0a;color:#fff;font-size:36px;font-weight:700;letter-spacing:12px;padding:20px 40px;border-radius:12px;font-family:'Courier New',monospace;">
                ${code}
              </div>
            </div>
            <p style="margin:0 0 32px;font-size:13px;color:#888;text-align:center;">
              This code expires in 15 minutes.
            </p>
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
</html>`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("send-reset-code error:", err);
    return Response.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
