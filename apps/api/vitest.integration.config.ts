import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const LOCAL_ENV_FILE = '../../.env'
const isGithubActions = process.env.GITHUB_ACTIONS === 'true'

if (existsSync(LOCAL_ENV_FILE)) {
  process.loadEnvFile(LOCAL_ENV_FILE)
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    reporters: isGithubActions ? ['default', 'github-actions'] : ['default'],
  },
})
