import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

export function buildContentSecurityPolicy(graphqlUrl: string | undefined): string {
  const connectSources = ["'self'"];
  if (graphqlUrl && /^https?:\/\//i.test(graphqlUrl)) {
    connectSources.push(new URL(graphqlUrl).origin);
  }
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

function contentSecurityPolicy(graphqlUrl: string | undefined): Plugin {
  return {
    name: "metronome-content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: buildContentSecurityPolicy(graphqlUrl),
        },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const proxy = {
    "/graphql": {
      target: env.VITE_DEV_PROXY_TARGET ?? "http://127.0.0.1:8080",
      changeOrigin: false,
    },
  };
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_GRAPHQL_URL)],
    server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
    build: { sourcemap: false },
    test: {
      environment: "jsdom",
      restoreMocks: true,
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
