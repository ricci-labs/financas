import type { IsoDate } from '@shared/calendar/calendar.types'
import { splitInstallments } from '@shared/installments/installments'
import {
  type AccountKind,
  MAX_INSTALLMENTS,
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
  effectiveOn?: IsoDate
  invoiceId?: string
  installmentNo?: number
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

type PlanOf<T extends EntryPlan['entryType']> = Extract<EntryPlan, { entryType: T }>

function findViolation(plan: EntryPlan): PostingsViolation | undefined {
  switch (plan.entryType) {
    case 'expense':
      return expenseViolation(plan)
    case 'income':
      return incomeViolation(plan)
    case 'transfer':
      return transferViolation(plan)
    case 'card_purchase':
      return cardPurchaseViolation(plan)
    case 'invoice_payment':
      return invoicePaymentViolation(plan)
    case 'opening_balance':
      return openingBalanceViolation(plan)
  }
}

function expenseViolation(plan: PlanOf<'expense'>): PostingsViolation | undefined {
  return (
    positiveAmountViolation(plan.amountCents) ??
    moneyAccountViolation(plan.paidFrom) ??
    kindViolation(plan.category, 'expense_category', 'NOT_AN_EXPENSE_CATEGORY')
  )
}

function incomeViolation(plan: PlanOf<'income'>): PostingsViolation | undefined {
  return (
    positiveAmountViolation(plan.amountCents) ??
    moneyAccountViolation(plan.receivedIn) ??
    kindViolation(plan.category, 'income_category', 'NOT_AN_INCOME_CATEGORY')
  )
}

function transferViolation(plan: PlanOf<'transfer'>): PostingsViolation | undefined {
  return (
    positiveAmountViolation(plan.amountCents) ??
    moneyAccountViolation(plan.from) ??
    moneyAccountViolation(plan.to) ??
    (plan.from.id === plan.to.id ? 'SAME_ACCOUNT' : undefined)
  )
}

function cardPurchaseViolation(plan: PlanOf<'card_purchase'>): PostingsViolation | undefined {
  return (
    positiveAmountViolation(plan.amountCents) ??
    kindViolation(plan.card, 'credit_card', 'NOT_A_CARD') ??
    kindViolation(plan.category, 'expense_category', 'NOT_AN_EXPENSE_CATEGORY') ??
    installmentsViolation(plan)
  )
}

function invoicePaymentViolation(plan: PlanOf<'invoice_payment'>): PostingsViolation | undefined {
  return (
    positiveAmountViolation(plan.amountCents) ??
    kindViolation(plan.card, 'credit_card', 'NOT_A_CARD') ??
    moneyAccountViolation(plan.paidFrom)
  )
}

function openingBalanceViolation(plan: PlanOf<'opening_balance'>): PostingsViolation | undefined {
  return (
    (isNonZeroCents(plan.balanceCents) ? undefined : 'BALANCE_IS_ZERO') ??
    moneyAccountViolation(plan.account) ??
    kindViolation(plan.openingBalanceAccount, 'opening_balance', 'NOT_THE_OPENING_BALANCE_ACCOUNT')
  )
}

function linesOf(plan: EntryPlan): Line[] {
  switch (plan.entryType) {
    case 'expense':
      return moneyMoves(plan.amountCents, plan.paidFrom, plan.category)
    case 'income':
      return moneyMoves(plan.amountCents, plan.category, plan.receivedIn)
    case 'transfer':
      return moneyMoves(plan.amountCents, plan.from, plan.to)
    case 'card_purchase':
      return cardPurchaseLines(plan)
    case 'invoice_payment':
      return [
        { account: plan.card, amountCents: plan.amountCents, invoiceId: plan.invoiceId },
        { account: plan.paidFrom, amountCents: -plan.amountCents },
      ]
    case 'opening_balance':
      return moneyMoves(plan.balanceCents, plan.openingBalanceAccount, plan.account)
  }
}

function cardPurchaseLines(plan: PlanOf<'card_purchase'>): Line[] {
  const amounts = splitInstallments(plan.amountCents, plan.installmentCount)
  const perInstallment = plan.installments.map((target, index) => {
    const installmentNo = plan.firstInstallment + index
    return { target, installmentNo, amountCents: amounts[installmentNo - 1] ?? 0 }
  })
  const cardLines = perInstallment.map(({ target, installmentNo, amountCents }) => ({
    account: plan.card,
    amountCents: -amountCents,
    effectiveOn: target.effectiveOn,
    invoiceId: target.invoiceId,
    installmentNo,
  }))
  const categoryLines = perInstallment.map(({ target, installmentNo, amountCents }) => ({
    account: plan.category,
    amountCents,
    effectiveOn: target.effectiveOn,
    installmentNo,
  }))
  return [...cardLines, ...categoryLines]
}

function moneyMoves(amountCents: Cents, from: AccountRef, to: AccountRef): Line[] {
  return [
    { account: to, amountCents },
    { account: from, amountCents: -amountCents },
  ]
}

function toDrafts(lines: Line[], occurredOn: IsoDate): PostingDraft[] {
  return lines.map((line, index) => ({
    lineNo: index + 1,
    accountId: line.account.id,
    accountKind: line.account.kind,
    amountCents: line.amountCents,
    effectiveOn: line.effectiveOn ?? occurredOn,
    invoiceId: line.invoiceId ?? null,
    installmentNo: line.installmentNo ?? null,
  }))
}

function installmentsViolation(plan: PlanOf<'card_purchase'>): PostingsViolation | undefined {
  const { amountCents, installmentCount, firstInstallment, installments } = plan
  if (installmentCount > MAX_INSTALLMENTS || installmentCount > amountCents) {
    return 'TOO_MANY_INSTALLMENTS'
  }
  if (!isInstallmentOf(firstInstallment, installmentCount)) {
    return 'FIRST_INSTALLMENT_OUT_OF_RANGE'
  }
  if (installments.length === 0) {
    return 'NO_INSTALLMENTS'
  }
  const remaining = installmentCount - firstInstallment + 1
  return installments.length === remaining ? undefined : 'INSTALLMENTS_DO_NOT_MATCH'
}

function isInstallmentOf(installmentNo: number, installmentCount: number): boolean {
  return Number.isInteger(installmentNo) && installmentNo >= 1 && installmentNo <= installmentCount
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
