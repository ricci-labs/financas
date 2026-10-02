import { passwordInputMessages } from '@web/components/inputs/password-input/password-input.messages'
import type { PasswordInputProps } from '@web/components/inputs/password-input/password-input.types'
import { passwordToggleVariants } from '@web/components/inputs/password-input/password-input.variants'
import { TextInput } from '@web/components/inputs/text-input'
import { Eye, EyeOff } from 'lucide-react'
import { type MouseEvent, useState } from 'react'

export function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  const label = isVisible ? passwordInputMessages.hide : passwordInputMessages.show

  function keepFocusOnTheField(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  return (
    <TextInput
      {...props}
      type={isVisible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          data-slot="password-toggle"
          className={passwordToggleVariants()}
          onMouseDown={keepFocusOnTheField}
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {label}
          <span className="sr-only">{` ${passwordInputMessages.target}`}</span>
        </button>
      }
    />
  )
}
