import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

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
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("react-grid-layout") || id.includes("react-resizable") || id.includes("react-resizable-panels")) return "vendor-layout";
          if (id.includes("@radix-ui") || id.includes("lucide-react")) return "vendor-ui";
          // Let Rollup group the remaining shared dependencies. Forcing React and
          // every transitive package into separate buckets creates circular chunks
          // (charts -> React -> shared helpers -> charts) and makes cold starts less
          // predictable instead of faster.
          return undefined;
        },
      },
    },
  },
});
