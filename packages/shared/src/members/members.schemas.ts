import { z } from 'zod'

export const MAX_NOTIFY_DAYS_BEFORE = 30

export const membershipPreferencesChangeSchema = z
  .strictObject({
    notifyBillsDaysBefore: z.number().int().min(0).max(MAX_NOTIFY_DAYS_BEFORE),
    notifyChannel: z.enum(['whatsapp', 'email']),
    notifyDailyDigest: z.boolean(),
    notifyBudgetThresholdPct: z.number().int().min(1).max(100),
    notifyVariableIncome: z.boolean(),
  })
  .partial()
  .refine((change) => Object.keys(change).length > 0, { message: 'Nothing to change' })

export type MembershipPreferencesChange = z.infer<typeof membershipPreferencesChangeSchema>
