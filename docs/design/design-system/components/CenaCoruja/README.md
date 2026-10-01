---
summary: The CenaCoruja component: the layered SVG owl scene used on account screens and moments, its files, rules and code shape.
read_when: Building or changing an owl scene, its layered SVG kits or its CSS animations.
updated: 2026-10-01
---

# CenaCoruja

CenaCoruja (`OwlScene` in apps/web) is the owl illustration used on the account screens and in the moments. It is a **layered SVG** so it can be animated with CSS only.

**Files:**
- Asset group **Corujas**: the finished scene, for `<img>`.
- Asset group **Corujas em camadas** (`kit-…`): for inline animation.
- Each kit has one `id` per piece:
  - `k-base` (owl, coins, plant, background)
  - `k-olhos-abertos` (with `k-olho-esq` and `k-olho-dir`)
  - `k-olhos-sono`
  - `k-piscadinha`
  - one group per object (`k-ampulheta`, `k-envelope`, `k-chain`, `k-key`, `k-lockShackle`, `k-lockBody`, `k-card`, `k-owl2`, `k-spark1`…)

**Main rule:** the base never changes between screens. Between screens of the same flow, and between states of the same page, the owl block stays mounted. Only the object and the expression change.

**Motion:**
- The 17 entrances, their timings and curves, the order of an achievement and of a warning, and the catalog of which scene uses which entrance live in the design-system README (`docs/design/design-system/README.md`), under **States and motion → Owl motion**.
- Each sequence plays once. Only "Esperar" (wait) repeats, and only while something is loading.
- With `prefers-reduced-motion`, the scene appears directly in its final state.

**Where it goes:**
- Inside TelaConta (mint top, flexible from 160 to 320 px).
- Inside Momento (center, minimum 180 px; 400 px on desktop).
- Always on `mint` or `sketch-paper`.

**In code:**
- An `OwlScene` component with `scene` (which scene), `state` (which object and expression) and `play` (which sequence to play on the change).
- The kit SVG goes inline (imported with `?raw` in Vite), and the animations are CSS classes that target the `id`s.
- No animation library.
