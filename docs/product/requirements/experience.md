---
summary: The idea of the web app — promise, people, design principles, key journeys, navigation and the screen inventory with IDs used by every module requirement.
read_when: Starting the design system or any screen, deciding where a feature lives in the navigation, or looking up a screen ID.
updated: 2026-09-29
---

# Experience

Product context: `../vision.md` and `../household-finances.md`.

## Name and slogan
**Twise — Leve, claro, a dois.** The line under it, where there is room (login, empty home, e-mails):
"Claro para os dois, leve para o bolso: o app que mostra quanto vocês ainda podem gastar no mês."
Both come from `../vision.md` → Name.

## The promise
**Know in seconds how much is still free to spend, and never be surprised by a card invoice.**
Every screen serves one of three questions:
1. How are we this period? (spent, committed, free to spend, per day)
2. What is coming? (bills, invoices, installments, balance going negative)
3. Who owes what? (contacts, charges)

Recording is quick and usually happens on WhatsApp. The web is where the couple **sees, checks,
fixes and plans**, so it favours clarity over speed of entry, while still making a new entry quick
on the phone.

## People
Placeholders only (the repo is public).
- **Member A:** fixed salary, organises the household money, checks the web a few times a week on
  the phone and sometimes on a laptop. Wants the full picture and to fix mistakes.
- **Member B:** fixed salary plus variable sales commissions. Mostly records by WhatsApp. Opens the
  web to see "how much can I spend" and to decide what to do with a commission.
- **A contact:** a friend or relative who shares purchases. Never logs in; receives charges by
  WhatsApp with a Pix code.
- **A viewer:** someone invited to look (e.g. an accountant or a parent helping), who can't change
  anything.

## Principles
1. **Mobile first, one hand.** Designed at 360 px wide; the main actions are reachable with the
   thumb. Desktop gets more columns, never different features.
2. **Numbers you can trust at a glance.** Money is always formatted the same way, signs and colours
   are consistent, and a number never appears without saying what it is and for which period.
3. **Say what happened, and what to do next.** Every action ends in visible feedback; every error
   says what is wrong and how to fix it, in plain pt-BR (`ui-standards.md`, `error-messages.md`).
4. **Nothing is lost by accident.** Deletes go to the trash and can be restored; destructive
   actions ask for confirmation; forms warn before discarding typed data.
5. **Show only what the person may do.** The UI follows the role's permissions; the API is still
   the final guard.
6. **Calm, not noisy.** Alerts (insights) are ranked, with at most a few on screen; warnings are
   informative, not alarming.
7. **Explain the finance terms.** Words like "comprometido", "livre para gastar", "fechamento" have
   a short help text one tap away.

## Key journeys
| ID | Journey | Screens |
|---|---|---|
| J1 | Open the app and see how the period is going, what is free per day, and the top alerts | `HOME-01` |
| J2 | Record a card purchase in installments, shared with a friend | `ENT-02` |
| J3 | Check the next invoice: lines, own vs fronted for others, and pay it | `CARD-02`, `CARD-03`, `ENT-02` |
| J4 | Fix a wrong entry (amount or category) or delete and restore it | `ENT-03`, `ENT-04`, `ENT-05` |
| J5 | Charge a friend what they owe, send it by WhatsApp with Pix, and record the payment | `CON-02`, `CON-03`, `CON-04` |
| J6 | Set up rent and salary as recurring, then confirm a payment matches the planned bill | `PLAN-01`, `PLAN-02`, `PLAN-03` |
| J7 | A commission arrived: see the suggested split and move the money | `HOME-03`, `ENT-02` |
| J8 | "Posso comprar?": simulate a purchase in installments and see its impact month by month | `HOME-02` |
| J9 | Set a budget for a category and follow its pace during the period | `PLAN-04`, `HOME-01` |
| J10 | Invite the partner, choose their role, and later change it | `MEM-01`, `MEM-03` |
| J11 | First run: log in, create the workspace, add accounts, cards and categories | `AUTH-01`, `WS-01`, `ACC-01`, `CARD-01` |

## Navigation
**Mobile:** a bottom bar with five items, and a floating **"Novo lançamento"** button above it on
the screens where recording makes sense.

