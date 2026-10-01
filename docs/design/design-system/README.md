---
summary: Twise design system guide — principles, voice, colour, type, spacing, states and owl motion, icons and illustrations, brand, the component list, and how it maps to Tailwind v4 + shadcn in apps/web.
read_when: Any visual decision, or before building a component or an owl animation.
updated: 2026-10-01
---

# Twise design system

**Twise: "Leve, claro, a dois."** Couple finances without the weight. The app answers one question
per month, "quanto ainda podemos gastar?" (how much can we still spend?), and should make people
want to open it, not feel guilty. The direction is **flat, white, light and a little hand-drawn**:
a clean base like paper, near-black ink for what matters, a mint green for the brand, and
illustrations with a pen stroke.

## Principles
1. **Numbers are the heroes.** Nothing decorates on top of a value. Numbers are always tabular.
2. **Light, not childish.** The charm lives in the illustrations and the voice. The interface
   itself is sober, with lots of breathing room and few colours at a time.
3. **Flat.** Cards have a thin border (`border`), no shadow. Shadows (`shadow-float`,
   `shadow-dialog`) only on what floats: the floating button, menus, toasts and dialogs. No
   gradients.
4. **Colour never speaks alone.** Income has "+", money out has "−", a status has a word, an alert
   has an icon.

## Voice and content
- Brazilian Portuguese, short sentences, the tone of a friend who knows about money. It talks to
  the couple: "vocês", "livre para gastar", "ainda livre este mês".
- No guilt and no alarm: "Mercado está adiantado", never "Você estourou o orçamento!".
- Buttons are verb + outcome: "Salvar lançamento", "Registrar pagamento", never "OK".
- Errors say what happened and what to do: "Informe um valor maior que zero, como 25,90."
- No emoji in the interface. Personality comes from the illustrations and the celebratory cards
  (InsightCard): a light title ("Dá pra respirar", "Uma a menos!") with the concrete number below.
  At most one per screen, and never for errors, overdue items or a negative balance.
- Money: `R$ 1.234,56`, with the minus sign "−". Dates: `dd/mm/aaaa`, or "hoje", "ontem",
  "amanhã". Periods always show the range: "5 out – 4 nov".
- Example data is always fictional: "Member A", "Conta X", round amounts.

## Colour
- **Background:** `bg-page` (warm white) for the page, `bg-surface` (white) for cards and lists,
  `bg-sunken` for tracks, skeletons and disabled fields.
- **Text:** `ink` for the main text, `ink-muted` for secondary text, `ink-subtle` only for
  placeholders.
- **Brand:** `mint` is a fill (floating button, active item, the "Livre para gastar" card, a budget
  bar on pace), always with `on-mint` on top. As text, use `mint-ink`. Never write in mint on white.
- **Primary action:** `action-primary` is ink (black in light, off-white in dark), with
  `on-action-primary`. One primary button per screen.
- **Money:** `income` with "+", `expense` with "−" (in lists, money out stays in `ink`; `expense` is
  used where the comparison matters), `transfer` neutral.
- **Feedback:** `success`, `warning`, `danger` and `info`, each with a `*-soft` background.
- **Status:** `status-pending`, `status-overdue`, `status-paid`, `status-partial`,
  `status-matched` and `status-neutral`, each with `*-soft`.
- **Themes:** the app **always opens in the light theme**, even when the phone or browser is in dark
  mode. Dark only applies when the person chooses it in the settings. All text passes 4.5:1 on the
  grounds named in each token's notes, in both themes.

## Typography
Two families, both bundled with the app (never from a CDN):
- **Bricolage Grotesque** (`--font-display`): the brand's voice. Curves and personality for the
  greeting, screen titles and the "Livre para gastar" number. Styles `amount-hero`, `display`,
  `title-lg` and `title`.
- **Figtree** (`--font-sans`): everything else: text, labels, buttons and amounts in lists. Styles
  `amount-lg`, `amount`, `amount-sm`, `title-sm`, `body`, `body-sm`, `label`, `button` and
  `caption`.

Every money value uses `font-variant-numeric: tabular-nums` (both families have tabular numbers),
so cents line up in a column. Inputs use 16 px so iPhones don't zoom.

