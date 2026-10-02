import '@web/styles/globals.css'
import { toast } from 'sonner'
import { afterEach } from 'vitest'

afterEach(() => {
  toast.dismiss()
})
