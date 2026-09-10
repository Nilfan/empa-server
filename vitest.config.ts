import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    fileParallelism: false,
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/EmpaTestDB",
    },
  },
});
