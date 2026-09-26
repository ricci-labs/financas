import type { Database } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { parseOrThrow, ValidationError } from '@api/core/http/errors'
import { loadUsableAccounts } from '@api/modules/ledger'
import {
  selectBudgetsEffectiveOn,
  upsertBudgetLine,
} from '@api/modules/planning/planning.repository'
import type { BudgetItem, BudgetRef } from '@api/modules/planning/planning.types'
import { budgetChangeSchema } from '@financas/shared'

const YEAR_MONTH_LENGTH = 7

export function listBudgets(
  db: Database,
  workspaceId: string,
  period: string,
): Promise<BudgetItem[]> {
  return withWorkspace(db, workspaceId, async (tx) =>
    (await selectBudgetsEffectiveOn(tx, firstDayOf(period))).map((line) => ({
      ...line,
      validFrom: line.validFrom.slice(0, YEAR_MONTH_LENGTH),
    })),
  )
}

export async function setBudget(
  db: Database,
  { workspaceId, categoryAccountId }: BudgetRef,
  rawChange: unknown,
): Promise<void> {
  const { limitCents, fromPeriod } = parseOrThrow(budgetChangeSchema, rawChange, 'BUDGET_INVALID')
  await withWorkspace(db, workspaceId, async (tx) => {
    const category = (await loadUsableAccounts(tx, [categoryAccountId])).get(categoryAccountId)
    if (category?.kind !== 'expense_category') {
      throw new ValidationError('BUDGET_CATEGORY_INVALID', 'Budgets are set on expense categories')
    }
    await upsertBudgetLine(tx, {
      workspaceId,
      categoryAccountId,
      validFrom: firstDayOf(fromPeriod),
      limitCents,
    })
  })
}

function firstDayOf(yearMonth: string): string {
  return `${yearMonth}-01`
}
