import { Button } from '@web/components/actions/button'
import { NextStepCard } from '@web/components/display/next-step-card'
import { StepTrack } from '@web/components/display/step-track'
import { MomentScreen } from '@web/components/layout/moment-screen/moment-screen'
import type { ComponentExamples } from '@web/lib/examples.types'

const SIGN_UP_STEPS = ['Conta criada', 'E-mail confirmado', 'Entrar']

export const momentScreenExamples: ComponentExamples = {
  component: 'MomentScreen',
  examples: [
    {
      name: 'Conquista (menta)',
      render: () => (
        <div className="w-full overflow-hidden rounded-lg">
          <MomentScreen
            className="min-h-200"
            tone="celebrate"
            scene="confirmed"
            title="E-mail confirmado!"
            actions={<Button width="full">Entrar</Button>}
          >
            <p>Agora é só entrar.</p>
            <StepTrack label="Seu cadastro" steps={SIGN_UP_STEPS} currentStep={2} />
            <NextStepCard>
              Depois de entrar, vocês montam o espaço do casal e já veem quanto ainda podem gastar
              no mês.
            </NextStepCard>
          </MomentScreen>
        </div>
      ),
    },
    {
      name: 'Aviso (creme)',
      render: () => (
        <div className="w-full overflow-hidden rounded-lg">
          <MomentScreen
            className="min-h-170"
            tone="calm"
            scene="linkExpired"
            title="Este link não vale mais"
            actions={<Button width="full">Entrar</Button>}
          >
            <p>Já foi usado ou expirou. Se você já confirmou, é só entrar.</p>
          </MomentScreen>
        </div>
      ),
    },
  ],
}
