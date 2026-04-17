/**
 * Exotic Email Templates
 * All emails use consistent dark-header branding with admin@devilexotic.com
 */

const BASE_STYLES = `
  body { margin:0; padding:0; background:#f0f0f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; }
  a { color: inherit; }
`;

function layout(headerTag: string, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Exotic</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f0f0;padding:32px 0 48px;">
  <tr><td align="center">

    <!-- Card -->
    <table width="520" cellpadding="0" cellspacing="0" role="presentation"
      style="background:#ffffff;border-radius:20px;overflow:hidden;
             box-shadow:0 2px 12px rgba(0,0,0,0.10);max-width:520px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
          <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;margin-bottom:4px;">
            Exotic
          </div>
          <div style="font-size:12px;color:#888;letter-spacing:2px;text-transform:uppercase;">
            ${headerTag}
          </div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 36px;">
          ${content}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8f8f8;padding:20px 40px;border-top:1px solid #eeeeee;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
            You're receiving this email from Exotic at
            <a href="https://devilexotic.com" style="color:#888;text-decoration:underline;">devilexotic.com</a>.
            <br>Questions? Contact us at
            <a href="mailto:admin@devilexotic.com" style="color:#888;text-decoration:underline;">admin@devilexotic.com</a>
          </p>
        </td>
      </tr>

    </table>
    <!-- End Card -->

  </td></tr>
</table>
</body>
</html>`;
}

function primaryButton(label: string, url: string) {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
      <tr>
        <td style="background:#0a0a0a;border-radius:100px;padding:0;">
          <a href="${url}"
            style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;
                   color:#ffffff;text-decoration:none;letter-spacing:-0.2px;
                   border-radius:100px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function divider() {
  return `<div style="height:1px;background:#f0f0f0;margin:32px 0;"></div>`;
}

// ─── TEMPLATE 1: Password Reset Code ───────────────────────────────────────

export function passwordResetCodeEmail(code: string, verifyUrl: string) {
  const codeHtml = code.split("").map(char =>
    `<span style="display:inline-block;width:52px;height:64px;line-height:64px;text-align:center;
                  background:#f5f5f5;border:2px solid #e8e8e8;border-radius:12px;
                  font-size:32px;font-weight:800;color:#0a0a0a;
                  font-family:'Courier New',Courier,monospace;margin:0 4px;">${char}</span>`
  ).join("");

  return layout("Password Reset", `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0a0a0a;letter-spacing:-0.5px;">
      Reset your password
    </h2>
    <p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.6;">
      Enter this 4-character code on Exotic to continue resetting your password.
      The code expires in <strong>15 minutes</strong>.
    </p>

    <!-- Code blocks -->
    <div style="text-align:center;margin:0 0 28px;">
      ${codeHtml}
    </div>

    <p style="margin:0 0 28px;font-size:13px;color:#999999;text-align:center;">
      Or click the button below to go directly to the verification page.
    </p>

    <div style="text-align:center;margin-bottom:32px;">
      ${primaryButton("Enter Code →", verifyUrl)}
    </div>

    ${divider()}

    <p style="margin:0;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">
      If you didn't request a password reset, you can safely ignore this email.<br>
      Your password will not change.
    </p>
  `);
}

// ─── TEMPLATE 2: Email Confirmation / Welcome ──────────────────────────────

export function emailConfirmationEmail(displayName: string, confirmUrl: string) {
  return layout("Confirm Your Email", `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0a0a0a;letter-spacing:-0.5px;">
      Welcome to Exotic, ${displayName}!
    </h2>
    <p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.6;">
      You're almost in. Click the button below to verify your email address and
      activate your account. This link expires in <strong>24 hours</strong>.
    </p>

    <!-- Feature highlights -->
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%"
      style="background:#f8f8f8;border-radius:12px;padding:24px;margin-bottom:28px;">
      <tr>
        <td>
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0a0a0a;text-transform:uppercase;letter-spacing:1px;">
            What's waiting for you
          </p>
          <p style="margin:0 0 8px;font-size:14px;color:#555555;">💬 &nbsp;Ask and answer anonymous questions</p>
          <p style="margin:0 0 8px;font-size:14px;color:#555555;">🌎 &nbsp;Discover and connect with people</p>
          <p style="margin:0;font-size:14px;color:#555555;">📡 &nbsp;Share posts and go live</p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin-bottom:32px;">
      ${primaryButton("Confirm Email →", confirmUrl)}
    </div>

    ${divider()}

    <p style="margin:0;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">
      If you didn't create an Exotic account, you can safely ignore this email.
    </p>
  `);
}

// ─── TEMPLATE 3: Password Changed Confirmation ────────────────────────────

export function passwordChangedEmail(displayName: string, loginUrl: string) {
  return layout("Security Alert", `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0a0a0a;letter-spacing:-0.5px;">
      Your password was changed
    </h2>
    <p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.6;">
      Hi <strong>${displayName}</strong>, your Exotic account password was successfully updated.
      You can now sign in with your new password.
    </p>

    <!-- Alert box -->
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%"
      style="background:#fff8f0;border:1px solid #fde8c8;border-radius:12px;padding:20px;margin-bottom:28px;">
      <tr>
        <td>
          <p style="margin:0;font-size:14px;color:#b45309;line-height:1.6;">
            <strong>⚠️ Wasn't you?</strong> If you didn't change your password, your account may
            be compromised. Contact us immediately at
            <a href="mailto:admin@devilexotic.com" style="color:#b45309;">admin@devilexotic.com</a>.
          </p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin-bottom:32px;">
      ${primaryButton("Sign In →", loginUrl)}
    </div>

    ${divider()}

    <p style="margin:0;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">
      This is an automated security notification from Exotic.
    </p>
  `);
}

// ─── TEMPLATE 4: Welcome (post-confirmation) ─────────────────────────────

export function welcomeEmail(displayName: string, username: string, profileUrl: string) {
  return layout("Welcome to Exotic", `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0a0a0a;letter-spacing:-0.5px;">
      You're in, ${displayName}! 🎉
    </h2>
    <p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.6;">
      Your account <strong>@${username}</strong> is ready. Start connecting, asking questions,
      and sharing your thoughts with the world.
    </p>

    <!-- Username badge -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#0a0a0a;color:#ffffff;
                  font-size:18px;font-weight:800;padding:12px 32px;border-radius:100px;
                  letter-spacing:-0.3px;">
        @${username}
      </div>
    </div>

    <div style="text-align:center;margin-bottom:32px;">
      ${primaryButton("Go to your profile →", profileUrl)}
    </div>

    ${divider()}

    <p style="margin:0;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">
      Welcome to the Exotic community.
    </p>
  `);
}
