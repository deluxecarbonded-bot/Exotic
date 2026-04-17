import type { Route } from "./+types/login";
import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { ExoticLogo, ExoticWordmark } from "~/components/logo";
import { useAuthStore } from "~/stores/auth-store";
import { supabase } from "~/lib/supabase";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign In - Exotic" },
    { name: "description", content: "Sign in to your Exotic account" },
  ];
}

export default function Login() {
  const { login, isLoading, error, clearError, isAuthenticated, user, updateProfile, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [showReactivate, setShowReactivate] = useState(false);
  const urlError = searchParams.get("error");

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.is_deactivated) {
        setShowReactivate(true);
      } else {
        navigate("/");
      }
    }
  }, [isAuthenticated, user, navigate]);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!username.trim()) {
      newErrors.username = "Username is required";
    }
    if (!password) {
      newErrors.password = "Password is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    await login(username, password);
  };

  const handleReactivate = async () => {
    await updateProfile({ is_deactivated: false, deactivated_at: null });
    navigate("/");
  };

  const handleStayDeactivated = async () => {
    await logout();
    setShowReactivate(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <ExoticLogo size={48} />
            <ExoticWordmark />
            <p className="text-sm text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          {/* Auth Error */}
          {(error || urlError) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center"
            >
              {error || urlError}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5">Username</Label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-1">@</span>
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
                    if (errors.username) setErrors((p) => ({ ...p, username: undefined }));
                  }}
                  placeholder="username"
                  autoComplete="username"
                  autoCapitalize="none"
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
              <Label className="mb-1.5">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                placeholder="Your password"
                autoComplete="current-password"
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
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-foreground text-background hover:opacity-90"
              size="xl"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-foreground hover:opacity-80 transition-opacity"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Reactivation Modal */}
      <AnimatePresence>
        {showReactivate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <ExoticLogo size={28} />
                </div>
                <h2 className="text-lg font-bold">Welcome back!</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Your account is currently deactivated. Would you like to reactivate it and get back to Exotic?
                </p>
              </div>

              <div className="space-y-2.5">
                <Button
                  size="xl"
                  className="w-full bg-foreground text-background hover:opacity-90"
                  onClick={handleReactivate}
                >
                  Yes, reactivate my account
                </Button>
                <Button
                  variant="ghost"
                  size="xl"
                  className="w-full text-muted-foreground"
                  onClick={handleStayDeactivated}
                >
                  No, sign me out
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
