import { configDefaults, defineConfig } from 'vitest/config'

const isGithubActions = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    reporters: isGithubActions ? ['default', 'github-actions'] : ['default'],
  },
})
