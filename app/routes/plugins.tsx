import type { Route } from "./+types/plugins";
import { motion } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { IconCheck, IconLayers } from "~/components/icons";
import { usePluginStore } from "~/stores/plugin-store";
import { useThemeStore } from "~/stores/theme-store";
import { useToastStore } from "~/stores/toast-store";
import { fadeInUp } from "~/components/animations";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Exotic Plugins" },
    { name: "description", content: "Browse and install Exotic plugins" },
  ];
}

function PluginCard({ plugin }: { plugin: ReturnType<typeof usePluginStore>["plugins"][number] }) {
  const { install, uninstall } = usePluginStore();
  const { setLiquidGlass } = useThemeStore();
  const { addToast } = useToastStore();

  const handleToggle = () => {
    if (plugin.installed) {
      uninstall(plugin.id);
      // disable exotic glass when uninstalling
      if (plugin.id === "exotic-glass") setLiquidGlass(false);
      addToast(`${plugin.name} removed`, "info");
    } else {
      install(plugin.id);
      addToast(`${plugin.name} installed! Enable it in Settings.`, "success");
    }
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
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">{plugin.icon}</span>
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
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleToggle}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
              plugin.installed
                ? "bg-muted text-muted-foreground hover:text-foreground"
                : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {plugin.installed ? (
              <>
                <IconCheck size={16} />
                Installed
              </>
            ) : (
              "Install"
            )}
          </motion.button>
          {plugin.installed && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleToggle}
              className="px-4 py-2.5 text-sm font-medium rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              Remove
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PluginsPage() {
  const { plugins } = usePluginStore();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <IconLayers size={20} />
            <h1 className="text-xl font-bold">Exotic Plugins</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Enhance your experience with plugins. Installed plugins can be configured in Settings.
          </p>
        </div>

        <div className="space-y-4">
          {plugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