| Item | Label | Opens |
|---|---|---|
| 1 | "Início" | `HOME-01` |
| 2 | "Lançamentos" | `ENT-01` |
| 3 | "Cartões" | `CARD-01` |
| 4 | "Planejamento" | `PLAN-01` |
| 5 | "Mais" | A menu: contacts and charges, accounts and categories, members, settings, history, trash, my account, log out |

**Desktop (≥ 1024 px):** a left sidebar with the same sections, expanded; "Novo lançamento" as the
primary button at the top.

**Always visible:** the current workspace name, with a switcher when the user has more than one
(`SHELL-01`).

Items the role can't open are hidden, not disabled (`ui-standards.md` → Permissions).

## Screen inventory
Priority MVP unless marked Later. Module files hold the full spec of each screen.

**Public (no session)** — `modules/auth-and-account.md`
| ID | Screen |
|---|---|
| `AUTH-01` | Log in |
| `AUTH-02` | Sign up (only when public sign-up is on) |
| `AUTH-03` | Verify email (link landing) and resend verification |
| `AUTH-04` | Forgot password |
| `AUTH-05` | Reset password (link landing) |
| `INV-01` | Invitation landing: preview, accept, or create an account through it |

**Shell and workspace** — `modules/workspace-and-members.md`
| ID | Screen |
|---|---|
| `SHELL-01` | App shell: navigation, workspace switcher, session expiry handling |
| `WS-01` | Create a workspace (first run, or from the switcher) |
| `SET-01` | Workspace settings: name, financial period, budget base, installment view, time zone |
| `SET-02` | Pix receiving (key and receiver shown on charges) |
| `MEM-01` | Members: list, change role, remove, leave |
| `MEM-02` | Roles: list, create and edit custom roles |
| `MEM-03` | Invitations: invite by email or phone, pending list, revoke |

**Home** — `modules/dashboard.md`
| ID | Screen |
|---|---|
| `HOME-01` | Period overview: free to spend, per day, spent, committed, budgets, next invoice, balance forecast, insights |
| `HOME-02` | "Posso comprar?": purchase simulation |
| `HOME-03` | Commission split suggestion |

**Accounts and cards** — `modules/accounts-and-cards.md`
| ID | Screen |
|---|---|
| `ACC-01` | Accounts and balances |
| `ACC-02` | Categories (expense and income trees) |
| `ACC-03` | New or edit account or category |
| `ACC-04` | Accounts trash |
| `CARD-01` | Cards |
| `CARD-02` | Invoices of a card |
| `CARD-03` | Invoice detail: lines, own vs fronted, pay |
| `CARD-04` | New or edit card |

**Entries** — `modules/entries.md`
| ID | Screen |
|---|---|
| `ENT-01` | Entries list with filters |
| `ENT-02` | New entry (every type) |
| `ENT-03` | Entry detail: postings, attachments, history |
| `ENT-04` | Edit entry (details in place, or replace) |
| `ENT-05` | Entries trash |

**Contacts and charges** — `modules/contacts-and-charges.md`
| ID | Screen |
|---|---|
| `CON-01` | Contacts and what each owes |
| `CON-02` | Contact detail: open items, charges |
| `CON-03` | New charge: preview message, Pix, send |
| `CON-04` | Record a payment for a charge |
| `CON-05` | New or edit contact |

**Planning** — `modules/planning.md`
| ID | Screen |
|---|---|
| `PLAN-01` | Recurring bills and incomes |
| `PLAN-02` | New or edit recurrence |
| `PLAN-03` | Planned occurrences: upcoming, overdue, match with a payment |
| `PLAN-04` | Budgets |
| `PLAN-05` | Goals and emergency reserve |
| `PLAN-06` | Commission split steps |
| `PLAN-07` | Holidays (national and local) |

**Account, history and support** — `modules/auth-and-account.md`, `modules/attachments-and-audit.md`
| ID | Screen |
|---|---|
| `ME-01` | My account: name, password, preferences, notifications per workspace |
| `AUD-01` | History (audit log) |
| `ATT-01` | Attachments on an entry or a charge (a section inside `ENT-03` and `CON-02`) |
