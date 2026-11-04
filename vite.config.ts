// Vite build config. base './' makes asset paths relative, so the build works under
// the GitHub Pages sub-path (https://minirunrun.github.io/CTC_MiniGame/).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
});
