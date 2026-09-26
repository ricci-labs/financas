import {
  BUDGET_BASES,
  INSTALLMENT_BUDGET_VIEWS,
  MAX_ANCHOR_BUSINESS_DAY,
  MAX_ANCHOR_DAY_OF_MONTH,
  PERIOD_ANCHORS,
} from '@shared/workspaces/workspaces.constants'
import { z } from 'zod'

export const WORKSPACE_NAME_MAX_LENGTH = 80

export const workspaceNameSchema = z.string().trim().min(1).max(WORKSPACE_NAME_MAX_LENGTH)

export const workspaceIdSchema = z.uuid()

export const workspaceNameRequestSchema = z.object({ name: workspaceNameSchema })

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

function hasAnyField(change: object): boolean {
  return Object.values(change).some((value) => value !== undefined)
}

function anchorValueFits({
  periodAnchor,
  periodAnchorValue,
}: {
  periodAnchor?: string
  periodAnchorValue?: number | null
}): boolean {
  if (periodAnchor === undefined) {
    return periodAnchorValue === undefined
  }
  if (periodAnchor === 'calendar_month') {
    return periodAnchorValue === undefined || periodAnchorValue === null
  }
  const maxValue =
    periodAnchor === 'day_of_month' ? MAX_ANCHOR_DAY_OF_MONTH : MAX_ANCHOR_BUSINESS_DAY
  return typeof periodAnchorValue === 'number' && periodAnchorValue <= maxValue
}

export const workspaceSettingsChangeSchema = z
  .object({
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    timezone: z.string().refine(isTimeZone, 'Unknown time zone').optional(),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .optional(),
    periodAnchor: z.enum(PERIOD_ANCHORS).optional(),
    periodAnchorValue: z.number().int().min(1).nullable().optional(),
    installmentBudgetView: z.enum(INSTALLMENT_BUDGET_VIEWS).optional(),
    budgetBase: z.enum(BUDGET_BASES).optional(),
    weekStartsOn: z.number().int().min(0).max(6).optional(),
  })
  .strict()
  .refine(hasAnyField, { message: 'Nothing to change' })
  .refine(anchorValueFits, {
    message: 'Send periodAnchor with a value that fits it',
    path: ['periodAnchorValue'],
  })

export type WorkspaceNameRequest = z.infer<typeof workspaceNameRequestSchema>
export type WorkspaceSettingsChange = z.infer<typeof workspaceSettingsChangeSchema>
