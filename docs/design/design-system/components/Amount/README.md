---
summary: The Amount component: a BRL value with sign, color and size, and its formatting rules.
read_when: Displaying or formatting any money value, or changing the Amount component.
updated: 2026-10-01
---

# Amount

A value in reais with sign, color and size. It is the most important element in the app.

**Types:**
- `income`: text in `income`, always with "+".
- `expense`: in `ink` with "−" in lists. `--colored` uses `expense` where the comparison matters, such as the month total.
- `transfer`: in `transfer`, no sign.
- The sign always shows: color is never the only cue.

**Sizes:**
- `sm` (`amount-sm`)
- `md` (`amount`)
- `lg` (`amount-lg`)
- `hero` (`amount-hero`): only in "Livre para gastar" (free to spend), with smaller cents in `fn-amount__cents`.

**Estimate:** prefix "≈" in `ink-muted` for forecast values.

**Rules:**
- Always tabular numbers (`font-variant-numeric: tabular-nums`).
- Format `R$ 1.234,56`.
- The minus sign is "−" (U+2212), not a hyphen.
- Never wraps.

**In shadcn/ui:** there is none. It is a custom component (`components/amount.tsx`) that takes cents and the type (income, expense, transfer) and formats with `formatBrl`.
