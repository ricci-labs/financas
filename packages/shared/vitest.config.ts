import { defineConfig } from 'vitest/config'

const isGithubActions = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    reporters: isGithubActions ? ['default', 'github-actions'] : ['default'],
  },
})
