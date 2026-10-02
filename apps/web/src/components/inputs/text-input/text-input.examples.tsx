import { TextInput } from '@web/components/inputs/text-input/text-input'
import type { ComponentExamples } from '@web/lib/examples.types'

export const textInputExamples: ComponentExamples = {
  component: 'TextInput',
  examples: [
    {
      name: 'Vazio',
      render: () => <TextInput aria-label="E-mail" placeholder="nome@exemplo.com" />,
    },
    {
      name: 'Preenchido',
      render: () => <TextInput aria-label="E-mail" defaultValue="member.a@exemplo.com" />,
    },
    {
      name: 'Com erro',
      render: () => <TextInput aria-label="E-mail" aria-invalid defaultValue="member.a@" />,
    },
    {
      name: 'Só leitura',
      render: () => <TextInput aria-label="E-mail" readOnly defaultValue="member.b@exemplo.com" />,
    },
    {
      name: 'Desativado',
      render: () => <TextInput aria-label="E-mail" disabled defaultValue="member.a@exemplo.com" />,
    },
  ],
}
