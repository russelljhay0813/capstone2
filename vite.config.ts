import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:4000";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 8080,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    optimizeDeps: {
      include: ["use-sync-external-store/shim/with-selector"],
    },
    resolve: {
      tsconfigPaths: true,
    },
  },
});
