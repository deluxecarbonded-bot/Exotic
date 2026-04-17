import type { Route } from "./+types/register";
import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { ExoticLogo, ExoticWordmark } from "~/components/logo";
import { useAuthStore } from "~/stores/auth-store";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Create Account - Exotic" },
    { name: "description", content: "Create your Exotic account" },
  ];
}

function getPasswordStrength(password: string): { level: number; label: string } {
  if (!password) return { level: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  if (score <= 1) return { level: 1, label: "Weak" };
  if (score <= 2) return { level: 2, label: "Fair" };
  if (score <= 3) return { level: 3, label: "Good" };
  return { level: 4, label: "Strong" };
}

export default function Register() {
  const { register, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registered, setRegistered] = useState(false);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!displayName.trim()) newErrors.displayName = "Display name is required";
    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = "Only letters, numbers, and underscores";
    } else if (username.length < 3) {
      newErrors.username = "Must be at least 3 characters";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Must be at least 8 characters";
    }
    if (!agreedToTerms) {
      newErrors.terms = "You must agree to the terms";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    const success = await register(username, displayName, email, password);
    if (success) setRegistered(true);
  };

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((p) => {
        const next = { ...p };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-8">

          <AnimatePresence mode="wait">
            {registered ? (
              <motion.div
                key="check-email"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6"
              >
                <div className="flex flex-col items-center gap-3">
                  <ExoticLogo size={48} />
                  <ExoticWordmark />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                      width={28} height={28} viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </motion.svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Check your email</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      We sent a confirmation link to{" "}
                      <span className="font-medium text-foreground">{email}</span>.
                      Click it to activate your account.
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  className="w-full bg-foreground text-background hover:opacity-90"
                  size="xl"
                >
                  <Link to="/login">Go to Sign In</Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                  <ExoticLogo size={48} />
                  <ExoticWordmark />
                  <p className="text-sm text-muted-foreground">
                    Create your account
                  </p>
                </div>

                {/* Auth Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  clearFieldError("displayName");
                }}
                placeholder="Your name"
                autoComplete="name"
                aria-invalid={!!errors.displayName}
              />
              {errors.displayName && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive mt-1"
                >
                  {errors.displayName}
                </motion.p>
              )}
            </div>

            <div>
              <Label className="mb-1.5">Username</Label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-1">@</span>
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
                    clearFieldError("username");
                  }}
                  placeholder="username"
                  autoComplete="username"
                  aria-invalid={!!errors.username}
                />
              </div>
              {errors.username && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive mt-1"
                >
                  {errors.username}
                </motion.p>
              )}
            </div>

            <div>
              <Label className="mb-1.5">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive mt-1"
                >
                  {errors.email}
                </motion.p>
              )}
            </div>

            <div>
              <Label className="mb-1.5">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive mt-1"
                >
                  {errors.password}
                </motion.p>
              )}

              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.level
                            ? "bg-foreground"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => {
                  setAgreedToTerms(!agreedToTerms);
                  clearFieldError("terms");
                }}
                className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded flex items-center justify-center transition-colors ${
                  agreedToTerms
                    ? "bg-foreground text-background"
                    : "bg-muted"
                }`}
              >
                {agreedToTerms && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    width={10}
                    height={10}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </motion.svg>
                )}
              </button>
              <label className="text-xs text-muted-foreground leading-relaxed">
                I agree to the{" "}
                <Link to="/terms" className="text-foreground hover:opacity-80 transition-opacity">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-foreground hover:opacity-80 transition-opacity">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {errors.terms && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive"
              >
                {errors.terms}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-foreground text-background hover:opacity-90"
              size="xl"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-foreground hover:opacity-80 transition-opacity"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
          )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
