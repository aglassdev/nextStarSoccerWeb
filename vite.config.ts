import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { seoPages } from './seoPages'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      // Compress all raster images at build time
      png:  { quality: 80 },
      jpeg: { quality: 80 },
      jpg:  { quality: 80 },
      webp: { lossless: false, quality: 80 },
      // Also process images copied from /public
      includePublic: true,
      // Leave the tab icons alone: the SVG optimizer drops favicon.svg's
      // white ball (hidden until dark mode), which left dark browsers with
      // no icon. They're a few KB anyway.
      exclude: /favicon/,
    }),
    // Each public page's own HTML (title, description, canonical) and sitemap.xml
    seoPages(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
})
