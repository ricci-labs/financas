import { StepTrack } from '@web/components/display/step-track/step-track'
import type { ComponentExamples } from '@web/lib/examples.types'

const SIGN_UP_STEPS = ['Conta criada', 'Confirmar e-mail', 'Entrar']
const PASSWORD_STEPS = ['Pedir o link', 'Abrir o e-mail', 'Nova senha']

export const stepTrackExamples: ComponentExamples = {
  component: 'StepTrack',
  examples: [
    {
      name: 'Confira seu e-mail',
      render: () => <StepTrack label="Seu cadastro" steps={SIGN_UP_STEPS} currentStep={1} />,
    },
    {
      name: 'Confirmando',
      render: () => (
        <StepTrack label="Seu cadastro" steps={SIGN_UP_STEPS} currentStep={1} isCurrentLoading />
      ),
    },
    {
      name: 'Confirmado',
      render: () => <StepTrack label="Seu cadastro" steps={SIGN_UP_STEPS} currentStep={2} />,
    },
    {
      name: 'Senha',
      render: () => (
        <StepTrack label="Etapas da troca de senha" steps={PASSWORD_STEPS} currentStep={1} />
      ),
    },
  ],
}
