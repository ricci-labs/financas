import { PasswordInput } from '@web/components/inputs/password-input/password-input'
import type { ComponentExamples } from '@web/lib/examples.types'

export const passwordInputExamples: ComponentExamples = {
  component: 'PasswordInput',
  examples: [
    { name: 'Vazio', render: () => <PasswordInput aria-label="Senha" /> },
    {
      name: 'Preenchido',
      render: () => <PasswordInput aria-label="Senha" defaultValue="café com pão de queijo" />,
    },
    {
      name: 'Com erro',
      render: () => <PasswordInput aria-label="Senha" aria-invalid defaultValue="cafe1234" />,
    },
  ],
}
