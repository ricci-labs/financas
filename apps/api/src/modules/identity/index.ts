export {
  createUser,
  login,
  logout,
  requestEmailVerification,
  resolveSession,
  signUp,
  verifyEmail,
} from '@api/modules/identity/identity.service'
export type {
  AccountEmailDeps,
  ActiveSession,
  EmailOnlyInput,
  IdentityDeps,
  LoginInput,
  NewUserInput,
  SignUpDeps,
  SignUpInput,
  StartedSession,
} from '@api/modules/identity/identity.types'
