import { newUserSchema } from '@financas/shared'
import { Form } from '@web/components/forms/form'
import { FormField } from '@web/components/forms/form-field/form-field'
import { SubmitButton } from '@web/components/forms/submit-button'
import { PasswordInput } from '@web/components/inputs/password-input'
import { TextInput } from '@web/components/inputs/text-input'
import type { ComponentExamples } from '@web/lib/examples.types'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'

const NAME_LIMIT = 80

function SignUpExample() {
  const form = useSchemaForm({
    schema: newUserSchema,
    requiredMessages: { displayName: 'Informe seu nome.', email: 'Informe seu e-mail.' },
    defaultValues: { displayName: '', email: '', password: '' },
  })
  return (
    <Form form={form} onSubmit={() => undefined} className="flex w-full max-w-100 flex-col gap-4">
      <FormField name="displayName" label="Seu nome" isRequired maxLength={NAME_LIMIT}>
        {(control) => <TextInput autoComplete="name" {...control} />}
      </FormField>
      <FormField name="email" label="E-mail" isRequired>
        {(control) => (
          <TextInput
            type="email"
            autoComplete="email"
            placeholder="nome@exemplo.com"
            {...control}
          />
        )}
      </FormField>
      <FormField
        name="password"
        label="Senha"
        isRequired
        help="Use pelo menos 12 caracteres. Uma frase fácil de lembrar funciona bem."
      >
        {(control) => <PasswordInput autoComplete="new-password" {...control} />}
      </FormField>
      <SubmitButton width="full" loadingLabel="Criando conta…">
        Criar conta
      </SubmitButton>
    </Form>
  )
}

export const formFieldExamples: ComponentExamples = {
  component: 'FormField',
  examples: [
    { name: 'Cadastro (saia de um campo para ver o erro)', render: () => <SignUpExample /> },
  ],
}
