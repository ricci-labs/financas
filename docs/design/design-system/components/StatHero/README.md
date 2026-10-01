---
summary: The StatHero component: the "Livre para gastar" (free to spend) card at the center of the home screen.
read_when: Building or changing the free-to-spend card, its negative state or its loading skeleton.
updated: 2026-10-01
---

# StatHero

The "Livre para gastar" (free to spend) card: the answer to "how much can we still spend?" and the center of the home screen.

`mint` background, `on-mint` text, `radius-xl`. It contains:
- the label;
- the value in `amount-hero` (Bricolage Grotesque);
- a pill with the per-day value (`on-mint` background, `mint` text) and the period range ("5 out – 4 nov");
- optionally, the breakdown "Renda fixa · Gasto · Comprometido" (fixed income · spent · committed).
- A drawn illustration can sit in the bottom-right corner (decorative, `alt=""`).
- The light comment about the month ("Dá pra respirar") does not go here: it goes in the celebratory InsightCard right below.

**When the value goes negative:** switch the background to `danger-soft` and the value to `danger` with "−", and show a danger Insight right below.

**Loading:** the same shape as a skeleton (`bg-sunken`), never a full-screen spinner.

**In shadcn/ui:** a `Card` with the `fn-hero` classes; the value uses the Amount component in `hero`. The "?" next to "Livre para gastar" is a `Popover` that explains the term.
