/*
 * vite.config.ts — Build and dev-server setup for Baon.
 * - react: JSX + fast refresh
 * - tailwindcss: compiles the utility classes and §12.2 tokens in src/index.css
 * - basicSsl: serves dev over HTTPS, because service workers and Web Crypto
 *   only run on secure pages (needed when testing on a phone over Wi-Fi)
 * - VitePWA: generates the web app manifest and the offline service worker
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true, // Lets you test the Service Worker during dev
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
        name: 'baon',
        short_name: 'baon',
        description: 'Know what you can spend today — log your baon in seconds, even without load or Wi-Fi.',
        theme_color: '#F3F4F4', // matches the page so the phone status bar blends in
        background_color: '#F3F4F4',
        display: 'standalone',
        orientation: 'portrait',
        // Icons are generated from the 1024px wallet logo (Design canvas → baon-icon.png)
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
});
