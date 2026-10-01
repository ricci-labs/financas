---
summary: The TelaConta layout for account screens with a form (login, sign-up, password reset, invite), on mobile and desktop.
read_when: Building or changing the login, sign-up, password or invite screens, or the auth layout route.
updated: 2026-10-01
---

# TelaConta

TelaConta (`AuthLayout` in apps/web) is the layout of the account screens with a form: login, sign-up, forgot password, new password, and create account from an invite.

**Mobile:**
- A `mint` top flush with the top of the device, straight, with no rounded corners. Inside, the owl scene aligned to the bottom.
- **The owl block is flexible**, from 160 to 320 px tall: it takes the leftover space and shrinks when a warning, a strip or an error comes in.
  - The form is never cut off.
  - Everything fits on one screen without scrolling; it only scrolls on very short devices.
- No logo at the top: the title "Entrar no Twise" and the large owl already say where the person is.
- Title in `display` (30 px), subtitle in `body-sm`, **on a single line** (short sentences, no wrapping).
- The form has:
  - fields (TextField);
  - a secondary link on the right ("Esqueci minha senha");
  - an alert above the button (Alert);
  - a full-width primary button (Button);
  - a centered footer with the alternative path ("Ainda não tem conta? Criar conta").

**Desktop (from `bp-desktop`):** two columns.
- Left: the `mint` panel with the logo at the top, the owl in the middle and the slogan at the bottom ("Leve, claro, a dois." + the supporting sentence).
- Right: the form, centered, at most 400 px wide.

**Owl:**
- Each flow has its own scene: welcome on login, form card on sign-up, key on password, card on invite.
- **Between these screens the block stays mounted**, and only the object next to the owl changes, using the motion entrances (see Owl motion and CenaCoruja).

**In code:**
- A layout route (`/_auth` in TanStack Router) with the owl block and an `<Outlet />` for the form.
- The forms use the shadcn `Form` with React Hook Form + Zod from `@financas/shared`.
