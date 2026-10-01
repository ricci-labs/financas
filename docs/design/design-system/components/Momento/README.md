---
summary: The Momento component: full-screen journey moments with no form, in mint (achievement or wait) or cream (warning or error).
read_when: Building or changing a full-screen moment (email confirmed, check your email, expired link) or its owl transitions.
updated: 2026-10-01
---

# Momento

Momento (`MomentScreen` in apps/web) is a full screen **with no form**: a moment in the journey, not a task. A large owl in the center, a title, short text and the actions at the bottom, near the thumb.

**Two colors, each with a meaning:**
- **Mint** (`fn-moment`): achievement or waiting.
  - "E-mail confirmado!", "Confirmando seu e-mail", "Confira seu e-mail", "Vocês estão juntos no Casa!".
  - It can carry the TrilhoDePassos and the dashed next-step card (`fn-next`, the same dashed line as the celebratory InsightCard).
- **Cream** (`fn-moment--calm`, `sketch-paper`): warning or error.
  - "Este link não vale mais", "O cadastro está fechado", "Este convite expirou", "Vamos dar uma pausa".
  - No exclamation mark, no sparkle, no step track.

**Anatomy:**
1. `fn-moment__art`: the owl scene, flexible, minimum 180 px.
2. `fn-moment__body`: title in `display` with `text-wrap: balance`, text, optional step track.
3. `fn-moment__actions`: at most one primary action; the second in `outline`; hint and footer when present.
- No logo at the top.

**Desktop:** the same full screen in the same color, with everything grouped in the center:
- owl in a fixed 400 px block;
- title on one line (up to 560 px);
- actions at most 400 px wide.

**Handoff:** when the next action happens outside the app (in the email):
- the text says which button to tap in the email ("Toque em **Confirmar e-mail**…") and that the screen can be closed;
- this screen never "changes by itself" in these cases.

**Motion:**
- The scene comes in with the sequence for its kind (see Owl motion).
- When the same page changes state (e.g. "Confirmando" → "E-mail confirmado", or → "Link vencido" (expired link)):
  - the owl stays in place and the object changes;
  - the text changes in the same place;
  - if it is a warning, the background goes from mint to cream.

**In code:** a `MomentScreen` component with `tone: "celebrate" | "calm"`, `scene`, `title`, `children` and `actions`.
