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
- Classes are joined with `cn()` from `lib/cn.ts` (shadcn's `cn`), which merges conflicts.
- Compound states use `compoundVariants` (`{ variant: 'danger', size: 'sm', class: … }`).
- Every class in a recipe is a token utility (`web-design-tokens.md` → The rule).

## Forms
React Hook Form v7 + `zodResolver` with the **schemas from `@financas/shared`** (ADR 0005,
`../product/requirements/ui-standards.md` → Forms and validation). RHF v8 waits until it's stable.

- `useForm({ resolver: zodResolver(schema), mode: 'onTouched' })`: validates on the first blur,
  then on every change, which is the rule decided on 2026-09-29.
- `Form` provides the form; `FormField` is the only way to render a field. It wires the visible
  label, the "*" for required fields, the help text, the error with its icon, `aria-invalid`,
  `aria-required` and `aria-describedby` (help + error ids from `useId`), and the counter. Built on
  shadcn's `Field` parts, which don't wire `aria-describedby` themselves.
- Fields render through `Controller`, and `field.onBlur` is always passed down, or `onTouched`
  stops working.
- Read live values with `useWatch`, never `form.watch()` (it opts the component out of the React
  Compiler).
- `SubmitButton` implements the button contract: disabled until valid (and dirty on edit forms)
  with `aria-disabled` and no hint sentence (tapping it marks the missing fields and focuses the
  first), the spinner with the gerund label, one request per press. Waiting is the `Button`'s
  `waitUntil` prop (countdown that releases itself).
- Server errors: `applyApiError(form, error)` (`lib/errors/`) puts a code with a field in the
  "Shown as" column of `../product/requirements/error-messages.md` under that field with `setError`, and the rest above the
  buttons.

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
- `/dev/components` exists only in development (`import.meta.env.DEV`; the route is tree-shaken
  from the build). It renders every `.examples.tsx` by family, plus a **Tokens** page with every
  colour role, type step, radius, shadow and duration, in light and dark side by side.
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
