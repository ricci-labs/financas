export { invitationRoutes } from '@api/modules/onboarding/onboarding.routes'
export {
  createWorkspace,
  inviteMember,
  registerOwner,
  sendInvitationEmail,
} from '@api/modules/onboarding/onboarding.service'
export type {
  CreatedWorkspace,
  CreateWorkspaceInput,
  IssuedInvitation,
  OnboardingRouteDeps,
  RegisteredOwner,
  RegisterOwnerInput,
} from '@api/modules/onboarding/onboarding.types'
