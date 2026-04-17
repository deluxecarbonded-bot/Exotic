const RESEND_API_KEY = "re_GPogmXK9_9rcjERgkHEtcAhFJcH1Hni3n";
export const FROM_EMAIL = "Exotic <admin@devilexotic.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(err.message ?? "Failed to send email");
  }
  return res.json();
}
