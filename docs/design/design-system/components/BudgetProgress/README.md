---
summary: The BudgetProgress component: a per-category budget bar with a pace marker and three states.
read_when: Building or changing a budget bar, its pace marker or its states.
updated: 2026-10-01
---

# BudgetProgress

A budget bar per category, with a pace marker and three states.

**Anatomy:**
- Category name and "R$ gasto de R$ limite" (spent of limit; tabular, `ink-muted`).
- A 10px bar in `bg-sunken` with a fill.
- An `ink` tick marking where spending should be today (the pace).
- A note with an icon and a word below.

**States:**
- On pace → `mint` fill.
- Ahead of pace → `warning-fill`, note in `warning`.
- Over budget → `danger`, note in `danger` saying how much it went over.
- The word and the icon always go with the color.

**Accessibility:** `role="img"` with an `aria-label` describing the percentage and the state.

**In shadcn/ui:** `Progress` with the indicator color per state, and an absolutely positioned pace marker on top.
