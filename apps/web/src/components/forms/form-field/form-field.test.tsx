import { newUserSchema } from '@financas/shared'
import { Form } from '@web/components/forms/form'
import { FormField } from '@web/components/forms/form-field/form-field'
import { SubmitButton } from '@web/components/forms/submit-button'
import { PasswordInput } from '@web/components/inputs/password-input'
import { TextInput } from '@web/components/inputs/text-input'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { fieldLabelled } from '@web/testing/fields'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

const HELP = 'Use pelo menos 12 caracteres. Uma frase fácil de lembrar funciona bem.'
const NAME_LIMIT = 80
const NEVER = new Promise<void>(() => undefined)

function SignUp({ onSubmit }: { onSubmit: (values: unknown) => void | Promise<void> }) {
  const form = useSchemaForm({
    schema: newUserSchema,
    requiredMessages: { displayName: 'Informe seu nome.', email: 'Informe seu e-mail.' },
    defaultValues: { displayName: '', email: '', password: '' },
  })
  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField name="displayName" label="Seu nome" isRequired maxLength={NAME_LIMIT}>
        {(control) => <TextInput {...control} />}
      </FormField>
      <FormField name="email" label="E-mail" isRequired>
        {(control) => <TextInput type="email" {...control} />}
      </FormField>
      <FormField name="password" label="Senha" isRequired help={HELP}>
        {(control) => <PasswordInput {...control} />}
      </FormField>
      <SubmitButton loadingLabel="Criando conta…">Criar conta</SubmitButton>
    </Form>
  )
}

async function renderSignUp(onSubmit = vi.fn()) {
  const screen = await render(<SignUp onSubmit={onSubmit} />)
  return { screen, onSubmit }
}

describe('FormField', () => {
  it('shows an error only after leaving the field, and clears it as soon as the value is valid', async () => {
    const { screen } = await renderSignUp()
    const email = fieldLabelled('E-mail')

    await email.fill('member.a@')
    await expect
      .element(screen.getByText('Informe um e-mail válido, como nome@exemplo.com.'))
      .not.toBeInTheDocument()

    await userEvent.tab()
    await expect
      .element(screen.getByText('Informe um e-mail válido, como nome@exemplo.com.'))
      .toBeVisible()
    await expect.element(email).toHaveAttribute('aria-invalid', 'true')

    await email.fill('member.a@exemplo.com')
    await expect
      .element(screen.getByText('Informe um e-mail válido, como nome@exemplo.com.'))
      .not.toBeInTheDocument()
    await expect.element(email).not.toHaveAttribute('aria-invalid')
  })

  it('still shows the error when leaving the field with a click, once the press ends', async () => {
    const { screen } = await renderSignUp()
    await fieldLabelled('E-mail').fill('member.a@')
    await fieldLabelled('Seu nome').click()

    await expect
      .element(screen.getByText('Informe um e-mail válido, como nome@exemplo.com.'))
      .toBeVisible()
    await expect.element(fieldLabelled('Seu nome')).toHaveFocus()
  })

  it('links the help text before the field and the error to it', async () => {
    await renderSignUp()
    const password = fieldLabelled('Senha')

    await expect.element(password).toHaveAccessibleDescription(HELP)
    await password.fill('curta')
    await userEvent.tab()
    await expect
      .element(password)
      .toHaveAccessibleDescription(`${HELP} Use pelo menos 12 caracteres.`)
  })

  it('marks every missing field and focuses the first when the disabled button is pressed', async () => {
    const { screen, onSubmit } = await renderSignUp()
    const button = screen.getByRole('button', { name: 'Criar conta' })

    await expect.element(button).toHaveAttribute('aria-disabled', 'true')
    await button.click({ force: true })

    await expect.element(screen.getByText('Informe seu nome.')).toBeVisible()
    await expect.element(screen.getByText('Informe seu e-mail.')).toBeVisible()
    await expect.element(fieldLabelled('Seu nome')).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sends the values the shared schema gives, and keeps the fields read-only meanwhile', async () => {
    const onSubmit = vi.fn((_values: unknown) => NEVER)
    const { screen } = await renderSignUp(onSubmit)

    await fieldLabelled('Seu nome').fill('Member A')
    await fieldLabelled('E-mail').fill('  Member.A@Exemplo.com ')
    await fieldLabelled('Senha').fill('café com pão de queijo')
    await screen.getByRole('button', { name: 'Criar conta' }).click()

    await expect.element(screen.getByRole('button', { name: 'Criando conta…' })).toBeVisible()
    await expect.element(fieldLabelled('E-mail')).toHaveAttribute('readonly')
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      displayName: 'Member A',
      email: 'member.a@exemplo.com',
      password: 'café com pão de queijo',
    })
  })

  it('counts characters once a limited field is near its limit', async () => {
    const { screen } = await renderSignUp()

    await fieldLabelled('Seu nome').fill('a'.repeat(63))
    await expect.element(screen.getByText('63/80')).not.toBeInTheDocument()
    await fieldLabelled('Seu nome').fill('a'.repeat(64))
    await expect.element(screen.getByText('64/80')).toBeVisible()
  })

  it('has no accessibility violations, with errors shown', async () => {
    const { screen } = await renderSignUp()
    await screen.getByRole('button', { name: 'Criar conta' }).click({ force: true })
    await expect.element(screen.getByText('Informe seu nome.')).toBeVisible()
    await expectNoAccessibilityViolations(screen.container)
  })
})

describe('PasswordInput', () => {
  it('shows and hides the password without taking the focus away from it', async () => {
    const { screen } = await renderSignUp()
    const password = fieldLabelled('Senha')

    await password.fill('café com pão de queijo')
    await expect.element(password).toHaveAttribute('type', 'password')

    await screen.getByRole('button', { name: 'Mostrar senha' }).click()
    await expect.element(password).toHaveAttribute('type', 'text')
    await expect.element(password).toHaveFocus()

    await screen.getByRole('button', { name: 'Ocultar senha' }).click()
    await expect.element(password).toHaveAttribute('type', 'password')
  })
})
