---
summary: Rules every web screen follows — field and form validation, the button contract, feedback, loading/empty/error states, money and date inputs, permissions in the UI, destructive actions and how API errors become messages.
read_when: Designing or building any form, button, list or screen, or reviewing one before merge.
updated: 2026-09-29
---

# UI standards

Every screen spec in `modules/` assumes these rules. A spec only says where it differs.

## Forms and validation
**Every field of every form follows this, with no exception.**

1. **Label:** always visible above the field, in pt-BR. Required fields are marked with "*" next to
   the label, and the form starts with "* obrigatório". Optional fields are not marked "(opcional)",
   unless most fields of that form are required.
2. **Help text:** under the label when the field needs explaining (format, what it affects), e.g.
   "Dia em que a fatura fecha. Compras nesse dia entram na próxima fatura."
3. **Same rules as the API:** the client validates with the same Zod schema the API uses
   (`@financas/shared`). Limits in the specs (lengths, ranges, formats) come from those schemas; a
   field never accepts what the API would refuse.
4. **When to validate** (decided with the user, 2026-09-29): the error shows **as soon as the
   person leaves the field** with an invalid value, never later on submit.
   - on leaving a field (blur), even the first time; never while the first value is being typed;
   - after a field shows an error, on every change, so the error disappears as soon as it's fixed;
   - rules between fields (the shares' sum, an end date after the start, "Para" different from
     "De") are checked again as soon as either field changes;
   - a required field the person hasn't touched shows no error; the disabled button says what is
     missing (Button contract).
5. **Error display:** under the field, in the error colour, with an icon and text (not colour
   alone), announced to screen readers. The field gets `aria-invalid`.
6. **Errors from the server on submit** (rules only the API knows, like a name already taken):
   the error shows under its field and focus moves there; when the form is long, a summary at the
   top lists every error as a link to its field ("Corrija 2 campos para continuar.").
7. **Message style:** says what's wrong and what to do, in plain pt-BR, never the raw code or an
   English message. Patterns:
   - required: "Informe {o nome da conta}."
   - too long: "Use no máximo {80} caracteres."
   - too short: "Use pelo menos {12} caracteres."
   - format: "Informe um e-mail válido, como nome@exemplo.com."
   - range: "Escolha um dia entre 1 e 31."
   - money: "Informe um valor maior que zero, como 25,90."
   - date: "Informe uma data válida (dd/mm/aaaa)."
   - relation: "Escolha uma conta." / "Escolha pelo menos uma permissão."
8. **Counters:** text fields with a limit show "{n}/{max}" once the user is near it (80%).
9. **Trimming:** leading and trailing spaces are removed before validating and sending, as the API
   does; a value of only spaces counts as empty.
10. **Defaults:** fields that have a default in the schema start filled with it and say so when it
    matters ("Hoje").
11. **Server errors on submit:** an error code that points to a field (see `error-messages.md`,
    "field" column) is shown under that field; others show as a form-level message above the
    buttons. The typed data stays.
12. **Leaving with changes:** closing a dialog or navigating away from a form with unsaved changes
    asks "Descartar as alterações?" with "Continuar editando" (default) and "Descartar".
13. **Dependent fields:** a field that depends on another appears only when it applies (e.g.
    "Parcelas" only for a card purchase), and hidden fields are not validated or sent.

## Button contract
**Every button and action states all of this in its screen spec.** A button with no rule is a bug.
A submit button whose spec doesn't give an "Enabled when" follows the default below (disabled
until the form is valid; on edit forms, also until something changed).

| Aspect | Rule |
|---|---|
| Label | A verb that says the outcome: "Salvar conta", "Registrar pagamento", never "OK" or "Enviar" alone |
| Visibility | Hidden if the role lacks the permission (see Permissions) |
| Enabled when | Explicit condition. **Submit buttons stay disabled until the whole form is valid** (every required field filled, every rule met) and, on edit forms, until something changed; also while a request runs. A disabled submit shows, right under it, what is missing: "Preencha Valor e Categoria para continuar." (up to 3 field names, else "Preencha os campos obrigatórios (*) para continuar."). It uses `aria-disabled` (still focusable, so screen readers read that hint); tapping it only marks the missing fields and moves focus to the first one, it never sends |
| Loading | While the request runs: spinner inside the button, label kept, button disabled; other actions of the same form disabled too |
| Double submit | Impossible: one request per press (RNF-REL-1) |
| Success | Says what happened (a toast or an inline message) and where the user goes next |
| Failure | Maps the error code to a message (`error-messages.md`); keeps the form as it was |
| Confirmation | Required for destructive or hard-to-undo actions (see Destructive actions) |
| Keyboard | Enter submits the form from any single-line field; Esc closes dialogs |
| Hierarchy | One primary button per view; secondary and tertiary (link) styles for the rest; destructive in the danger style, never primary |
| Icon-only | Has a tooltip and an `aria-label` |

