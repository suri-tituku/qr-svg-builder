import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/qr-svg-builder/", // ⚠️ must match repo name
});
