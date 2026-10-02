import { RichText } from '@web/components/display/rich-text/rich-text'
import type { ComponentExamples } from '@web/lib/examples.types'

export const richTextExamples: ComponentExamples = {
  component: 'RichText',
  examples: [
    {
      name: 'Com valor e negrito',
      render: () => (
        <p className="text-body">
          <RichText
            text="Enviamos um e-mail para **{email}**. Toque em **Confirmar e-mail** e o Twise abre em outra página."
            values={{ email: 'member.a@exemplo.com' }}
          />
        </p>
      ),
    },
  ],
}
