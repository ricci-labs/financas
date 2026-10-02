import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readThemeValues, resolveColor } from '../../scripts/tokens/semantic-tokens.mjs'

const API_DEV_SERVER = 'http://localhost:3100'
const TOKENS_FILE = fileURLToPath(new URL('./src/styles/tokens/semantic.css', import.meta.url))
const MINT = resolveColor(readThemeValues(TOKENS_FILE).light, 'mint')
const API_PATHS = /^\/api\//

const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    name: 'Twise',
    short_name: 'Twise',
    description: 'Leve, claro, a dois.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: MINT,
    theme_color: MINT,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
    globIgnores: ['email/**'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [API_PATHS],
    cleanupOutdatedCaches: true,
  },
})

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    pwa,
  ],
  resolve: { tsconfigPaths: true },
  build: { manifest: true },
  server: {
    proxy: { '/api': API_DEV_SERVER },
  },
})
