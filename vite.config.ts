/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative base so the same build works at a domain root (Netlify) or a sub-path (GitHub Pages).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["apple-touch-icon.png", "favicon-32.png"],
      manifest: {
        name: "Workout Tracker: Hamstring Rehab + Strength",
        short_name: "Workouts",
        description: "Log sets, follow the hamstring rehab rules and track progress. Works offline.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FAFAF9",
        theme_color: "#312E81",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Inter: precache only the Latin subsets the UI uses, so the font works offline.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,json,webmanifest}", "**/inter-latin-wght-normal-*.woff2", "**/inter-latin-ext-wght-normal-*.woff2"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600, // recharts is ~570 kB minified; it is lazy-loaded and precached for offline
    rollupOptions: {
      output: {
        manualChunks: { charts: ["recharts"], react: ["react", "react-dom"], dexie: ["dexie", "dexie-react-hooks"] },
      },
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
