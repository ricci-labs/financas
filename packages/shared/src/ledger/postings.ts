import type { IsoDate } from '@shared/calendar/calendar.types'
import {
  type AccountKind,
  MONEY_ACCOUNT_KINDS,
  type MoneyAccountKind,
} from '@shared/ledger/ledger.constants'
import type {
  AccountRef,
  EntryPlan,
  PostingDraft,
  PostingsPlan,
  PostingsViolation,
} from '@shared/ledger/postings.types'
import type { Cents } from '@shared/money/money.types'

type Line = {
  account: AccountRef
  amountCents: Cents
}

export function isMoneyAccountKind(kind: AccountKind): kind is MoneyAccountKind {
  return (MONEY_ACCOUNT_KINDS as readonly AccountKind[]).includes(kind)
}

export function planPostings(plan: EntryPlan): PostingsPlan {
  const violation = findViolation(plan)
  if (violation) {
    return { ok: false, violation }
  }
  return { ok: true, postings: toDrafts(linesOf(plan), plan.occurredOn) }
}

function findViolation(plan: EntryPlan): PostingsViolation | undefined {
  switch (plan.entryType) {
    case 'expense':
      return (
        positiveAmountViolation(plan.amountCents) ??
        moneyAccountViolation(plan.paidFrom) ??
        kindViolation(plan.category, 'expense_category', 'NOT_AN_EXPENSE_CATEGORY')
      )
    case 'income':
      return (
        positiveAmountViolation(plan.amountCents) ??
        moneyAccountViolation(plan.receivedIn) ??
        kindViolation(plan.category, 'income_category', 'NOT_AN_INCOME_CATEGORY')
      )
    case 'transfer':
      return (
        positiveAmountViolation(plan.amountCents) ??
        moneyAccountViolation(plan.from) ??
        moneyAccountViolation(plan.to) ??
        (plan.from.id === plan.to.id ? 'SAME_ACCOUNT' : undefined)
      )
    case 'opening_balance':
      return (
        (isNonZeroCents(plan.balanceCents) ? undefined : 'BALANCE_IS_ZERO') ??
        moneyAccountViolation(plan.account) ??
        kindViolation(
          plan.openingBalanceAccount,
          'opening_balance',
          'NOT_THE_OPENING_BALANCE_ACCOUNT',
        )
      )
  }
}

function linesOf(plan: EntryPlan): Line[] {
  switch (plan.entryType) {
    case 'expense':
      return moneyMoves(plan.amountCents, plan.paidFrom, plan.category)
    case 'income':
      return moneyMoves(plan.amountCents, plan.category, plan.receivedIn)
    case 'transfer':
      return moneyMoves(plan.amountCents, plan.from, plan.to)
    case 'opening_balance':
      return moneyMoves(plan.balanceCents, plan.openingBalanceAccount, plan.account)
  }
}

function moneyMoves(amountCents: Cents, from: AccountRef, to: AccountRef): Line[] {
  return [
    { account: to, amountCents },
    { account: from, amountCents: -amountCents },
  ]
}

function toDrafts(lines: Line[], effectiveOn: IsoDate): PostingDraft[] {
  return lines.map((line, index) => ({
    lineNo: index + 1,
    accountId: line.account.id,
    accountKind: line.account.kind,
    amountCents: line.amountCents,
    effectiveOn,
  }))
}

function isNonZeroCents(value: number): boolean {
  return Number.isSafeInteger(value) && value !== 0
}

function positiveAmountViolation(amountCents: number): PostingsViolation | undefined {
  return Number.isSafeInteger(amountCents) && amountCents > 0 ? undefined : 'AMOUNT_NOT_POSITIVE'
}

function moneyAccountViolation(account: AccountRef): PostingsViolation | undefined {
  return isMoneyAccountKind(account.kind) ? undefined : 'NOT_A_MONEY_ACCOUNT'
}

function kindViolation(
  account: AccountRef,
  expected: AccountKind,
  violation: PostingsViolation,
): PostingsViolation | undefined {
  return account.kind === expected ? undefined : violation
}
