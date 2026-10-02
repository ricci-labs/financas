export function backgroundOfClass(className: string): string {
  const probe = document.createElement('div')
  probe.className = className
  document.body.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}
