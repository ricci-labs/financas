export type ToastAction = {
  label: string
  onPress: () => void
}

export type ToastOptions = {
  action?: ToastAction
  isPersistent?: boolean
}
