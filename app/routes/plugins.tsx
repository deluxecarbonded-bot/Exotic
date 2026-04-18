import type { Route } from "./+types/plugins";
import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { IconCheck, IconLayers, IconX } from "~/components/icons";
import { usePluginStore } from "~/stores/plugin-store";
import { useThemeStore } from "~/stores/theme-store";
import { useToastStore } from "~/stores/toast-store";
import { fadeInUp } from "~/components/animations";
import { EmptyState } from "~/components/cards";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Exotic Plugins" },
    { name: "description", content: "Browse and install Exotic plugins" },
  ];
}

/** Animated glass/crystal SVG icon with subtle floating */
function ExoticGlassIcon({ size = 48 }: { size?: number }) {
  return (
    <motion.div
      animate={{ y: [-2, 2, -2], rotate: [-1, 1, -1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer glow */}
        <defs>
          <radialGradient id="glass-glow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="rgba(180,210,255,0.6)" />
            <stop offset="100%" stopColor="rgba(180,210,255,0)" />
          </radialGradient>
          <linearGradient id="glass-face-1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="100%" stopColor="rgba(190,210,255,0.35)" />
          </linearGradient>
          <linearGradient id="glass-face-2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(200,180,255,0.5)" />
            <stop offset="100%" stopColor="rgba(160,200,255,0.25)" />
          </linearGradient>
          <linearGradient id="glass-face-3" x1="0.5" y1="1" x2="0.5" y2="0">
            <stop offset="0%" stopColor="rgba(140,180,255,0.6)" />
            <stop offset="100%" stopColor="rgba(220,200,255,0.2)" />
          </linearGradient>
        </defs>

        {/* Background glow */}
        <circle cx="24" cy="24" r="20" fill="url(#glass-glow)" />

        {/* Crystal body — top facet */}
        <path d="M24 6 L38 20 L24 26 Z" fill="url(#glass-face-1)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        {/* Crystal body — right facet */}
        <path d="M38 20 L24 26 L30 42 Z" fill="url(#glass-face-2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
        {/* Crystal body — left facet */}
        <path d="M24 6 L10 20 L24 26 Z" fill="url(#glass-face-3)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
        {/* Crystal body — bottom-left facet */}
        <path d="M10 20 L24 26 L18 42 Z" fill="url(#glass-face-1)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" opacity="0.8" />
        {/* Crystal bottom point */}
        <path d="M18 42 L24 26 L30 42 L24 46 Z" fill="url(#glass-face-2)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" opacity="0.7" />

        {/* Highlight streak */}
        <path d="M20 12 L16 22" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="14" r="1.5" fill="rgba(255,255,255,0.9)" />
      </svg>
    </motion.div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-foreground"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.15, ease: "linear" }}
      />
    </div>
  );
}

function formatBytes(bytes: number, progress: number) {
  const downloaded = Math.floor(bytes * progress / 100);
  const fmt = (b: number) => {
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${b} B`;
  };
  return `${fmt(downloaded)} / ${fmt(bytes)}`;
}

function PluginCard({ plugin, showRemove }: {
  plugin: ReturnType<typeof usePluginStore>["plugins"][number];
  showRemove?: boolean;
}) {
  const { install, uninstall, cancelDownload, isDownloading, getProgress } = usePluginStore();
  const { setLiquidGlass } = useThemeStore();
  const { addToast } = useToastStore();

  const downloading = isDownloading(plugin.id);
  const progress = getProgress(plugin.id);

  const handleInstall = () => {
    install(plugin.id);
    // After download completes, show toast
    const check = setInterval(() => {
      const s = usePluginStore.getState();
      if (s.isInstalled(plugin.id)) {
        clearInterval(check);
        addToast(`${plugin.name} installed! Enable it in Settings.`, "success");
      }
    }, 200);
  };

  const handleRemove = () => {
    uninstall(plugin.id);
    if (plugin.id === "exotic-glass") setLiquidGlass(false);
    addToast(`${plugin.name} removed`, "info");
  };

  const handleCancel = () => {
    cancelDownload(plugin.id);
    addToast("Download cancelled", "info");
  };

  return (
    <motion.div
      className="rounded-2xl border border-muted bg-card overflow-hidden"
      {...fadeInUp}
    >
      {/* Glass preview banner */}
      <div className="relative h-32 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(120,180,255,0.35) 0%, rgba(190,130,255,0.30) 40%, rgba(120,220,255,0.25) 70%, rgba(180,140,255,0.30) 100%)",
          }}
        />
        <div className="absolute inset-0 backdrop-blur-sm" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <ExoticGlassIcon size={48} />
            <span className="text-xs font-bold tracking-widest uppercase text-white/80 drop-shadow-sm">
              {plugin.name}
            </span>
          </div>
        </div>
        {/* Glass orbs decoration */}
        <div
          className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(190,130,255,0.8) 0%, transparent 70%)" }}
        />
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">{plugin.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {plugin.description}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{plugin.size}</p>
          </div>
        </div>

        {/* Download progress */}
        {downloading && (
          <div className="mt-3 space-y-1.5">
            <ProgressBar progress={progress} />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {formatBytes(plugin.sizeBytes, progress)} &middot; {progress}%
              </span>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {downloading ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconX size={14} />
              Cancel
            </motion.button>
          ) : plugin.installed ? (
            <>
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-muted text-muted-foreground">
                <IconCheck size={16} />
                Installed
              </div>
              {showRemove && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRemove}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  Remove
                </motion.button>
              )}
            </>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:opacity-90 transition-colors"
            >
              Install
              <span className="text-xs opacity-60">{plugin.size}</span>
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PluginsPage() {
  const { plugins } = usePluginStore();
  const [tab, setTab] = useState("available");

  const available = plugins.filter((p) => !p.installed);
  const installed = plugins.filter((p) => p.installed);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <IconLayers size={20} />
            <h1 className="text-xl font-bold">Exotic Plugins</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Enhance your experience with plugins.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="w-full !h-11 mb-4">
            <TabsTrigger value="available" className="flex-1 text-sm">
              Available
            </TabsTrigger>
            <TabsTrigger value="installed" className="flex-1 text-sm">
              Installed{installed.length > 0 && ` (${installed.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            {available.length === 0 && installed.length === plugins.length ? (
              <EmptyState
                icon={IconCheck}
                title="All plugins installed"
                description="You've installed all available plugins. Check the Installed tab to manage them."
              />
            ) : (
              <div className="space-y-4">
                {/* Show all plugins on available tab — installed ones show as "Installed" */}
                {plugins.map((plugin) => (
                  <PluginCard key={plugin.id} plugin={plugin} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="installed">
            {installed.length === 0 ? (
              <EmptyState
                icon={IconLayers}
                title="No plugins installed"
                description="Browse the Available tab to find plugins to install."
              />
            ) : (
              <div className="space-y-4">
                {installed.map((plugin) => (
                  <PluginCard key={plugin.id} plugin={plugin} showRemove />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
