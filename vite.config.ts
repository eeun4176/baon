/*
 * vite.config.ts — Build and dev-server setup for Baon.
 * - react: JSX + fast refresh
 * - tailwindcss: compiles the utility classes and design tokens in src/index.css
 * - basicSsl: serves dev over HTTPS, because service workers and Web Crypto
 *   only run on secure pages (needed when testing on a phone over Wi-Fi).
 *   Not for `npm run preview`: browsers refuse a service worker from its self-made
 *   certificate, so offline never installed; plain http://localhost counts as secure.
 * - VitePWA: generates the web app manifest and the offline service worker
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ isPreview }) => ({
  plugins: [
    react(),
    tailwindcss(),
    !isPreview && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // Off in dev: browsers refuse a service worker from the dev server's self-made certificate,
        // so it only logged errors. Test offline on the deployed site (real certificate).
        enabled: false,
      },
      workbox: {
        // Precache the app shell plus only the Nunito subsets Baon uses
        // (latin + latin-ext, which has ₱), so text looks right offline.
        globPatterns: [
          '**/*.{js,css,html,svg,png}',
          '**/nunito-latin-{600,800,900}-normal-*.woff2',
          '**/nunito-latin-ext-{600,800,900}-normal-*.woff2',
        ],
      },
      manifest: {
        name: 'Baon',
        short_name: 'Baon',
        description: 'Know what you can spend today — log your baon in seconds, even without load or Wi-Fi.',
        theme_color: '#F3F4F4', // matches the page so the phone status bar blends in
        background_color: '#F3F4F4',
        display: 'standalone',
        orientation: 'portrait',
        // Long-press the app icon on Android → "Add expense"
        shortcuts: [{ name: 'Add expense', short_name: 'Add', url: '/?add=1', icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }] }],
        // Icons are generated from the 1024px wallet logo
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // Full-bleed version Android can crop to its own shape without cutting the wallet
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true, // Exposes your HTTPS dev server to phones on the same Wi-Fi
  },
}));
