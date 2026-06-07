import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served under https://public.computer/tenet/ — base must match the subpath
  // so emitted asset URLs resolve (root "/" redirects here on the host).
  base: "/tenet/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
