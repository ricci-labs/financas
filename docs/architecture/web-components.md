---
summary: How web components are layered and built — shadcn primitives, design-system components with one folder each (variants, types, copy, tests, examples), the props contract, forms, icons, copy, the workbench, tests and lint.
read_when: Creating, changing or using any component in apps/web; adding a shadcn component; building a form; reviewing a web PR.
updated: 2026-10-01
---

# Web components

Decision: ADR 0027. Tokens: `web-design-tokens.md`. What the components must contain and every
state they show: `../product/requirements/design-system-brief.md` and `../product/requirements/ui-standards.md`.

## Layers
| Layer | Path | Holds | May import |
|---|---|---|---|
| 1. Primitives | `src/components/ui/` | shadcn components (Base UI), kept close to upstream | `lib/`, tokens |
| 2. Design system | `src/components/<family>/<component>/` | Our components: shadcn re-exported or composed, plus finance patterns | layer 1, other design-system components, `lib/`, `hooks/`, `@financas/shared` |
| 3. Features | `src/features/<feature>/components/` | Screens' building blocks with data and copy of one feature | layer 2, its own feature, `lib/`, `hooks/`, shared |
| 4. Routes | `src/routes/` | Compose features into pages (`web-application.md`) | features' `index.ts`, layer 2 |

- **Features and routes never import `components/ui`.** A primitive they need is exposed by a
  design-system component, even as a plain re-export (`export { Button } from
  '@web/components/ui/button'`). That gives one import surface, and a later wrapper changes nothing
  in the callers.
- **Wrap only when it adds something:** domain meaning (`Amount`), fixed copy (`PasswordInput`'s
  toggle labels), a smaller API, or a rule from `../product/requirements/ui-standards.md` (`SubmitButton`).
- **A component used by two features moves to layer 2.** Features never import each other.
- Enforced by depcruise (`dependency-rules.md` → Web).

## Families
Layer 2 is grouped by the families of the brief. Each component name says what it shows, never
where it's used.

| Family | Components (from the brief) |
|---|---|
| `actions/` | `Button`, `IconButton`, `SubmitButton`, `FloatingActionButton`, `ActionMenu`, `SegmentedControl` |
| `inputs/` | `TextInput`, `PasswordInput`, `EmailInput`, `PhoneInput`, `SearchInput`, `TextArea`, `MoneyInput`, `DateInput`, `PeriodPicker`, `Select`, `Combobox`, `CategoryPicker`, `Checkbox`, `RadioGroup`, `Switch`, `DayOfMonthPicker`, `InstallmentsStepper`, `FileUpload`, `ColorSwatch` |
| `forms/` | `Form`, `FormField`, `FormErrorSummary`, `FormFooter`, `RequiredLegend` |
| `feedback/` | `Toast`, `InlineAlert`, `Banner`, `ConfirmDialog`, `EmptyState`, `Skeleton`, `ErrorState` |
| `display/` | `Amount`, `StatusBadge`, `Avatar`, `ListItem`, `Card`, `StatCard`, `ThresholdProgress`, `Tabs`, `Accordion`, `DataList` (table on desktop, list on mobile), `LoadMore`, `Tooltip`, `HelpPopover`, `FilterChips`, `CategoryIcon` |
| `charts/` | `BarChart`, `ForecastChart`, `DonutChart`, each with its text alternative |
| `navigation/` | `BottomBar`, `Sidebar`, `TopBar`, `WorkspaceSwitcher`, `BackLink`, `Breadcrumb` |
| `layout/` | `AppShell`, `Page`, `PageHeader`, `Section`, `Stack`, `Grid` |
| `finance/` | `StatHero`, `InsightCard`, `InvoiceCard`, `EntryRow`, `OccurrenceRow`, `ContactRow`, `ChargePreview`, `AmountSplitEditor` |
| `brand/` | `Logo`, `OwlScene` (the layered owl scenes and their motion), `AppSplash` |
| `icons/` | The icon registries (see Icons) |

`finance/` holds patterns with no data fetching: they take props and render. The feature passes
the data.

## One folder per component
**Everything a shared component is made of lives in its folder, once.**

```
components/display/amount/
├── amount.tsx            # the component; markup and wiring only
├── amount.variants.ts    # the cva recipe: every size, tone and state
├── amount.types.ts       # props and any other type
├── amount.messages.ts    # its pt-BR copy (labels, aria-labels, units)
├── amount.examples.tsx   # every variant and state, for the workbench
├── amount.test.tsx       # behaviour and accessibility
└── index.ts              # the public surface: component + props type
```

