export {
  createAccountEmailLimits,
  createLoginLimits,
  limitInvalidLinks,
} from '@api/modules/identity/identity.middleware'
export { identityRoutes, PUBLIC_AUTH_ROUTES } from '@api/modules/identity/identity.routes'
export {
  createUser,
  getAccount,
  login,
  logout,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  resolveSession,
  signUp,
  verifyEmail,
} from '@api/modules/identity/identity.service'
export type {
  AccountEmailDeps,
  AccountEmailLimits,
  ActiveSession,
  EmailOnlyInput,
  IdentityDeps,
  IdentityRouteDeps,
  LinkLimitDeps,
  LoginInput,
  LoginLimits,
  NewUserInput,
  ResetPasswordInput,
  SignUpDeps,
  SignUpInput,
  StartedSession,
} from '@api/modules/identity/identity.types'
