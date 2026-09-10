import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  root: "web-app",
  base: "/web-app/",
  plugins: [preact()],
  build: {
    outDir: "../web-app-dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
