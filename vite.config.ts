import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { resolve } from "path";

const isVercel = !!process.env.VERCEL;

export default defineConfig(async ({ command }) => {
  const plugins = [tailwindcss(), reactRouter()];

  if (isVercel) {
    const { vercelPreset } = await import("@vercel/react-router/vite");
    plugins.unshift(vercelPreset());
  } else {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.unshift(cloudflare({ viteEnvironment: { name: "ssr" } }));
  }

  return {
    plugins,
    resolve: {
      alias: {
        "~": resolve(__dirname, "./app"),
      },
    },
    ...(!isVercel && {
      // Configure SSR environment to use Cloudflare's worker entry as the rollup input
      environments: {
        ssr: {
          build: {
            rollupOptions: {
              input: "virtual:cloudflare/worker-entry",
            },
          },
        },
      },
    }),
    // Polyfill __filename for @cloudflare/codemode (uses zod-to-ts → TypeScript compiler)
    define: {
      __filename: "'index.ts'",
    },
    // Disable dep discovery during builds to avoid WebSocket error in @cloudflare/vite-plugin
    optimizeDeps: command === "build" ? { noDiscovery: true } : {},
  };
});
