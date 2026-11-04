// Vite build config. base './' makes asset paths relative, so the build works under
// the GitHub Pages sub-path (https://minirunrun.github.io/CTC_MiniGame/).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // Pre-bundle these up front. Otherwise Vite discovers them mid-session and the dev page can load
  // two copies of React ("Invalid hook call"). If that happens anyway: stop the dev server,
  // delete node_modules/.vite, start again.
  optimizeDeps: {
    include: ["react", "react-dom/client", "three", "@react-three/fiber", "@react-three/drei", "zustand",
      "three/addons/utils/BufferGeometryUtils.js"],
  },
});
