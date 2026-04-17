/**
 * Supabase Auth Email Hook
 *
 * Intercepts ALL Supabase auth emails (signup confirmation, magic links,
 * email change, etc.) and sends them via Resend using our custom templates.
 *
 * Setup in Supabase Dashboard:
 *   Authentication → Hooks → Send Email Hook
 *   → HTTP: POST https://your-domain.com/api/auth-email-hook
 */
import type { Route } from "./+types/api.auth-email-hook";
import { sendEmail } from "~/lib/resend";
import { emailConfirmationEmail, welcomeEmail } from "~/lib/email-templates";

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
    const token: string = email_data?.token_hash || email_data?.token || "";
    const siteUrl: string = email_data?.site_url || new URL(request.url).origin;

    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }

    if (actionType === "signup" || actionType === "email_confirmation") {
      // Signup / email confirmation
      const confirmUrl = `${siteUrl}/auth/v1/verify?token=${token}&type=signup&redirect_to=${siteUrl}/login`;
      await sendEmail({
        to: email,
        subject: "Confirm your Exotic email address",
        html: emailConfirmationEmail(displayName, confirmUrl),
      });

    } else if (actionType === "recovery") {
      // Password recovery via magic link (Supabase built-in, separate from our code flow)
      const recoveryUrl = `${siteUrl}/auth/v1/verify?token=${token}&type=recovery&redirect_to=${siteUrl}/reset-password`;
      await sendEmail({
        to: email,
        subject: "Reset your Exotic password",
        html: emailConfirmationEmail(displayName, recoveryUrl),
      });

    } else if (actionType === "invite") {
      const inviteUrl = `${siteUrl}/auth/v1/verify?token=${token}&type=invite&redirect_to=${siteUrl}/register`;
      await sendEmail({
        to: email,
        subject: "You've been invited to Exotic",
        html: welcomeEmail(displayName, username, inviteUrl),
      });

    } else if (actionType === "email_change") {
      const changeUrl = `${siteUrl}/auth/v1/verify?token=${token}&type=email_change&redirect_to=${siteUrl}/settings`;
      await sendEmail({
        to: email,
        subject: "Confirm your new Exotic email address",
        html: emailConfirmationEmail(displayName, changeUrl),
      });

    } else if (actionType === "magiclink") {
      const loginUrl = `${siteUrl}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=${siteUrl}/`;
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
    // Still return 200 so Supabase doesn't retry unnecessarily
    return Response.json({});
  }
}
