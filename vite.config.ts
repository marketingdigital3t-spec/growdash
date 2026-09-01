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
    sourcemap: false,
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
      },
    },
  },
});
