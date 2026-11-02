import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (asset) =>
          // Hostinger serves .mjs assets as text/plain. Keep PDF.js's module
          // worker intact, but publish it as .js so it gets a JavaScript MIME type.
          asset.names.some((name) => name === "pdf.worker.min.mjs")
            ? "assets/[name]-[hash].js"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
});
