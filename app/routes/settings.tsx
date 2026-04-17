import type { Route } from "./+types/settings";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  IconUser,
  IconBell,
  IconLock,
  IconMoon,
  IconSun,
  IconLogOut,
  IconTrash,
  IconSettings,
  IconCheck,
  IconAlertTriangle,
  IconPause,
  IconMail,
  IconSmartphone,
  IconShield,
  IconKey,
  IconX,
  IconEdit,
} from "~/components/icons";
import { UserAvatar } from "~/components/user-avatar";
import { useAuthStore } from "~/stores/auth-store";
import { useThemeStore } from "~/stores/theme-store";
import { supabase } from "~/lib/supabase";
import type { ThemeMode } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Settings - Exotic" },
    { name: "description", content: "Manage your Exotic account settings" },
  ];
}

function SectionHeader({
  title,
  icon: Icon,
  variant,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  variant?: "destructive";
}) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon
        size={18}
        className={variant === "destructive" ? "text-destructive" : ""}
      />
      <h2
        className={`text-sm font-bold uppercase tracking-wider ${
          variant === "destructive" ? "text-destructive" : ""
        }`}
      >
        {title}
      </h2>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 mr-4">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function StatusBanner({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error" | "info";
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`p-3 rounded-lg text-sm text-center ${
        type === "success"
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : type === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {message}
      {onDismiss && (
        <button onClick={onDismiss} className="ml-2 underline text-xs">
          Dismiss
        </button>
      )}
    </motion.div>
  );
}

export default function Settings() {
  const { user, updateProfile, logout } = useAuthStore();
  const { mode, setMode, liquidGlass, setLiquidGlass } = useThemeStore();
  const navigate = useNavigate();

  // Profile
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");

  // Privacy
  const [allowAnonymous, setAllowAnonymous] = useState(
    user?.allow_anonymous ?? true
  );
  const [showOnline, setShowOnline] = useState(user?.show_online ?? true);
  const [privateProfile, setPrivateProfile] = useState(
    user?.is_private ?? false
  );

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(
    user?.email_notifications ?? true
  );
  const [pushNotifs, setPushNotifs] = useState(
    user?.push_notifications ?? true
  );

  // States
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deleteTyping, setDeleteTyping] = useState("");
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when auth user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setUsername(user.username);
      setBio(user.bio ?? "");
      setAllowAnonymous(user.allow_anonymous);
      setShowOnline(user.show_online ?? true);
      setPrivateProfile(user.is_private);
      setEmailNotifs(user.email_notifications ?? true);
      setPushNotifs(user.push_notifications ?? true);
      setAvatarUrl(user.avatar_url ?? "");
    }
  }, [user]);

  // Fetch user email from Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  // --- Handlers ---

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError("");

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Please select a JPG, PNG, GIF, or WebP image.");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be smaller than 2MB.");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async () => {
    if (!user?.id || !fileInputRef.current?.files?.[0]) return;

    const file = fileInputRef.current.files[0];
    setAvatarUploading(true);
    setAvatarError("");

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      // Delete old avatar files in the user's folder
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from("avatars")
          .remove(existingFiles.map((f) => `${user.id}/${f.name}`));
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setAvatarError(uploadError.message);
        setAvatarUploading(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile
      await updateProfile({ avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
      setAvatarPreview(null);

      // Clear file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setAvatarError(err?.message ?? "Failed to upload avatar.");
    }

    setAvatarUploading(false);
  };

  const handleAvatarRemove = async () => {
    if (!user?.id) return;
    setAvatarUploading(true);

    // Delete all files in user's avatar folder
    const { data: existingFiles } = await supabase.storage
      .from("avatars")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      await supabase.storage
        .from("avatars")
        .remove(existingFiles.map((f) => `${user.id}/${f.name}`));
    }

    await updateProfile({ avatar_url: null });
    setAvatarUrl("");
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAvatarUploading(false);
  };

  const cancelAvatarPreview = () => {
    setAvatarPreview(null);
    setAvatarError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    await updateProfile({
      display_name: displayName,
      username,
      bio,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePrivacyToggle = async (
    field: "allow_anonymous" | "is_private" | "show_online",
    value: boolean
  ) => {
    if (field === "allow_anonymous") setAllowAnonymous(value);
    if (field === "is_private") setPrivateProfile(value);
    if (field === "show_online") setShowOnline(value);
    await updateProfile({ [field]: value });

    // When switching from private to public, auto-accept all pending follow requests
    if (field === "is_private" && !value && user?.id) {
      await supabase
        .from("follows")
        .update({ status: "accepted" })
        .eq("following_id", user.id)
        .eq("status", "pending");
    }
  };

  const handleNotificationToggle = async (
    field: "email_notifications" | "push_notifications",
    value: boolean
  ) => {
    if (field === "email_notifications") setEmailNotifs(value);
    if (field === "push_notifications") setPushNotifs(value);
    await updateProfile({ [field]: value });
  };

  const handleResetPassword = async () => {
    setPasswordResetLoading(true);
    setPasswordResetError("");
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser?.email) {
        setPasswordResetError("No email found for your account.");
        setPasswordResetLoading(false);
        return;
      }
      const res = await fetch("/api/send-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authUser.email }),
      });
      let result: any = {};
      try { result = await res.json(); } catch { /* ignore */ }
      if (!res.ok || result.error) {
        setPasswordResetError(result.error ?? "Failed to send reset email.");
      } else {
        navigate(`/verify-reset-code?email=${encodeURIComponent(authUser.email)}`);
      }
    } catch (e: any) {
      setPasswordResetError(e?.message ?? "Something went wrong");
    }
    setPasswordResetLoading(false);
  };

  const handleDeactivateAccount = async () => {
    if (!user?.id) return;
    setDangerLoading(true);
    await supabase
      .from("profiles")
      .update({
        is_deactivated: true,
        deactivated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || deleteTyping !== "DELETE") return;
    setDangerLoading(true);
    // Delete all user data (cascades via FK)
    await supabase.from("answers").delete().eq("user_id", user.id);
    await supabase.from("questions").delete().eq("receiver_id", user.id);
    await supabase.from("questions").delete().eq("sender_id", user.id);
    await supabase.from("follows").delete().eq("follower_id", user.id);
    await supabase.from("follows").delete().eq("following_id", user.id);
    await supabase.from("notifications").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("actor_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    // Delete from Supabase Auth (requires service role — done server-side)
    await fetch("/api/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    });
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        <div className="space-y-10">
          {/* ==================== PROFILE ==================== */}
          <section>
            <SectionHeader title="Profile" icon={IconUser} />
            <div className="space-y-5">
              {/* Avatar Upload */}
              <div className="flex items-start gap-4 mb-2">
                <div className="relative group">
                  {/* Avatar display */}
                  <UserAvatar
                    avatarUrl={avatarPreview ?? avatarUrl}
                    name={displayName ?? "?"}
                    size="xl"
                    className="w-20 h-20"
                  />

                  {/* Hover overlay */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <IconEdit size={18} className="text-white" />
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />

                  <AnimatePresence mode="wait">
                    {avatarPreview ? (
                      <motion.div
                        key="preview-actions"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2"
                      >
                        <Button
                          size="xl"
                          onClick={handleAvatarUpload}
                          disabled={avatarUploading}
                          className="bg-foreground text-background hover:opacity-90"
                        >
                          {avatarUploading ? (
                            <span className="flex items-center gap-2">
                              <motion.div
                                className="w-4 h-4 border-2 border-background border-t-transparent rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 0.8,
                                  ease: "linear",
                                }}
                              />
                              Uploading...
                            </span>
                          ) : (
                            "Save avatar"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xl"
                          onClick={cancelAvatarPreview}
                          disabled={avatarUploading}
                        >
                          Cancel
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="default-actions"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2"
                      >
                        <Button
                          variant="outline"
                          size="xl"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Change avatar
                        </Button>
                        {avatarUrl && (
                          <Button
                            variant="ghost"
                            size="xl"
                            onClick={handleAvatarRemove}
                            disabled={avatarUploading}
                            className="text-destructive hover:text-destructive"
                          >
                            Remove
                          </Button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, GIF or WebP. Max 2MB.
                  </p>

                  <AnimatePresence>
                    {avatarError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-destructive"
                      >
                        {avatarError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 text-sm">Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="h-10"
                />
              </div>

              <div>
                <Label className="mb-1.5 text-sm">Username</Label>
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground mr-1">@</span>
                  <Input
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
                      )
                    }
                    placeholder="username"
                    className="h-10"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 text-sm">Bio</Label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself"
                  className="w-full min-h-[100px] rounded-lg bg-input/20 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 resize-none dark:bg-input/30"
                  maxLength={160}
                />
                <span className="text-xs text-muted-foreground">
                  {bio.length}/160
                </span>
              </div>

              <div>
                <Label className="mb-1.5 text-sm">Email</Label>
                <Input
                  value={userEmail}
                  disabled
                  className="h-10 opacity-60"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Contact support to change your email address.
                </p>
              </div>

              <Button
                onClick={handleSaveProfile}
                className="bg-foreground text-background hover:opacity-90"
                size="xl"
                disabled={saving}
              >
                {saving ? (
                  "Saving..."
                ) : saved ? (
                  <span className="flex items-center gap-1.5">
                    <IconCheck size={16} /> Saved
                  </span>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </section>

          <Separator />

          {/* ==================== ACCOUNT / PASSWORD ==================== */}
          <section>
            <SectionHeader title="Account Security" icon={IconKey} />
            <div className="space-y-4">
              <div className="rounded-lg border border-muted p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Reset Password</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    We'll send a reset code to{" "}
                    <span className="font-medium text-foreground">
                      {userEmail || "your email"}
                    </span>
                  </p>
                </div>

                <AnimatePresence>
                  {passwordResetError && (
                    <StatusBanner
                      type="error"
                      message={passwordResetError}
                      onDismiss={() => setPasswordResetError("")}
                    />
                  )}
                </AnimatePresence>

                <Button
                  variant="outline"
                  size="xl"
                  onClick={handleResetPassword}
                  disabled={passwordResetLoading}
                  className="w-full"
                >
                  {passwordResetLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "linear",
                        }}
                      />
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <IconKey size={16} /> Send reset code
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* ==================== PRIVACY ==================== */}
          <section>
            <SectionHeader title="Privacy" icon={IconShield} />
            <div className="space-y-1 rounded-lg border border-muted p-4">
              <SettingRow
                label="Allow anonymous questions"
                description="Let anyone send you questions without revealing their identity"
              >
                <Switch
                  checked={allowAnonymous}
                  onCheckedChange={(v) =>
                    handlePrivacyToggle("allow_anonymous", v)
                  }
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Show online status"
                description="Let others see when you're active on Exotic"
              >
                <Switch
                  checked={showOnline}
                  onCheckedChange={(v) =>
                    handlePrivacyToggle("show_online", v)
                  }
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Private profile"
                description="Only approved followers can see your answers and activity"
              >
                <Switch
                  checked={privateProfile}
                  onCheckedChange={(v) =>
                    handlePrivacyToggle("is_private", v)
                  }
                />
              </SettingRow>
            </div>
          </section>

          <Separator />

          {/* ==================== NOTIFICATIONS ==================== */}
          <section>
            <SectionHeader title="Notifications" icon={IconBell} />
            <div className="space-y-1 rounded-lg border border-muted p-4">
              <SettingRow
                label="Email notifications"
                description="Get email updates about new questions, answers, and followers"
              >
                <Switch
                  checked={emailNotifs}
                  onCheckedChange={(v) =>
                    handleNotificationToggle("email_notifications", v)
                  }
                />
              </SettingRow>

              <AnimatePresence>
                {emailNotifs && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-4 pb-2 space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <IconMail size={12} />
                        Emails will be sent to{" "}
                        <span className="font-medium text-foreground">
                          {userEmail}
                        </span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Separator />

              <SettingRow
                label="Push notifications"
                description="Receive push notifications on your device"
              >
                <Switch
                  checked={pushNotifs}
                  onCheckedChange={(v) =>
                    handleNotificationToggle("push_notifications", v)
                  }
                />
              </SettingRow>

              <AnimatePresence>
                {pushNotifs && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-4 pb-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <IconSmartphone size={12} />
                        Push notifications will appear on this device
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <Separator />

          {/* ==================== APPEARANCE ==================== */}
          <section>
            <SectionHeader title="Appearance" icon={IconMoon} />
            <div className="flex gap-2">
              {(["light", "dark", "system"] as ThemeMode[]).map((theme) => (
                <motion.button
                  key={theme}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMode(theme)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-xl transition-colors ${
                    mode === theme
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {theme === "light" && <IconSun size={16} />}
                  {theme === "dark" && <IconMoon size={16} />}
                  {theme === "system" && <IconSettings size={16} />}
                  <span className="capitalize">{theme}</span>
                </motion.button>
              ))}
            </div>

            {/* Liquid Glass */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Liquid Glass</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Frosted-glass surfaces throughout the app
                </p>
              </div>
              <Switch
                checked={liquidGlass}
                onCheckedChange={setLiquidGlass}
              />
            </div>
          </section>

          <Separator />

          {/* ==================== DANGER ZONE ==================== */}
          <section>
            <SectionHeader
              title="Danger Zone"
              icon={IconAlertTriangle}
              variant="destructive"
            />
            <div className="space-y-4">
              {/* Deactivate Account */}
              <div className="rounded-lg border border-muted p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <IconPause size={14} />
                    Deactivate account temporarily
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your profile and content will be hidden. You can reactivate
                    anytime by logging back in.
                  </p>
                </div>

                <AnimatePresence>
                  {!showDeactivateConfirm ? (
                    <Button
                      variant="outline"
                      size="xl"
                      className="w-full"
                      onClick={() => setShowDeactivateConfirm(true)}
                    >
                      Deactivate account
                    </Button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">
                          While deactivated:
                        </p>
                        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                          <li>Your profile won't appear in search</li>
                          <li>Your answers will be hidden from feeds</li>
                          <li>No one can send you questions</li>
                          <li>
                            Log back in anytime to reactivate your account
                          </li>
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="xl"
                          className="flex-1"
                          onClick={handleDeactivateAccount}
                          disabled={dangerLoading}
                        >
                          {dangerLoading ? "Deactivating..." : "Yes, deactivate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xl"
                          className="flex-1"
                          onClick={() => setShowDeactivateConfirm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Delete Account */}
              <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-destructive flex items-center gap-1.5">
                    <IconTrash size={14} />
                    Delete account permanently
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently delete your account and all associated data.
                    This action cannot be undone.
                  </p>
                </div>

                <AnimatePresence>
                  {!showDeleteConfirm ? (
                    <Button
                      variant="destructive"
                      size="xl"
                      className="w-full"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <IconTrash size={16} />
                      Delete account
                    </Button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <div className="bg-destructive/5 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-destructive font-medium">
                          This will permanently delete:
                        </p>
                        <ul className="text-xs text-destructive/80 space-y-0.5 list-disc list-inside">
                          <li>Your profile and bio</li>
                          <li>All questions you've received and sent</li>
                          <li>All your answers and comments</li>
                          <li>All followers and following connections</li>
                          <li>All notifications</li>
                        </ul>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5">
                          Type <span className="font-bold text-destructive">DELETE</span> to confirm
                        </Label>
                        <Input
                          value={deleteTyping}
                          onChange={(e) =>
                            setDeleteTyping(e.target.value.toUpperCase())
                          }
                          placeholder="Type DELETE"
                          className="h-10 font-mono"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="xl"
                          className="flex-1"
                          onClick={handleDeleteAccount}
                          disabled={deleteTyping !== "DELETE" || dangerLoading}
                        >
                          {dangerLoading
                            ? "Deleting..."
                            : "Permanently delete"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xl"
                          className="flex-1"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteTyping("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>

          <Separator />

          {/* ==================== SIGN OUT ==================== */}
          <section className="pb-8">
            <Button
              variant="ghost"
              size="xl"
              className="w-full justify-center text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <IconLogOut size={18} />
              Sign out
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
