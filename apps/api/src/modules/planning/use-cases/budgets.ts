import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { parseOrThrow, ValidationError } from '@api/core/http/errors'
import { auditCreation, audited } from '@api/modules/audit'
import { loadUsableAccounts } from '@api/modules/ledger'
import {
  budgetLineAuditTarget,
  selectActiveBudgetLineId,
  selectBudgetsEffectiveOn,
  upsertBudgetLine,
} from '@api/modules/planning/planning.repository'
import type { BudgetItem, BudgetRef } from '@api/modules/planning/planning.types'
import { budgetChangeSchema, type FactBudget } from '@financas/shared'

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

export async function readBudgetFacts(
  tx: WorkspaceTransaction,
  periodLabel: string,
): Promise<FactBudget[]> {
  return (await selectBudgetsEffectiveOn(tx, firstDayOf(periodLabel))).map(
    ({ categoryAccountId, limitCents }) => ({ categoryAccountId, limitCents }),
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
    const line = { workspaceId, categoryAccountId, validFrom: firstDayOf(fromPeriod), limitCents }
    const existingId = await selectActiveBudgetLineId(tx, categoryAccountId, line.validFrom)
    if (existingId) {
      await audited(tx, budgetLineAuditTarget(workspaceId, existingId), 'update', () =>
        upsertBudgetLine(tx, line),
      )
      return
    }
    await auditCreation(tx, budgetLineAuditTarget(workspaceId, await upsertBudgetLine(tx, line)))
  })
}

function firstDayOf(yearMonth: string): string {
  return `${yearMonth}-01`
}
