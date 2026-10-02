import type { FormProps } from '@web/components/forms/form/form.types'
import type { FieldValues } from 'react-hook-form'
import { FormProvider } from 'react-hook-form'

export function Form<Input extends FieldValues, Output extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
}: FormProps<Input, Output>) {
  return (
    <FormProvider {...form}>
      <form
        noValidate
        data-slot="form"
        className={className}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {children}
      </form>
    </FormProvider>
  )
}
