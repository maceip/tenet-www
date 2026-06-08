import { defineConfig } from "@playwright/test";

const PORT = 5173;
const BASE = `http://127.0.0.1:${PORT}/tenet/`;

export default defineConfig({
  testDir: "tests",
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: BASE,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      args: ["--enable-unsafe-webgpu"],
    },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
