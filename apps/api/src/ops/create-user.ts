import { loadEnv } from '@api/core/config/env'
import { createDatabase } from '@api/core/db/client'
import { AppError } from '@api/core/http/errors'
import { registerOwner } from '@api/modules/onboarding'
import { openTerminal, type Terminal } from '@api/ops/terminal'
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
  terminal.say('Criar usuário (e-mail já verificado) e o primeiro workspace dele.')
  const answers = await askOwnerDetails(terminal)
  const { userId, workspaceId } = await registerOwner(database.db, answers)
  terminal.say(`Usuário ${userId} criado, dono do workspace ${workspaceId}.`)
} catch (error) {
  process.exitCode = FAILURE_EXIT_CODE
  terminal.say(`Não foi possível criar: ${describeFailure(error)}`)
} finally {
  terminal.close()
  await database.close()
}

async function askOwnerDetails(terminal: Terminal) {
  const email = await terminal.ask('E-mail: ')
  const displayName = await terminal.ask('Nome: ')
  const workspaceName = await terminal.ask('Nome do primeiro workspace: ')
  const password = await terminal.askSecret(`Senha (mínimo ${PASSWORD_MIN_LENGTH} caracteres): `)
  const confirmation = await terminal.askSecret('Repita a senha: ')
  if (password !== confirmation) {
    throw new Error('as senhas não conferem')
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
