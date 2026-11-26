import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // CI enables hidden maps for Sentry upload; maps are removed before the
    // Pages artifact is published so source remains private.
    sourcemap: process.env.SOURCEMAP === "true" ? "hidden" : false,
    modulePreload: {
      // The route graph contains heavy, lazy-only dependencies such as
      // Recharts and the map renderer. Vite otherwise emits modulepreload
      // links for those dependencies in index.html, making the login shell
      // wait on hundreds of kilobytes that are not needed yet.
      resolveDependencies(filename, deps) {
        if (filename.includes("app-")) return [];
        return deps;
      },
    },
    rollupOptions: {
      output: {
        // Keep production module URLs neutral. Browser privacy/ad-blocking
        // extensions can falsely block route chunks named after marketing
        // concepts (for example `TrafficPage-*.js`), leaving the SPA blank.
        // Content hashes still provide deterministic cache busting.
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/chunk-[hash].js",
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/node_modules/lodash/")) return "vendor-lodash";
          if (id.includes("recharts") || id.includes("/node_modules/d3") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("react-grid-layout") || id.includes("react-resizable") || id.includes("react-resizable-panels")) return "vendor-layout";
          if (id.includes("@radix-ui") || id.includes("lucide-react")) return "vendor-ui";
          return undefined;
        },
      },
    },
  },
});
