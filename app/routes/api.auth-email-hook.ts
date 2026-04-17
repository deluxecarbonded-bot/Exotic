/**
 * Supabase Auth Email Hook
 *
 * Intercepts ALL Supabase auth emails and sends via Resend with custom templates.
 * All links point to https://devilexotic.com — never to Supabase.
 *
 * Setup in Supabase Dashboard:
 *   Authentication → Hooks → Send Email Hook
 *   → HTTP: POST https://devilexotic.com/api/auth-email-hook
 */
import type { Route } from "./+types/api.auth-email-hook";
import { sendEmail } from "~/lib/resend";
import { emailConfirmationEmail, welcomeEmail } from "~/lib/email-templates";

const SITE_URL = "https://devilexotic.com";

export async function action({ request }: Route.ActionArgs) {
  try {
    const body = await request.json() as any;
    const { user, email_data } = body;

    const email = user?.email;
    const displayName = user?.user_metadata?.display_name
      || user?.user_metadata?.username
      || email?.split("@")[0]
      || "there";
    const username = user?.user_metadata?.username || email?.split("@")[0] || "";
    const actionType: string = email_data?.email_action_type ?? "";
    // Use token_hash for PKCE flow (processed on our site, not Supabase's)
    const tokenHash: string = email_data?.token_hash || email_data?.token || "";

    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }

    if (actionType === "signup" || actionType === "email_confirmation") {
      const confirmUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=signup&next=/login`;
      await sendEmail({
        to: email,
        subject: "Confirm your Exotic email address",
        html: emailConfirmationEmail(displayName, confirmUrl),
      });

    } else if (actionType === "recovery") {
      const recoveryUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password`;
      await sendEmail({
        to: email,
        subject: "Reset your Exotic password",
        html: emailConfirmationEmail(displayName, recoveryUrl),
      });

    } else if (actionType === "invite") {
      const inviteUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=invite&next=/register`;
      await sendEmail({
        to: email,
        subject: "You've been invited to Exotic",
        html: welcomeEmail(displayName, username, inviteUrl),
      });

    } else if (actionType === "email_change") {
      const changeUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=email_change&next=/settings`;
      await sendEmail({
        to: email,
        subject: "Confirm your new Exotic email address",
        html: emailConfirmationEmail(displayName, changeUrl),
      });

    } else if (actionType === "magiclink") {
      const loginUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/`;
      await sendEmail({
        to: email,
        subject: "Your Exotic sign-in link",
        html: emailConfirmationEmail(displayName, loginUrl),
      });
    }

    // Return empty object — Supabase expects {} on success
    return Response.json({});
  } catch (err) {
    console.error("auth-email-hook error:", err);
    return Response.json({});
  }
}
