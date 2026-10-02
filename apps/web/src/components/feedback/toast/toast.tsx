import type { ToastOptions } from '@web/components/feedback/toast/toast.types'
import { toastActionVariants, toastVariants } from '@web/components/feedback/toast/toast.variants'
import { useMediaQuery } from '@web/hooks/use-media-query'
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'

const DESKTOP_QUERY = '(min-width: 64rem)'
const TOAST_DURATION_MS = 4000
const UNDO_DURATION_MS = 8000

export function Toaster() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  return <SonnerToaster position={isDesktop ? 'top-right' : 'bottom-center'} />
}

export function showToast(message: string, { action }: ToastOptions = {}) {
  sonnerToast.custom(
    (id) => (
      <div data-slot="toast" className={toastVariants()}>
        <p>{message}</p>
        {action && (
          <button
            type="button"
            className={toastActionVariants()}
            onClick={() => {
              action.onPress()
              sonnerToast.dismiss(id)
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    ),
    { id: message, duration: action ? UNDO_DURATION_MS : TOAST_DURATION_MS },
  )
}
