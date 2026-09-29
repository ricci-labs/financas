---
summary: Brief for the design system to create in Claude Design before any screen — tone, tokens, the component list with every state, and the finance-specific patterns the screens need.
read_when: Creating or changing the design system, or adding a component a screen needs.
updated: 2026-09-29
---

# Design system brief

Hand this file to Claude Design together with `ui-standards.md` and `non-functional.md` →
Accessibility and Responsiveness. Ask for tokens and components only, each shown in every state
listed. No screens yet.

## Tone
Calm, clear and trustworthy, like a good bank app, not a game. Friendly pt-BR copy, short
sentences. Numbers are the heroes; decoration stays out of their way.

## Foundations (tokens)
- **Colour:** neutral base; one brand colour for primary actions; **semantic colours** with light
  and dark variants and AA contrast:
  - income / money in, expense / money out, transfer / neutral;
  - success, warning, danger, info (for insights and messages);
  - statuses: pending, overdue, paid, partially paid, cancelled, skipped, matched.
- **Typography:** one family with **tabular numbers** for amounts; a scale from caption to the big
  "livre para gastar" figure.
- **Spacing, radius, elevation, borders:** a small scale (4 px base).
- **Motion:** short and optional (respects reduced motion).
- **Themes:** light and dark.
- **Breakpoints:** 360 (base), 768, 1024, 1280.

## Components, with every state
Each in: default, hover, focus, pressed, disabled, loading (where it acts), error (where it takes
input), and mobile and desktop sizes.

**Actions:** button (primary, secondary, tertiary/link, danger; with icon; icon-only), floating
action button ("Novo lançamento"), menu of actions (kebab), segmented control.

**Inputs:** text field; password with show/hide; email; phone (+55); search; textarea with counter;
**money input** (R$ prefix, pt-BR decimal); **date picker** (dd/mm/aaaa, "Hoje"); **period picker**
(arrows + range label); select; **combobox with search** (accounts, categories, contacts);
**category picker** (tree: parent › child, with colour and icon); checkbox; radio; switch; **day of
month picker** (1–31); **installments stepper** (1–N with the amount per installment); file upload
(drag and drop + camera on mobile; shows type and size limits).

**Form parts:** field wrapper (label, "*" for required, help text, error with icon, counter),
form-level error summary, sticky form footer with the actions on mobile.

**Feedback:** toast (with "Desfazer"), inline alert (info, success, warning, danger), banner
(offline, read-only), confirmation dialog (with a destructive confirm), empty state
(illustration optional, sentence, action), skeletons, error state with `ref` and "Tentar de novo".

**Display:** **amount** (sign, colour, size variants), **status badge**, avatar/initials (members,
contacts), list item with leading icon, trailing amount and secondary line, card, stat card (label,
big number, trend or note), **progress bar with thresholds** (budget pace: on track, ahead,
over), tabs, accordion, table (desktop) that becomes a list (mobile), pagination / "Carregar mais",
tooltip, help popover ("?" next to finance terms), chips for filters.

**Charts:** bar (month by month), line/area (balance forecast with a zero line), donut (spent by
category); each with a text alternative.

**Navigation:** mobile bottom bar (5 items + the floating button), desktop sidebar, top bar with
the workspace switcher, back navigation, breadcrumb (desktop).

## Finance patterns the screens rely on
- **Stat hero:** "Livre para gastar" with the per-day value and the period range under it.
- **Insight card:** severity colour + icon, a one-line message, an optional action ("Ver
  orçamento").
- **Invoice card:** card name, status, closing and due dates, total, own vs fronted split.
- **Entry row:** date, description, category chip, account or card, installment "3/10", amount
  with sign, attachment and shared indicators.
- **Occurrence row:** due date (overdue in danger), description, expected amount (estimate marked
  "≈"), status, quick actions.
- **Contact row:** name, owed amount, overdue amount, next due date.
- **Charge preview:** the pt-BR message as the contact will read it, the Pix "copia e cola" with a
  copy button, and "Enviar pelo WhatsApp".
- **Amount split editor:** shares for contacts on an expense (who owes how much, what remains
  yours), with the sum checked live.

## What the first validation screen proves
`AUTH-01` (log in) must show, using only these components: the fields with labels and errors, the
password toggle, the primary button in its loading state, a form-level error ("E-mail ou senha
incorretos."), the lock-out message (429), and the offline banner. If it looks right there, the
system is ready for `HOME-01`.
