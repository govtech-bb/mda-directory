import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://govtech-bb.github.io/mda-directory/ on GitHub Pages,
// so assets are referenced under that repo sub-path.
export default defineConfig({
  base: "/mda-directory/",
  plugins: [react()],
});