| File | Rule |
|---|---|
| `<name>.tsx` | One exported component (compound parts are extra named exports: `Card`, `CardHeader`). No class strings beyond layout glue; appearance comes from the recipe |
| `<name>.variants.ts` | `cva` recipes only, with `defaultVariants` always set. One recipe per part for multi-part components |
| `<name>.types.ts` | Props extend the native element's props (`ComponentProps<'button'>`) plus `VariantProps<typeof nameVariants>` |
| `<name>.messages.ts` | A typed `as const` object; interpolation through functions (`installmentLabel(3, 10)`) |
| `<name>.examples.tsx` | A list of named examples; the only place outside tests that may hard-code copy and amounts (placeholders only, RNF-PRIV-2) |
| `<name>.test.tsx` | Each state of the brief that has behaviour, plus the axe check |
| `index.ts` | What features import. Nothing else from the folder is imported from outside |

Files are created only when needed (a component with no copy has no `.messages.ts`), always with
these names. `lint:file-roles` checks the names; depcruise checks that only `index.ts` is imported
from outside.

## Props contract
- **Variant props:** `variant` (visual weight: `primary`, `secondary`, `tertiary`, `danger`),
  `size` (`sm`, `md`, `lg`), `tone` (meaning: `income`, `expense`, `neutral`, a status). Same names
  in every component.
- **`className` is for placement only** (margin, width, grid position). A different look is a new
  variant in the recipe, never a class passed from a feature.
- **States come from attributes, not extra props:** `disabled`, `aria-invalid`, `aria-busy`,
  `aria-disabled`, `data-state`. The recipe styles them with Tailwind's `aria-*:` and `data-*:`
  variants, so the visual state and the accessible state can't drift.
- **`ref` is a normal prop** (React 19); no `forwardRef`.
- **`data-slot="<name>"`** on the root and on each part, as shadcn does, so a parent can style a
  child part (`[&_[data-slot=icon]]:size-4`) without new props.
- **Polymorphism** only through Base UI's composition prop (`render`); no `as` prop.
- **Copy has a default** from `.messages.ts` and can be overridden by a prop when the screen spec
  gives its own text.

## Variants
- `cva` (class-variance-authority) is the only variant API, the one shadcn generates. No
  tailwind-variants, no ad-hoc `Record<variant, string>` maps.
- Classes are joined with `cn()` from `lib/cn.ts` (shadcn's `cn` engine), which merges conflicts.
  It is created with our theme's utility names (`lib/tokens.ts` reads them from `theme.css`, the
  same source as Tailwind), so `text-button` and `text-on-action-primary` are known as a type style
  and a colour; the stock `cn` would drop one of them as a conflict.
- Compound states use `compoundVariants` (`{ variant: 'danger', size: 'sm', class: … }`).
- Every class in a recipe is a token utility (`web-design-tokens.md` → The rule).

## Forms
React Hook Form v7 + `zodResolver` with the **schemas from `@financas/shared`** (ADR 0005,
`../product/requirements/ui-standards.md` → Forms and validation). RHF v8 waits until it's stable.

- `useSchemaForm({ schema, requiredMessages, defaultValues })` (`lib/forms/use-schema-form.ts`) is
  `useForm` with `zodResolver(schema)` and `mode: 'onTouched'`: validates on the first blur, then
  on every change, which is the rule decided on 2026-09-29.
- **Messages in pt-BR without touching the shared schemas** (the API keeps them as they are):
  `fieldErrorMap(requiredMessages)` (`lib/forms/field-errors.ts`) is passed to the parse, and turns
  each Zod issue into the `../product/requirements/ui-standards.md` sentence: an empty value (after trimming) → the field's
  own "Informe…" from `requiredMessages`, `too_small`/`too_big` → "Use pelo menos/no máximo {n}
  caracteres.", an invalid e-mail → "Informe um e-mail válido, como nome@exemplo.com.". A web-only
  rule (the password confirmation) writes its pt-BR message in its own web schema.
- `Form` provides the form (`FormProvider` + `<form noValidate>`, so Enter submits from any field);
  `FormField` is the only way to render a field. It wires the visible label, the "*" for required
  fields (`aria-hidden`; the input gets `required`), the help text **before** the input, the error
  with its icon in an `aria-live` region, `aria-invalid`, `aria-describedby` (help + error ids from
  `useId`), the counter from 80% of `maxLength`, and `readOnly` while the form is submitting. It
  hands the input its props through a render function:
  `<FormField name="email" label="E-mail" isRequired>{(control) => <TextInput {...control} />}</FormField>`.
