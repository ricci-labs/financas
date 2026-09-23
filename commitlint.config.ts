import type { UserConfig } from '@commitlint/types'

const scopes = [
  'api',
  'web',
  'shared',
  'db',
  'agent',
  'whatsapp',
  'jobs',
  'obs',
  'identity',
  'workspaces',
  'ledger',
  'cards',
  'contacts',
  'planning',
  'attachments',
  'notifications',
  'reports',
  'docs',
  'adr',
  'ci',
  'deps',
  'claude',
]

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', scopes],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [1, 'always', 100],
  },
}

export default config
