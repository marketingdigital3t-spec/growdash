// vite.config.ts
import { defineConfig } from "file:///Users/thiegojesus/Library/Mobile%20Documents/com%7Eapple%7ECloudDocs/PROJETOS%20%E2%80%93%20APP/Growdash/node_modules/vite/dist/node/index.js";
import react from "file:///Users/thiegojesus/Library/Mobile%20Documents/com%7Eapple%7ECloudDocs/PROJETOS%20%E2%80%93%20APP/Growdash/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/Users/thiegojesus/Library/Mobile Documents/com~apple~CloudDocs/PROJETOS \u2013 APP/Growdash";
var vite_config_default = defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep production module URLs neutral. Browser privacy/ad-blocking
        // extensions can falsely block route chunks named after marketing
        // concepts (for example `TrafficPage-*.js`), leaving the SPA blank.
        // Content hashes still provide deterministic cache busting.
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/chunk-[hash].js",
        manualChunks(id) {
          if (!id.includes("node_modules")) return void 0;
          if (id.includes("/node_modules/lodash/")) return "vendor-lodash";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("react-grid-layout") || id.includes("react-resizable") || id.includes("react-resizable-panels")) return "vendor-layout";
          if (id.includes("@radix-ui") || id.includes("lucide-react")) return "vendor-ui";
          return void 0;
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdGhpZWdvamVzdXMvTGlicmFyeS9Nb2JpbGUgRG9jdW1lbnRzL2NvbX5hcHBsZX5DbG91ZERvY3MvUFJPSkVUT1MgXHUyMDEzIEFQUC9Hcm93ZGFzaFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3RoaWVnb2plc3VzL0xpYnJhcnkvTW9iaWxlIERvY3VtZW50cy9jb21+YXBwbGV+Q2xvdWREb2NzL1BST0pFVE9TIFx1MjAxMyBBUFAvR3Jvd2Rhc2gvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3RoaWVnb2plc3VzL0xpYnJhcnkvTW9iaWxlJTIwRG9jdW1lbnRzL2NvbSU3RWFwcGxlJTdFQ2xvdWREb2NzL1BST0pFVE9TJTIwJUUyJTgwJTkzJTIwQVBQL0dyb3dkYXNoL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiA4MDgwLFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogZmFsc2UsXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgLy8gS2VlcCBwcm9kdWN0aW9uIG1vZHVsZSBVUkxzIG5ldXRyYWwuIEJyb3dzZXIgcHJpdmFjeS9hZC1ibG9ja2luZ1xuICAgICAgICAvLyBleHRlbnNpb25zIGNhbiBmYWxzZWx5IGJsb2NrIHJvdXRlIGNodW5rcyBuYW1lZCBhZnRlciBtYXJrZXRpbmdcbiAgICAgICAgLy8gY29uY2VwdHMgKGZvciBleGFtcGxlIGBUcmFmZmljUGFnZS0qLmpzYCksIGxlYXZpbmcgdGhlIFNQQSBibGFuay5cbiAgICAgICAgLy8gQ29udGVudCBoYXNoZXMgc3RpbGwgcHJvdmlkZSBkZXRlcm1pbmlzdGljIGNhY2hlIGJ1c3RpbmcuXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiBcImFzc2V0cy9hcHAtW2hhc2hdLmpzXCIsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiBcImFzc2V0cy9jaHVuay1baGFzaF0uanNcIixcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKCFpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAvLyBSZWNoYXJ0cyBpbXBvcnRzIG1hbnkgc21hbGwgQ29tbW9uSlMgbG9kYXNoIG1vZHVsZXMuIEtlZXBpbmcgdGhlbSBpblxuICAgICAgICAgIC8vIHRoZWlyIG93biBjYWNoZWFibGUgY2h1bmsgcHJldmVudHMgdGhlIGNoYXJ0cyBidW5kbGUgZnJvbSBjcm9zc2luZ1xuICAgICAgICAgIC8vIHRoZSBicm93c2VyJ3MgNTAwIGtCIHdhcm5pbmcgdGhyZXNob2xkIHdpdGhvdXQgc3BsaXR0aW5nIFJlYWN0LlxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9ub2RlX21vZHVsZXMvbG9kYXNoL1wiKSkgcmV0dXJuIFwidmVuZG9yLWxvZGFzaFwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInJlY2hhcnRzXCIpIHx8IGlkLmluY2x1ZGVzKFwiZDMtXCIpKSByZXR1cm4gXCJ2ZW5kb3ItY2hhcnRzXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQHN1cGFiYXNlXCIpKSByZXR1cm4gXCJ2ZW5kb3Itc3VwYWJhc2VcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWFjdC1ncmlkLWxheW91dFwiKSB8fCBpZC5pbmNsdWRlcyhcInJlYWN0LXJlc2l6YWJsZVwiKSB8fCBpZC5pbmNsdWRlcyhcInJlYWN0LXJlc2l6YWJsZS1wYW5lbHNcIikpIHJldHVybiBcInZlbmRvci1sYXlvdXRcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJAcmFkaXgtdWlcIikgfHwgaWQuaW5jbHVkZXMoXCJsdWNpZGUtcmVhY3RcIikpIHJldHVybiBcInZlbmRvci11aVwiO1xuICAgICAgICAgIC8vIExldCBSb2xsdXAgZ3JvdXAgdGhlIHJlbWFpbmluZyBzaGFyZWQgZGVwZW5kZW5jaWVzLiBGb3JjaW5nIFJlYWN0IGFuZFxuICAgICAgICAgIC8vIGV2ZXJ5IHRyYW5zaXRpdmUgcGFja2FnZSBpbnRvIHNlcGFyYXRlIGJ1Y2tldHMgY3JlYXRlcyBjaXJjdWxhciBjaHVua3NcbiAgICAgICAgICAvLyAoY2hhcnRzIC0+IFJlYWN0IC0+IHNoYXJlZCBoZWxwZXJzIC0+IGNoYXJ0cykgYW5kIG1ha2VzIGNvbGQgc3RhcnRzIGxlc3NcbiAgICAgICAgICAvLyBwcmVkaWN0YWJsZSBpbnN0ZWFkIG9mIGZhc3Rlci5cbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXljLFNBQVMsb0JBQW9CO0FBQ3RlLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sS0FBSztBQUFBLE1BQ0gsU0FBUztBQUFBLElBQ1g7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFLTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixhQUFhLElBQUk7QUFDZixjQUFJLENBQUMsR0FBRyxTQUFTLGNBQWMsRUFBRyxRQUFPO0FBSXpDLGNBQUksR0FBRyxTQUFTLHVCQUF1QixFQUFHLFFBQU87QUFDakQsY0FBSSxHQUFHLFNBQVMsVUFBVSxLQUFLLEdBQUcsU0FBUyxLQUFLLEVBQUcsUUFBTztBQUMxRCxjQUFJLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUNyQyxjQUFJLEdBQUcsU0FBUyxtQkFBbUIsS0FBSyxHQUFHLFNBQVMsaUJBQWlCLEtBQUssR0FBRyxTQUFTLHdCQUF3QixFQUFHLFFBQU87QUFDeEgsY0FBSSxHQUFHLFNBQVMsV0FBVyxLQUFLLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUtwRSxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
