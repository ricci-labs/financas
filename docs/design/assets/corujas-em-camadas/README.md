---
summary: The Corujas em camadas asset group: layered owl SVGs for CSS animation, one per drawn transition plus one entrance kit per static scene.
read_when: Animating an owl transition, or looking up the piece ids in a layered owl kit.
updated: 2026-10-02
---

# Layered owls (`corujas-em-camadas`)

SVGs to animate with CSS, one per transition already drawn:
- confirm (waiting → confirmed)
- sign-up → check your email
- forgot password → check your email
- confirming → expired link
- new password → expired link
- sign-up closed
- invite (card → second owl)

Each piece has an `id`: `k-base`, `k-olhos-abertos`, `k-olho-esq`, `k-olho-dir`, `k-olhos-sono`, `k-piscadinha`, and one group per object.

They go inline in the CenaCoruja (`OwlScene` in apps/web) component.

## Entrance kits

`kit-boas-vindas`, `kit-cadastro`, `kit-chave`, `kit-sem-conexao`, `kit-espera`, `kit-link-vencido`,
`kit-convite-previa`, `kit-juntos` and `kit-email`: drawn with the same strokes as the static scenes,
so with no animation each renders exactly its `coruja-*.svg` (checked pixel by pixel on 2026-10-02).
They drive the entrances of the static screens (`../../account/motion.md` → Entrance kits); the kits
above stay for screen-to-screen transitions. Extra ids: `k-brilho-1..3`, `k-espiral`, `k-pontos`,
`k-chao`, `k-form`, `k-linha-1..3`, `k-lapis`, `k-key`, `k-nuvem`, `k-wifi` (`k-wifi-risco`),
`k-ampulheta`, `k-zz`, `k-chain`, `k-card`, `k-owl2`, `k-envelope`. The eye state not shown at rest
and `k-piscadinha` come with `opacity="0"`; keyframes override it.
