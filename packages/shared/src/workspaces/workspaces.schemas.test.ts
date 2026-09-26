import { workspaceSettingsChangeSchema } from '@shared/workspaces/workspaces.schemas'
import { describe, expect, it } from 'vitest'

describe('workspaceSettingsChangeSchema', () => {
  it('accepts each kind of financial period with a value that fits it', () => {
    const valid = [
      { periodAnchor: 'calendar_month' },
      { periodAnchor: 'calendar_month', periodAnchorValue: null },
      { periodAnchor: 'day_of_month', periodAnchorValue: 5 },
      { periodAnchor: 'nth_business_day', periodAnchorValue: 5 },
    ]
    for (const change of valid) {
      expect(workspaceSettingsChangeSchema.safeParse(change).success).toBe(true)
    }
  })

  it('refuses a period value that does not fit, or comes without its anchor', () => {
    const invalid = [
      { periodAnchor: 'day_of_month' },
      { periodAnchor: 'day_of_month', periodAnchorValue: 32 },
      { periodAnchor: 'nth_business_day', periodAnchorValue: 11 },
      { periodAnchor: 'calendar_month', periodAnchorValue: 5 },
      { periodAnchorValue: 5 },
    ]
    for (const change of invalid) {
      expect(workspaceSettingsChangeSchema.safeParse(change).success).toBe(false)
    }
  })

  it('checks the time zone, currency and locale formats', () => {
    expect(workspaceSettingsChangeSchema.safeParse({ timezone: 'America/Sao_Paulo' }).success).toBe(
      true,
    )
    expect(workspaceSettingsChangeSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(
      false,
    )
    expect(workspaceSettingsChangeSchema.safeParse({ currency: 'brl' }).success).toBe(false)
    expect(workspaceSettingsChangeSchema.safeParse({ locale: 'pt_BR' }).success).toBe(false)
  })

  it('refuses an empty change and unknown fields', () => {
    expect(workspaceSettingsChangeSchema.safeParse({}).success).toBe(false)
    expect(workspaceSettingsChangeSchema.safeParse({ pixReceivingKey: 'x' }).success).toBe(false)
  })
})
