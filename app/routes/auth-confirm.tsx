import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { supabase } from "~/lib/supabase";
import { ExoticLogo, ExoticWordmark } from "~/components/logo";

export function meta() {
  return [{ title: "Verifying - Exotic" }];
}

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as any;
    const next = searchParams.get("next") || "/";

    if (!tokenHash || !type) {
      navigate("/login");
      return;
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        // On error, send to login with a message in the URL
        navigate(`/login?error=${encodeURIComponent("This link has expired or is invalid. Please try again.")}`);
      } else {
        navigate(next);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <ExoticLogo size={48} />
        <ExoticWordmark />
        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying your link…</p>
        </div>
      </div>
    </div>
  );
}
