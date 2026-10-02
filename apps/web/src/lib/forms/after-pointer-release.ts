const pending: (() => void)[] = []
let isPointerDown = false
let isWatching = false

export function watchPointerPresses(): void {
  if (isWatching) {
    return
  }
  isWatching = true
  window.addEventListener(
    'pointerdown',
    () => {
      isPointerDown = true
    },
    true,
  )
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
}

export function afterPointerRelease(callback: () => void): void {
  if (!isPointerDown) {
    callback()
    return
  }
  pending.push(callback)
}

function release(): void {
  isPointerDown = false
  const callbacks = pending.splice(0)
  setTimeout(() => {
    for (const callback of callbacks) {
      callback()
    }
  })
}
