---
summary: The TextField component: text field anatomy, required marking, states, the password field and the shadcn Form mapping.
read_when: Building or changing a text, email, password, phone, search or textarea field, or field validation display.
updated: 2026-10-01
---

# TextField

A text field with an always-visible label, help, error and counter. It is the base for email, password, phone, search and textarea.

**Anatomy:** `fn-field` > `fn-field__label` (with `<b>*</b>` if required) > optional `fn-field__help`, **before** the field > `fn-input` (48px, `radius-md`, `border-control` border) > `fn-field__error` or `fn-field__counter`.

**Required:**
- The asterisk next to the label is enough.
- In short forms (login, sign-up, password, up to ~4 fields, all required) the "* obrigatório" line is **not** shown.
- That line is for long forms that mix required and optional fields.
- The field gets `required`; the asterisk is `aria-hidden`.

**States**
- Default: `border-control` border (≥3:1).
- Focus: 1px border and ring in `ink`.
- Error: `danger` border, with the icon and text in `danger` below, and `aria-invalid` and `aria-describedby` (help + error).
  - The error appears on **blur**, never while the person is typing for the first time.
  - It goes away as soon as the value is valid.
- **Read-only** (`fn-input--readonly`): while the form is submitting, and for locked values (the email of an invite).
- Disabled: `bg-sunken` background, `ink-muted` text.
- Counter: "n/máx", visible from 80% of the limit.

**Password:**
- A "Mostrar"/"Ocultar" (show/hide) button with an eye icon inside the field (`fn-input__toggle`, `aria-pressed`). It switches the field type without losing focus.
- `autocomplete="current-password"` on login and `"new-password"` on sign-up and password change.
- The new-password help is fixed: "Use pelo menos 12 caracteres. Uma frase fácil de lembrar funciona bem."
- "Repita a nova senha" (repeat the new password) exists only on password change, and is checked only in the app.

**What the screen provides:**
- The label in pt-BR.
- Help when the format needs explaining.
- The error message in the ui-standards pattern ("Informe um e-mail válido, como nome@exemplo.com.").

**In shadcn/ui:**
- `Form` (React Hook Form + Zod with the schemas from `@financas/shared`, `mode: "onTouched"`): `FormField` > `FormLabel` + `FormDescription` (before the control) + `FormControl` (`Input` or `Textarea`) + `FormMessage`.
- Replace the default `FormMessage` with the icon format described here.
- The password field is a custom `PasswordInput` (an `Input` with the eye button).