## Feedback
- **Toast** (bottom on mobile, top-right on desktop, 4 s, pausable): confirms an action done away
  from where the user looks, e.g. "Lançamento registrado." Toasts for undoable actions carry
  "Desfazer" (e.g. after moving to the trash).
- **Inline message:** for results the user must read (a form error, "Nada a cobrar deste contato").
- **Banner:** for states of the whole screen (offline, read-only role, session about to expire).
- Never more than one toast at a time about the same thing.

## States of a screen or section
Every screen spec defines each of these:
| State | Rule |
|---|---|
| Loading | Skeletons shaped like the content (not a full-page spinner); keep the previous data while refreshing |
| Empty | A sentence saying why it's empty and the next action, e.g. "Nenhum lançamento neste período." + "Novo lançamento" |
| Error | What failed, the `ref` when it's a 5xx, and "Tentar de novo" |
| No permission | The item is not in the navigation; a direct link shows "Você não tem acesso a esta área. Peça a um administrador do espaço." |
| Partial | A section that fails doesn't take down the rest of the screen |

## Money, dates and amounts
- **Money input:** a numeric field with "R$" as a prefix, `inputmode="decimal"`, accepting
  `1234,56`, `1.234,56` or `1234`; formats on blur; always positive unless the field says
  otherwise; sent as integer cents.
- **Money display:** `formatBrl` (`R$ 1.234,56`). Expenses and money out show with "−" and the
  expense colour; incomes and money in with "+" and the income colour; transfers neutral. The sign
  is always shown, so colour is not the only cue.
- **Date input:** a date picker plus typing `dd/mm/aaaa`; "Hoje" as a shortcut; sent as
  `YYYY-MM-DD`.
- **Period picker:** previous and next arrows plus a month list; always shows the range, e.g.
  "5 out – 4 nov".
- **Percentages:** `72%`, no decimals unless below 10% (`4,5%`).

## Permissions in the UI
- The member's permissions come from `GET /api/workspaces/:workspaceId`. Each action in a screen
  spec names its permission (`module:action`, e.g. `entries:create`).
- Without `view` on a module, its navigation item and screens are hidden.
- Without the action's permission, the button or menu item is hidden (not disabled), unless hiding
  it would confuse; then it is disabled with a tooltip saying why.
- A viewer sees a discreet banner: "Você está vendo este espaço sem poder alterar nada."
- A `403 PERMISSION_DENIED` from the API (the role changed meanwhile) shows its message and
  refreshes the permissions.

## Destructive actions
- **Restorable deletes** (entries and accounts, which have a trash and a restore route): no
  dialog; the toast offers "Desfazer" for 8 s, and the item can be restored from the trash.
- **Deletes with no restore in the UI** (contacts, recurrences, goals, holidays, roles; the rows
  are kept for history but there is no restore route) and **irreversible or wide actions** (remove
  a member, leave the workspace, revoke an invitation, cancel a charge, replace the commission
  split): a dialog that names the thing and the consequence, e.g. "Remover Member B do espaço? A
  pessoa perde o acesso na hora." The confirm button repeats the verb ("Remover membro"), is in the
  danger style, and is not the default focus.
- An optional reason field ("Motivo") where the API accepts one (deletions), up to its limit.

## API errors
Every response error has the shape `{ "error": { "code", "message", "ref" } }`.
- The UI shows the pt-BR message for the `code` from `error-messages.md`, never the API's
  `message`, which is English and for developers.
- Unknown codes fall back to "Não foi possível concluir. Tente de novo." plus the `ref`.
- 5xx always shows the `ref`: "Algo deu errado. Código: {ref}."
- 429 shows the wait the API gives (`Retry-After`), e.g. "Muitas tentativas. Tente de novo em 15
  minutos."
