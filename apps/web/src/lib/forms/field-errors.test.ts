import { credentialsSchema, newUserSchema } from '@financas/shared'
import { fieldErrorMap } from '@web/lib/forms/field-errors'
import { describe, expect, it } from 'vitest'

const REQUIRED = { email: 'Informe o e-mail.', displayName: 'Informe seu nome.' }
const options = { error: fieldErrorMap(REQUIRED) }

function messagesOf(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('fieldErrorMap', () => {
  it("uses the field's own sentence when it is empty, even after trimming", () => {
    const result = newUserSchema.safeParse({ email: '', displayName: '   ', password: '' }, options)
    expect(messagesOf(result)).toEqual({
      email: 'Informe o e-mail.',
      displayName: 'Informe seu nome.',
      password: 'Preencha este campo.',
    })
  })

  it('writes the standard sentences for length and e-mail format', () => {
    const tooShort = newUserSchema.safeParse(
      { email: 'x@', displayName: 'a'.repeat(81), password: 'curta' },
      options,
    )
    expect(messagesOf(tooShort)).toEqual({
      email: 'Informe um e-mail válido, como nome@exemplo.com.',
      displayName: 'Use no máximo 80 caracteres.',
      password: 'Use pelo menos 12 caracteres.',
    })
  })

  it('accepts what the API accepts', () => {
    const result = credentialsSchema.safeParse(
      { email: ' Member.A@Exemplo.com ', password: 'x' },
      options,
    )
    expect(result.success).toBe(true)
  })
})