## Space, shape and touch
- 4 px base: `space-1` to `space-16`. Side margin: `space-4` on phones, `space-6` on tablets,
  `space-12` on desktop.
- Generous corners: `radius-md` on fields and alerts, `radius-lg` on cards, `radius-xl` on the main
  card and the bottom sheet, `radius-full` on buttons, badges and chips.
- Controls use `control-height` (48 px). Nothing tappable is smaller than `touch-min` (44 px).
- Breakpoints: `bp-base` 360 (design here first), `bp-tablet` 768, `bp-desktop` 1024 (sidebar
  instead of the bottom bar), `bp-wide` 1280.

## States and motion
- Focus: a 2 px `focus-ring` with a 2 px offset, on every control.
- Pressed: a slight scale (0.98) in under 100 ms. Loading: a spinner inside the button, or a
  skeleton shaped like the content, never a full-screen spinner.
- Motion is short (120–200 ms, ease) and optional: with `prefers-reduced-motion`, nothing animates.

### Owl motion (moment screens)
The owl is **a set that doesn't change screens**: owl, coins and plant stay still, and only the
**object next to it** (hourglass, envelope, check, key, chain…) and its **expression** change. A
transition then feels like the same screen transforming, not a new one loading. In the app the
screen stays mounted and the front end swaps only the pieces and the texts. Each sequence plays
**once** and ends within 2 s of the event. Nothing loops, except the wait while something loads.
The illustration is a layered SVG (each piece with an `id`) animated with CSS only, no library.

The approved entrances (the pt-BR names are the design canvas names):

| Name | What it does | Time | Curve |
|---|---|---|---|
| **Leave** (Sair) | The leaving object shrinks to nothing in place (scale 1 → 0, fading with it) | 300 ms | ease-in-out |
| **Appear** (Surgir) | The new object grows from its centre, overshoots and settles (scale 0 → 1.12 → 1) | 350 ms | cubic-bezier(.3,1.5,.6,1) |
| **Draw** (Desenhar) | Pen marks (check, stroke, underline) are revealed left to right, as if drawn | 450 ms, right after Appear | ease-out |
| **Pop** (Estalar) | Sparkle strokes pop from their base (scale 0 → 1.2 → 1). With two groups, the second starts 200 ms later | 300 ms each | cubic-bezier(.3,1.6,.6,1) |
| **Wake** (Abrir os olhos) | From sleepy to awake: the eyelid vanishes and the pupils open top to bottom (vertical scale 0.1 → 1) | 250 ms | ease-out |
| **Wink** (Piscadinha) | Once, at the end of a celebration, the mint eye closes into "^" and reopens. Achievements only, never errors or warnings | 600 ms (close 150, hold 300, open 150) | ease |
| **Swap text** (Trocar texto) | Title and text rise 6 px and fade; the new ones come down 8 px and in, in the same place | 250 ms + 250 ms | ease |
| **Raise actions** (Subir ações) | Card and button come in last, rising 16 px | 300 ms | ease |
| **Wait** (Esperar), only while loading | The hourglass turns slowly and the "zz" rise and fade | 1.2 s per cycle | ease-in-out |
| **Float** (Flutuar) | Right after Appear, the object rises 5 px and back, once (e.g. an envelope arriving) | 800 ms | ease-in-out |
| **Swing** (Balançar), warnings | A hanging object swings once from its top (−9° → 6° → −2° → 0) | 550 ms | ease |
| **Lock** (Travar), warnings | The padlock shackle drops 12 px and closes, with a small jolt of the body (−4° → 3° → 0) | 150 ms + 300 ms | ease-in |
| **Doze** (Fechar os olhos), warnings | The reverse of Wake: pupils close and the eyelid appears, slowly | 250 ms | ease-in |
| **Background swap** (Trocar fundo) | When the same page goes from waiting to a warning, the background goes from `mint` to `sketch-paper` | 400 ms | ease |
| **Arrive** (Chegar) | A second character slides 40 px in from the side and settles (scale 0.6 → 1.04 → 1) | 450 ms | cubic-bezier(.3,1.4,.6,1) |
| **Turn** (Girar) | After Appear, the key turns as if opening a lock (−20° → 10° → 0) | 450 ms | ease-out |
| **Write** (Escrever) | The lines of a form card appear one by one, like Draw in sequence (150 ms between lines) | 150 ms per line | ease-out |