- Fields go through `useController`, and `onBlur` is always passed down, or `onTouched` stops
  working. Components below the form read its state with `useFormState`, never
  `useFormContext().formState`, which doesn't subscribe a child to changes (the submit button
  stayed disabled with a valid form until this was fixed).
- Read live values with `useWatch`, never `form.watch()` (it opts the component out of the React
  Compiler).
- `SubmitButton` implements the button contract: disabled until valid (and changed, with
  `requiresChange`, on edit forms) with `aria-disabled` and no hint sentence; pressing it then runs
  `trigger(undefined, { shouldFocus: true })`, which marks the missing fields and focuses the first.
  The spinner with the gerund label while submitting, one request per press, and `isBlocked` for
  outside reasons (offline). Waiting is the `Button`'s `waitUntil` prop.
- `PasswordInput`'s toggle is named "Mostrar senha" / "Ocultar senha" (visible "Mostrar"/"Ocultar"
  plus a screen-reader-only "senha"), so its accessible name always contains its visible label
  (WCAG 2.5.3); it doesn't take the focus from the field.
- Server errors: `applyApiError(form, error)` (`lib/errors/`) puts a code with a field in the
  "Shown as" column of `../product/requirements/error-messages.md` under that field with `setError`, and the rest above the
  buttons.

## Feedback
- `Alert` (`tone`: info, success, warning, danger; always with its icon): form errors above the
  main button with `isUrgent` (`role="alert"`), arrival messages under the title without it
  (`role="status"`); an `action` slot takes a small `subtle` button or the message holds a
  `TextLink` with `tone="inherit"`.
- `Banner`: a full-width ink strip for states of the whole screen; `OfflineBanner` shows it with the
  catalog's network message while the device is offline.
- `Tip`: one centred line of help with the Info icon, in the colour of its background's text.
- Toasts: `showToast(message, { action })` with the `Toaster` mounted once in `AppProviders`
  (`sonner`, styled with tokens); bottom-centre on phones, top-right from 1024 px; 4 s, or 8 s with
  "Desfazer". Toasts with the same message replace each other (never two about the same thing).

## Brand and illustrations
- The owl scenes and the logo are SVG files in `apps/web/src/assets/` (`owls/`, `brand/`), copied
  from `docs/design/assets/` with English names (`coruja-boas-vindas` → `owls/welcome.svg`…). Vite
  ships each as its own hashed file, loaded only by the screen that shows it, so they never weigh on
  the JavaScript bundle. A new or changed drawing is copied again from the design package.
- `OwlScene` draws a scene by name (`welcome`, `wait`, `envelope`, `offline`, `signUp`,
  `confirmed`, `key`, `linkExpired`, `closed`, `invitation`, `together`) as a decorative image.
  The motion (`docs/design/account/motion.md`) comes later on the layered kits.
- `Logo` is the full logo or the icon, named "twise" for screen readers.
- `StepTrack` is the 3-step journey of the moments: an `<ol>` with `aria-label`, the current step
  with `aria-current="step"` (a spinner while it loads), a solid line up to it and a dashed one
  after (no rounding on the dashed line, which Chrome would draw solid).

## Account layouts
- `AuthLayout` (`components/layout/auth-layout`): the auth screen of
  `../product/requirements/ui-standards.md` → Account screens. On phones, a mint block with the
  owl, flexible from 160 to 320 px, then the title, subtitle, `notice`, the form and the footer
  link, in a 400 px column; an optional `banner` on top. From 1024 px, a mint panel on the left
  (logo, owl, "Leve, claro, a dois." and its support sentence) and the form on the right.
- `MomentScreen`: a full screen with no form, `tone` `celebrate` (mint) or `calm` (cream), the
  owl, the title, the body (`aria-live`, since the same page changes state in place) and the
  actions last; centred on desktop with a 400 px owl block.
- `NextStepCard`: the dashed "what comes next" card of the celebratory moments.
- `AppSplash`: the app opening, mint with the brand owl, "twise" and the slogan; `isSlow` adds
  "Abrindo…". The brand owl file keeps its animation layers, with the sleep and wink layers
  hidden (their final state).
- All three call `useLightTheme()`: account screens are always light, whatever the person chose,
  and the chosen theme comes back when they leave.
- They are page components today: each screen renders its layout. The owl motion (roadmap 18)
  will lift `AuthLayout` into the `_auth` route, so the scene stays mounted between screens.

## Icons
- `lucide-react`, named imports only (each icon is its own module). Never the `icons` namespace or
  `DynamicIcon`, which pull in the whole set.
