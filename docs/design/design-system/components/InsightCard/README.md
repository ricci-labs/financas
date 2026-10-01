---
summary: The InsightCard component: dashboard cards in two kinds (celebratory and alert), their rules and the phrase bank for celebratory titles.
read_when: Building or changing a dashboard insight card, or writing an insight title.
updated: 2026-10-01
---

# InsightCard

A dashboard card with a short title, one sentence of explanation and, sometimes, an action. This is where Twise speaks in a light way.

**Two kinds**
- **Celebratory** (`fn-insight--celebrate`): for good moments.
  - A dashed `mint-ink` outline (2px, 4px away from the card, following the corners) that marks it as a special note.
  - An illustration from the `Ilustracoes` group (48px) on the left.
  - The title is a casual phrase, and the explanation carries the concrete data.
  - Example: "Dá pra respirar" (room to breathe) + "Vocês estão 18% abaixo do ritmo de gastos do mês."
- **Alert** (`success`, `warning`, `danger`, `info`): a Lucide icon in a `*-soft` circle in the tone color, and a direct title with no playfulness.
  - Example: "Mercado está adiantado".
  - Action on the right as a tertiary button ("Ver orçamento", "Cobrar").

**Anatomy:** a `bg-surface` card with a `border` border; title in Bricolage Grotesque 17px/700 (`--font-display`); explanation in Figtree, `ink-muted`.

**Rules**
- The dashed outline belongs only to the celebratory kind: it is what says "this is good news". Alerts never use a dashed line.
- At most **one celebratory card per screen**, and only when it is true (the numbers come from the insights API).
- The phrase never replaces the information: the explanation line always states the data.
- **Never** use a light tone for an error, an overdue bill, an over-budget category or a negative balance: those are alerts.
- No emoji. Guilt and alarm stay out too: "Mercado está adiantado", never "Você estourou!" (you blew it!).

**Phrase bank for the celebratory kind** (vary them so they do not get tiring):
- Easy month: "Dá pra respirar", "Mês tranquilo até aqui", "Tá sobrando".
- Budget on pace: "Segue assim", "No capricho".
- Bill paid or charge received: "Uma a menos!", "Pago e resolvido", "Voltou pra casa".
- Goal reached: "Chegou lá!", "Conquista desbloqueada".

**In shadcn/ui:**
- `Card` with the illustration (`<img>`) or a Lucide icon (`CircleCheck`, `TriangleAlert`, `CircleAlert`, `Info`), and a `link` `Button` for the action.
- The phrases live in the module's messages file (RNF-I18N-1).
