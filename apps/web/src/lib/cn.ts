import { themeUtilityNames } from '@web/lib/tokens'
import { createCn } from 'cn/config'

export const cn = createCn({ extend: { theme: themeUtilityNames() } })
