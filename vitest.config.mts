import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Deliberately scoped to pure/testable logic (see src/**\/*.test.ts) — most
 * of the codebase talks directly to Postgres via Drizzle, and there's no
 * test database wired up yet. These tests cover the functions that don't
 * need one: cost estimation, ignore-rule matching, role checks, alert
 * channel gating, and small formatting helpers. A real integration suite
 * against a throwaway Postgres instance is a good next step, not done here.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
