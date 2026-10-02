import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_DEV_SERVER = 'http://localhost:3100'

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    proxy: { '/api': API_DEV_SERVER },
  },
})