Order of an achievement (e.g. "E-mail confirmado"): Leave → Wake → Appear → Draw → Pop → Swap text
→ Raise actions → Wink.

Order of a warning (e.g. "Este link não vale mais"): Leave → Background swap (if it came from a
wait) → Doze → Appear → Swing or Lock → Swap text → Raise actions. A warning **never** has a sparkle
or a wink.

Already applied in the design canvas ("Animação · …" frames): confirming → confirmed, confirming
→ link expired, sign-up → check your email, forgot password → check your email, new password →
link expired, and the sign-up closed entrance.

With `prefers-reduced-motion`, the screen goes straight to its final state, with none of these
steps.

### Scene catalog
Every owl scene has the same base (owl, coins, plant or floor) and **one object that changes**. In
form screens, the entrance plays **once, on first opening**. Between screens of the same flow (log
in, sign up, forgot password, new password) the owl block **stays mounted** and only the object
changes: Leave for the old one, the entrance of the new one.

| Scene | Object that changes | Kind | Entrance | Where it appears |
|---|---|---|---|---|
| Welcome | sparkle and curl | arrival | Pop (sparkle only) | Log in and its messages |
| Wait | hourglass and "zz" | waiting | Wait, looping only while loading; in "too many attempts" the hourglass turns once and stops | Confirming, too many attempts |
| Email | envelope | handoff | Appear + Float | Check your email, new link sent |
| Offline | cloud and crossed-out wi-fi | warning | Appear + Swing (the cloud) | Offline banner and screens |
| Sign-up | form card and pencil | form | Write (the card's lines) | Sign up, create an account from an invitation |
| Confirmed | check | achievement | Appear + Draw + Pop + Wink | Email confirmed |
| Key | key | form | Appear + Turn | Forgot password, new password |
| Link expired | broken chain | warning | Doze + Appear + Swing | Expired links, expired invitation |
| Closed | padlock | warning | Appear + Lock + Doze | Sign-up closed |
| Invitation | invitation card | handoff | Appear + Pop | Invitation preview; invitation for another email (no Pop, it's a warning) |
| Together | the second owl | achievement | Arrive + Pop + Wink | Invitation accepted; in "você já participa", only Arrive |
| Brand owl | sparkle and eyes | brand | Appear + Wake + Pop (the three strokes, one by one) + Wink; name and slogan rise right after | App opening (the logo itself doesn't animate) |

**Never animated:** the category illustrations (`Ilustracoes`, list icons) and the email images,
because email doesn't animate reliably. Every scene has (or is generated from the same drawing) a
layered SVG (`kit-…`) with an `id` per piece: `k-base`, `k-olhos-abertos`, `k-olho-esq`,
`k-olho-dir`, `k-olhos-sono`, `k-piscadinha` and one group per object.

## Icons and illustrations
- **Interface icons:** Lucide (`lucide-react`, shadcn/ui's default), 2 px stroke, 20–24 px, in the
  colour of the text next to them. Bundled with the app, never from a CDN.
- **Illustrations:** the `Ilustracoes` group is the brand's hand. Brush and pen drawings: a
  `sketch-ink` stroke that thickens and thins, outlines that don't close perfectly, `mint` printed
  slightly off register, texture dots in threes, curls and sparkle strokes. Always on
  `sketch-paper` (cream) or `mint-soft`. No perfect geometric shapes, gradients or 3D.
- **Where they go:** category icons in lists, empty states, onboarding and the corner of the
  "Livre para gastar" card. Buttons and navigation use Lucide only.

## Brand: name, slogan and logo
**The name.** "Twise" joins *two* with *wise*: the couple's money looked after wisely. In the logo
the name is always **"twise" in lowercase**, every letter the same size. No letter stands out,
just as in the couple nobody is in charge. In running text it is written normally: "Abra o Twise".

**The slogans.**
- Main: **"Leve, claro, a dois."** Under the logo, on the app opening, as the store subtitle and on
  small pieces. Three words, one per principle: light (the tone and illustrations), clear (numbers
  first) and together (the couple).
- Support: **"Claro para os dois, leve para o bolso."** For descriptions, ads and posts, when there
  is room to explain ("…: o app que mostra quanto vocês ainda podem gastar no mês").

**The logo: the two-eyed owl.**
- **Why an owl:** the universal symbol of wisdom, the *wise* in the name. An owl also sees in the
  dark, and the app does that with the card invoice, showing what's coming before it arrives.
- **Why two different eyes:** one is cream and the other mint. They are the two people of the
  couple: different, but looking the same way together. It is "a dois" drawn.
- **The sparkle in the corner:** the three pen strokes are the moment of clarity, the "got it!",
  when the couple opens the app and knows how much they can still spend. It is the "claro" of the
  slogan.
- **The brush stroke:** the owl is drawn like the illustrations, with an imperfect outline and
  texture. It is the "leve": nothing like a stiff, geometric bank logo.
- **The colour:** ink black on mint, the two central colours of the system. The icon works at any
  size from 24 px.

**How to use it.** The files are in the `Logo` asset group, and the applications (logo, app
opening, header and store page) are in the **Brand** component group, each with its rules. In
short: keep the clear space (half the icon around it), don't change the eye colours, don't
capitalise the name in the logo and don't rebuild the name in another font. The owl without a
background is also the mascot: it can appear in welcomes and empty screens, always on
`sketch-paper` or `mint-soft`.

## Components
Brand: Logo, AberturaApp, CabecalhoApp, PaginaLoja and **CenaCoruja**. Interface: Button (with the
floating button, loading and waiting), TextField, MoneyInput, Alert (with banner, toast and
action), **Dica**, Amount, StatusBadge, StatHero ("Livre para gastar"), EntryRow, InsightCard and
BudgetProgress. Account screens: **TelaConta**, **Momento**, **TrilhoDePassos** and
**EmailConta**. The rest of the brief (date and period pickers, combobox, charts, navigation…)
comes in later steps.

The full screens that use these components, with every state, are in `../account/screens.md`.

## For developers: from the system to the code
The web app is Vite + React 19 + Tailwind CSS v4 + shadcn/ui (ADR 0005), and the code follows
ADR 0027 (`../../architecture/web-design-tokens.md`, `../../architecture/web-components.md`):
- **Tokens live in `apps/web/src/styles/tokens/`, the single source.** Each token above keeps its
  name as a CSS variable (`--ink`, `--mint`, `--space-4`…) and becomes a Tailwind utility through
  `@theme inline`. Dark values sit under the `.dark` class (shadcn's convention), applied only when
  the person chooses the dark theme. shadcn's variables (`--background`, `--foreground`,
  `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`,
  `--popover`, `--sidebar-*`) are aliases of the brand tokens, and `--chart-1` to `--chart-5` feed
  the charts. The radius scale uses the fixed `--radius-sm/md/lg/xl/full` values, not shadcn's
  `calc(var(--radius) …)`.
- **Fonts:** Bricolage Grotesque and Figtree (OFL licence), bundled and served by the app (no
  Google Fonts, RNF-PRIV-1), declared as `--font-display` and `--font-sans` in `@theme`. They
  replace Inter.
- **Components:** `components/bundle.css` (`fn-…` classes) is the exact visual reference for each
  state. Each component's README says which shadcn piece to use and what changes in it. Where it
  lives in `apps/web` follows ADR 0027's layers: shadcn primitives in `components/ui`, our
  components in `components/<family>/<component>/`.
- **Icons:** `lucide-react`. **Toasts:** `sonner`. **Forms:** shadcn's `Field` parts with React Hook
  Form + Zod from `@financas/shared`. **Tables:** TanStack Table on desktop, a list on phones.
- **Illustrations and logo:** ready SVGs for `<img>` (or imported by Vite), with fixed colours. The
  PWA icons (192 and 512 px, and the `apple-touch-icon`) come from `twise-icone.svg`; the manifest
  uses `name: "twise"` and `theme_color`/`background_color` = `mint`.