- **Icons that carry meaning come from a registry** in `components/icons/`: `entryKindIcons`,
  `statusIcons`, `feedbackIcons`, and `accountIcons` (the names a user can pick, stored as the
  account's `icon` string). One meaning, one icon, everywhere.
- Generic icons (chevron, close) are imported directly by design-system components.
- An icon-only control always has an `aria-label` from its messages and a tooltip.

## Copy
- **No user-facing string literal in a `.tsx`** outside `.examples.tsx`. Copy lives in
  `<component>.messages.ts` (design system) or `<feature>.messages.ts` (features), written in pt-BR
  exactly as the screen spec gives it. `pnpm lint:copy` flags JSX text and literal `label`,
  `placeholder`, `title` and `aria-label` props in `.tsx` files.
- API error messages live in one map, `lib/errors/errors.messages.ts`, keyed by code, with the
  message of `../product/requirements/error-messages.md` (the title, for the calm pages; the
  catalog's fallback for the "per field" codes, which the form's own validation already covers).
  `errors.messages.test.ts` reads the catalog and fails on a missing, extra or different message.
  `errorMessageFor(error, values)` (`lib/errors/error-message.ts`) picks and fills it: `{ref}`,
  `{minutos}` from `Retry-After`, the screen's own values; a 5xx with an unknown code shows the
  `INTERNAL_ERROR` message with its `ref`, and a network failure the "Sem conexão" message.
- Plurals and numbers through `Intl` (`Intl.PluralRules('pt-BR')`, `formatBrl`), never string
  concatenation.
- **Later:** if a second language becomes real, move to Lingui; the per-file message objects make
  that mechanical (RNF-I18N-1).

## Workbench
- `/dev/components` exists only in development: the route throws `notFound()` and renders nothing
  outside `import.meta.env.DEV`, so the build drops the workbench code (`features/workbench`).
  It shows a **Tokens** gallery (every colour role, type style, radius and shadow, read from the
  token files) and each component's examples, in light and dark side by side.
- A component's examples are a `ComponentExamples` value (`lib/examples.types.ts`) exported from
  its `index.ts` as `<name>Examples`, and listed once in
  `features/workbench/components/workbench-sections.ts`.
- It is how a component is reviewed against the Claude Design prototype before a screen uses it.
- **Storybook 10** replaces it only if the library outgrows it (around 30+ components, or stories
  wanted as tests); the `.examples.tsx` files then become stories.

## Tests
| Kind | Tool | Covers |
|---|---|---|
| Pure logic (formatters, mappers) | Vitest (node) | Like `packages/shared` |
| Components | Vitest browser mode (Playwright provider, `vitest-browser-react`) | States with behaviour, keyboard, focus; `expectNoA11yViolations()` (axe-core) in each test file |
| Journeys J1–J11 | Playwright e2e + `@axe-core/playwright` | `../product/requirements/experience.md` journeys against the real API (RNF-QUAL-2) |

Browser mode runs components in a real browser, which focus management, popovers and layout need.
Visual snapshots (`toMatchScreenshot`) are **Later**, and only from the CI image, so fonts render
the same.

## React and lint
- **React Compiler** on from the start: `babel({ presets: [reactCompilerPreset()] })` in
  `vite.config.ts` (`@rolldown/plugin-babel` with the preset from `@vitejs/plugin-react`), so tests
  and builds run compiled code. No manual `useMemo`, `useCallback` or `memo` unless a measured case
  needs it.
- Biome covers React and accessibility (`biome.json`): the `react` domain (`useExhaustiveDependencies`,
  `useHookAtTopLevel`, `noNestedComponentDefinitions`...), the a11y group, and
  `nursery/useReactCompiler` as an error, so code the compiler can't optimise fails the lint. No
  ESLint.
- Biome's `useSortedClasses` is not enabled: it still sorts by Tailwind 3 order.

## Adding a component
1. Check the brief's list and this file: does it exist, or is it a variant of one that does?
2. Need a primitive? `pnpm dlx shadcn add <name>` into `components/ui/`, then run
   `pnpm lint:tokens` and fix what upstream brings (`bg-black/50`, `text-white`).
3. Create the folder with the file set; recipe first, then the component.
4. Examples for every state in the brief; review it in `/dev/components`.
5. Tests for behaviour + axe.
6. Upgrading a primitive later: `shadcn add <name> --diff`, merge by hand, keep our token fixes.

## Primitive library
shadcn is initialised with **Base UI** (decided 2026-10-01, ADR 0027), shadcn's default since July
2026. Composition uses its `render` prop. Radix components are never mixed in; examples found
online with `asChild` are translated to `render`.
