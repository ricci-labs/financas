import { systemClock } from '@api/core/clock'
import { OWASP_PASSWORD_COST } from '@api/core/security/passwords'
import type { IdentityDeps } from '@api/modules/identity/identity.types'

const DEFAULT_DEPS: IdentityDeps = {
  clock: systemClock,
  passwordCost: OWASP_PASSWORD_COST,
}

export function withDefaults(deps: Partial<IdentityDeps>): IdentityDeps {
  return { ...DEFAULT_DEPS, ...deps }
}
