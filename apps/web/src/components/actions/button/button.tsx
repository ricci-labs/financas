import { useRender } from '@base-ui/react/use-render'
import type { ButtonContentProps, ButtonProps } from '@web/components/actions/button/button.types'
import { buttonVariants } from '@web/components/actions/button/button.variants'
import { Spinner } from '@web/components/feedback/spinner'
import { useSecondsUntil } from '@web/hooks/use-seconds-until'
import { cn } from '@web/lib/cn'
import { Clock } from 'lucide-react'
import type { MouseEvent } from 'react'

export function Button({
  render,
  variant,
  size,
  width,
  surface,
  className,
  children,
  isDisabled = false,
  onDisabledPress,
  isLoading = false,
  loadingLabel,
  waitUntil = null,
  waitLabel,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const secondsLeft = useSecondsUntil(waitUntil)
  const isWaiting = secondsLeft > 0 && waitLabel !== undefined
  const isBlocked = isDisabled || isLoading || isWaiting

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (isBlocked) {
      event.preventDefault()
      if (isDisabled && !isLoading && !isWaiting) {
        onDisabledPress?.()
      }
      return
    }
    onClick?.(event)
  }

  return useRender({
    render,
    defaultTagName: 'button',
    props: {
      ...props,
      type: render ? undefined : type,
      'data-slot': 'button',
      'data-loading': isLoading ? '' : undefined,
      'data-waiting': isWaiting && !isLoading ? '' : undefined,
      'aria-disabled': isBlocked ? true : undefined,
      'aria-busy': isLoading ? true : undefined,
      className: cn(buttonVariants({ variant, size, width, surface }), className),
      onClick: handleClick,
      children: buttonContent({
        children,
        isLoading,
        loadingLabel,
        isWaiting,
        secondsLeft,
        waitLabel,
      }),
    },
  })
}

function buttonContent({
  children,
  isLoading,
  loadingLabel,
  isWaiting,
  secondsLeft,
  waitLabel,
}: ButtonContentProps) {
  if (isLoading) {
    return (
      <>
        <Spinner size="lg" />
        {loadingLabel ?? children}
      </>
    )
  }
  if (isWaiting && waitLabel) {
    return (
      <>
        <Clock aria-hidden="true" />
        {waitLabel(secondsLeft)}
      </>
    )
  }
  return children
}
