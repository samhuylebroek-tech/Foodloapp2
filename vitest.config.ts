// Aparte testconfiguratie: bewust NIET via @lovable.dev/vite-tanstack-config,
// zodat tests geen TanStack Start/nitro-plugins of omgevingsvariabelen laden.
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
    // Tests mogen nooit echte netwerk- of databaseverbindingen maken.
    env: { SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", LOVABLE_API_KEY: "" },
  },
});
