/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// Nom du repo GitHub : l'app est servie sur https://<user>.github.io/<repo>/
const base = process.env.VITE_BASE ?? '/vadrouille/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vadrouille — carnet de voyage partagé',
        short_name: 'Vadrouille',
        description: 'Planifiez vos voyages à plusieurs : planning, carte, réservations et budget.',
        lang: 'fr',
        theme_color: '#1f6f8b',
        background_color: '#faf6ef',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // tuiles OSM : cache-first, pour revoir la carte hors ligne
            urlPattern: /^https:\/\/(([a-d]\.)?basemaps\.cartocdn\.com|tile\.openstreetmap\.org|server\.arcgisonline\.com)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // fichiers du Storage Supabase (couvertures, avatars)
            urlPattern: /\/storage\/v1\/object\/public\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'supabase-public', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // découpage par fournisseur : meilleur cache navigateur entre deux déploiements
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          data: ['@tanstack/react-query', '@tanstack/react-query-persist-client', '@tanstack/query-sync-storage-persister', 'zod', 'react-hook-form'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
