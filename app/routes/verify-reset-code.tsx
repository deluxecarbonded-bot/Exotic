import type { Route } from "./+types/verify-reset-code";
import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { ExoticLogo, ExoticWordmark } from "~/components/logo";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Verify Code - Exotic" }];
}

export default function VerifyResetCode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => { refs[0].current?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    // Support paste of full code
    if (value.length > 1) {
      const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).split("");
      const next = ["", "", "", ""];
      chars.forEach((c, i) => { if (i < 4) next[i] = c; });
      setDigits(next);
      const lastFilled = Math.min(chars.length, 3);
      refs[lastFilled].current?.focus();
      return;
    }

    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");

    if (char && index < 3) {
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        refs[index - 1].current?.focus();
      }
    }
  };

  const handleNext = async () => {
    const code = digits.join("");
    if (code.length < 4) { setError("Enter the full 4-character code"); return; }
    if (!email) { setError("Missing email. Please start over."); return; }

    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json() as any;
      if (!res.ok || data.error) {
        setError(data.error ?? "Verification failed");
        return;
      }
      navigate(
        `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(data.token)}`
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3">
            <ExoticLogo size={48} />
            <ExoticWordmark />
            <p className="text-sm text-muted-foreground text-center">
              We sent a code to{" "}
              <span className="text-foreground font-medium">{email || "your email"}</span>
            </p>
          </div>

          <div className="glass-auth-card space-y-6">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 4-box code input */}
            <div className="flex gap-3 justify-center">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={refs[i]}
                  type="text"
                  inputMode="text"
                  maxLength={4}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-14 h-16 text-center text-2xl font-bold uppercase rounded-2xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-foreground transition-all caret-transparent"
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              disabled={isLoading || digits.join("").length < 4}
              className="w-full bg-foreground text-background hover:opacity-90"
              size="xl"
            >
              {isLoading ? "Verifying..." : "Next"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Didn't receive a code?{" "}
              <button
                onClick={() => navigate(`/forgot-password`)}
                className="font-medium text-foreground hover:opacity-80 transition-opacity"
              >
                Try again
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
