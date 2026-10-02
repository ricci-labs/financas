import type { TextInputProps } from '@web/components/inputs/text-input/text-input.types'
import {
  inputBoxVariants,
  inputVariants,
} from '@web/components/inputs/text-input/text-input.variants'
import { cn } from '@web/lib/cn'

const MASKED_TYPE = 'password'

export function TextInput({ endAdornment, className, type = 'text', ...props }: TextInputProps) {
  return (
    <div data-slot="text-input" className={cn(inputBoxVariants(), className)}>
      <input type={type} className={inputVariants({ isMasked: type === MASKED_TYPE })} {...props} />
      {endAdornment}
    </div>
  )
}
