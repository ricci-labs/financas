import { ApiError, NetworkError } from '@web/lib/api/api-error'
import { errorMessageFor, fill } from '@web/lib/errors/error-message'
import { describe, expect, it } from 'vitest'

function apiError(code: string, status: number, extra: Partial<ApiError> = {}) {
  return new ApiError({ status, code, ref: 'abcd1234', retryAfterSeconds: null, ...extra })
}

describe('errorMessageFor', () => {
  it('shows the pt-BR message of a known code, never the API message', () => {
    expect(errorMessageFor(apiError('INVALID_CREDENTIALS', 401))).toBe(
      'E-mail ou senha incorretos.',
    )
  })

  it('turns Retry-After into whole minutes', () => {
    const error = apiError('TOO_MANY_ATTEMPTS', 429, { retryAfterSeconds: 61 })
    expect(errorMessageFor(error)).toBe('Muitas tentativas. Tente de novo em 2 minutos.')
  })

  it('shows the ref of a server error, even for an unknown code', () => {
    expect(errorMessageFor(apiError('SOMETHING_NEW', 503))).toBe(
      'Algo deu errado. Tente de novo; se continuar, informe o código abcd1234.',
    )
  })

  it('falls back with the ref for an unknown client error', () => {
    expect(errorMessageFor(apiError('SOMETHING_NEW', 400))).toBe(
      'Não foi possível concluir. Código: abcd1234.',
    )
  })

  it('fills the values the screen gives', () => {
    const error = apiError('INVOICE_CLOSED', 409)
    expect(errorMessageFor(error, { mês: 'outubro', N: 3 })).toBe(
      'A fatura de outubro já fechou. Registre a partir da parcela 3.',
    )
  })

  it('says there is no connection for a network failure', () => {
    expect(errorMessageFor(new NetworkError(new TypeError('Failed to fetch')))).toBe(
      'Sem conexão. Verifique a internet e tente de novo.',
    )
  })
})

describe('fill', () => {
  it('keeps a placeholder nobody filled, so a missing value is visible', () => {
    expect(fill('Olá, {nome}!', {})).toBe('Olá, {nome}!')
  })
})
