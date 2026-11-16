import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import { defineConfig as defineViteConfig, type ConfigEnv, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:4000";

const sharedViteOptions = {
  root: path.resolve(__dirname, "frontend"),
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
    alias: {
      "@": path.resolve(__dirname, "frontend", "src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
    tsconfigPaths: true,
  },
};

const tanstackStartOptions = {
  importProtection: {
    behavior: "error" as const,
    client: {
      files: ["**/server/**"],
      specifiers: ["server-only"],
    },
  },
};

const cloudflareConfig = defineLovableConfig({
  vite: sharedViteOptions,
});

const vercelConfig: UserConfig = {
  ...sharedViteOptions,
  plugins: [
    tailwindcss(),
    tsconfigPaths({
      projects: [path.resolve(__dirname, "frontend", "tsconfig.json")],
    }),
    tanstackStart(tanstackStartOptions),
    nitro({
      preset: "vercel", 
      output: {
        dir: path.resolve(__dirname, ".vercel", "output"),
      },
    }),
    viteReact(),
  ],
};

export default async (env: ConfigEnv): Promise<UserConfig> => {
  const isVercelBuild =
    env.command === "build" && (env.mode === "vercel" || process.env.VERCEL === "1");

  return isVercelBuild ? defineViteConfig(vercelConfig) : cloudflareConfig(env);
};