// ✅ FILE: client/vite.config.ts (keep this)
// Tailwind v4 plugin enabled

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 }
});