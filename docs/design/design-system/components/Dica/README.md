---
summary: The Dica component: a short, centered help line with an icon for when something does not happen as expected.
read_when: Adding a calm help hint to a screen, or deciding between Dica, Alert and TextField help.
updated: 2026-10-01
---

# Dica

Dica (`Tip` in apps/web) is a short, centered help line with an icon. It says what the person can do if something does not happen as expected.

**Use:**
- "Confira seu e-mail" (check your email) screens ("Não chegou? Olhe o spam e a aba Promoções.") and calm messages of the same kind.
- One per screen, right above the actions.
- It inherits the background's color: `ink-muted` on white, `on-mint` on mint.

**Do not use** for an error (that is Alert) or to explain a field (that is the TextField help).

**In shadcn/ui:** there is no ready-made piece. It is a `<p>` with the `Info` icon from `lucide-react`.
