import { loadEnv } from '@api/core/config/env'
import { createDatabase } from '@api/core/db/client'
import { AppError } from '@api/core/http/errors'
import { registerOwner } from '@api/modules/onboarding'
import type { Terminal } from '@api/ops/ops.types'
import { openTerminal } from '@api/ops/terminal'
import { PASSWORD_MIN_LENGTH } from '@financas/shared'

const FAILURE_EXIT_CODE = 1

const env = loadEnv()
const database = createDatabase(env.DATABASE_URL, {
  onConnectionError: (error) => {
    throw error
  },
})
const terminal = openTerminal()

try {
  terminal.say('Create a user (email already verified) who owns a new workspace.')
  const answers = await askOwnerDetails(terminal)
  const { userId, workspaceId } = await registerOwner(database.db, answers)
  terminal.say(`Created user ${userId}, owner of workspace ${workspaceId}.`)
} catch (error) {
  process.exitCode = FAILURE_EXIT_CODE
  terminal.say(`Could not create the user: ${describeFailure(error)}`)
} finally {
  terminal.close()
  await database.close()
}

async function askOwnerDetails(terminal: Terminal) {
  const email = await terminal.ask('Email: ')
  const displayName = await terminal.ask('Display name: ')
  const workspaceName = await terminal.ask('First workspace name: ')
  const password = await terminal.askSecret(
    `Password (at least ${PASSWORD_MIN_LENGTH} characters): `,
  )
  const confirmation = await terminal.askSecret('Repeat the password: ')
  if (password !== confirmation) {
    throw new Error('the passwords do not match')
  }
  return { email, displayName, workspaceName, password }
}

function describeFailure(error: unknown): string {
  if (error instanceof AppError) {
    return `${error.code} (${error.message})`
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
