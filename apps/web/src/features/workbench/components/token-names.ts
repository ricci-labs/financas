import type { TokenNames } from '@web/features/workbench/workbench.types'
import { semanticRoleNames, themeUtilityNames } from '@web/lib/tokens'

export function tokenNames(): TokenNames {
  const theme = themeUtilityNames()
  return {
    colors: semanticRoleNames(),
    typeStyles: theme.text,
    radius: theme.radius,
    shadows: theme.shadow,
  }
}
