import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";
import { devApi } from "./dev/apiPlugin";
import { setupPage } from "./dev/setupPlugin";

// SINGLE=1 produces one self-contained index.html (for sharing as a static file)
export default defineConfig(({ mode }) => {
  // Make .env.local values available to the /api functions during local dev.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

  return {
    base: process.env.SINGLE ? "./" : "/",
    server: { host: "127.0.0.1", port: Number(process.env.PORT) || 5173 },
    plugins: [react(), setupPage(), devApi(), process.env.SINGLE ? viteSingleFile() : null].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    build: { outDir: process.env.SINGLE ? "dist-single" : "dist", chunkSizeWarningLimit: 2000 },
  };
});
