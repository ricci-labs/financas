---
summary: The EmailConta template for account emails: anatomy, owl scene per email, rules and the renderEmail changes it needs.
read_when: Building or changing an account email (confirmation, password reset, invite) or the renderEmail template.
updated: 2026-10-01
---

# EmailConta

The template for the account emails: confirm your email, you already have an account, reset your password, your password was changed, and invite.

**Anatomy** (top to bottom):
1. Subject and sender "Twise".
2. Logo (icon + "twise").
3. White card up to 520 px wide, with:
   1. A `mint` strip with the owl scene from the same flow as the screen.
   2. Greeting ("Olá, Member A!").
   3. **A title that is the action** ("Confirme seu e-mail").
   4. One or two paragraphs.
   5. A black pill button with the same name the screen mentions ("Confirmar e-mail", "Criar nova senha").
   6. The link address as text, for when the button does not open.
   7. Notes in `ink-muted` (expiry, "se não foi você, ignore" (if it was not you, ignore this)).
4. Footer with the slogan and the reason for the email.

**Scenes per email:**
- Envelope: confirm email.
- Welcome: already has an account.
- Key: reset password.
- Padlock: password changed, a security notice, no sparkle.
- Invite card: invite.

**Rules:**
- Always light theme.
- No animation.
- Images as hosted 2x PNGs (SVG does not open in every email client).
- Copy says "espaço", never "workspace".
- No link address in the middle of a sentence (it becomes a link with text).

**In code:**
- The API already builds the emails with `renderEmail` (title, paragraphs, action, notes).
- Add the fields `greeting`, `illustration`, `preheader` (summary text) and the fallback link line.
- Replace the HTML with tables with inline styles.
- Bricolage Grotesque and Figtree fall back to Arial in clients that do not load fonts.
