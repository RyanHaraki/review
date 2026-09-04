import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rendererRoot = fileURLToPath(new URL("../renderer", import.meta.url));
const rendererOut = fileURLToPath(new URL("./out/renderer", import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      rollupOptions: {
        output: {
          entryFileNames: "index.cjs",
          format: "cjs",
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: rendererRoot,
    resolve: {
      alias: {
        "@": join(rendererRoot, "src"),
      },
    },
    build: {
      outDir: rendererOut,
      rollupOptions: {
        input: join(rendererRoot, "index.html"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
