import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    main: 'src/main.ts',
    'ops/create-user': 'src/ops/create-user.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  dts: false,
  noExternal: ['@financas/shared'],
})
