---
summary: How the owl scenes animate: the fixed-scene rule, the 17 named entrances with timing and easing, which scene uses which, and the layered SVG ids.
read_when: Animating an owl scene, a screen transition in the account area, or the app opening.
updated: 2026-10-01
---

# Owl motion

Looped demos: `animations/*.html` (in the app every sequence plays **once**). Full rationale (pt-BR): `../design-system/README.md` → "Movimento da coruja".

## Rules

- **The scene base never changes screen.** Owl, coins, plant and backdrop stay; only the object next to the owl and the owl's expression change. Between `/login`, `/signup`, `/forgot-password`, `/reset-password` the owl block stays mounted (`/_auth` layout route).
- A sequence plays once and ends within 2 s of the event. Only "Esperar" loops, and only while something loads.
- Achievement: sparkle and wink allowed. Warning: cream background, contained movement, **never** sparkle or wink.
- `prefers-reduced-motion: reduce` → jump to the final state.
- CSS only (keyframes on the SVG group `id`s with `transform-box: fill-box`). No animation library.

## Entrances

| Name | What it does | Duration | Easing |
|---|---|---|---|
| Sair (leave) | old object shrinks to nothing in place | 300 ms | ease-in-out |
| Surgir (appear) | new object scales 0 → 1.12 → 1 | 350 ms | cubic-bezier(.3,1.5,.6,1) |
| Desenhar (draw) | pen marks revealed left to right (clip) | 450 ms | ease-out |
| Estalar (pop) | sparkle strokes scale 0 → 1.2 → 1 from the base; 2nd group +200 ms | 300 ms each | cubic-bezier(.3,1.6,.6,1) |
| Abrir os olhos (wake) | lids vanish, pupils scaleY 0.1 → 1 | 250 ms | ease-out |
| Piscadinha (wink) | mint eye closes into "^" and reopens | 600 ms | ease |
| Trocar texto (swap text) | old text up 6 px and out; new text down 8 px and in, same place | 250 + 250 ms | ease |
| Subir ações (raise actions) | card and buttons rise 16 px, last | 300 ms | ease |
| Esperar (wait) | hourglass turns, "zz" rise | 1.2 s loop | ease-in-out |
| Flutuar (float) | after appearing, object rises 5 px and back once | 800 ms | ease-in-out |
| Balançar (swing) | hanging object swings once from its top (−9° → 6° → −2° → 0) | 550 ms | ease |
| Travar (lock) | shackle drops 12 px, small jolt (−4° → 3° → 0) | 150 + 300 ms | ease-in |
| Fechar os olhos (doze) | reverse of wake | 250 ms | ease-in |
| Trocar fundo (bg swap) | same page waiting → warning: mint → cream | 400 ms | ease |
| Chegar (arrive) | second owl slides 40 px from the side, 0.6 → 1.04 → 1 | 450 ms | cubic-bezier(.3,1.4,.6,1) |
| Girar (turn) | key turns −20° → 10° → 0 after appearing | 450 ms | ease-out |
| Escrever (write) | form lines appear one by one | 150 ms per line | ease-out |

Achievement order: Sair → Abrir os olhos → Surgir → Desenhar → Estalar → Trocar texto → Subir ações → Piscadinha.
Warning order: Sair → Trocar fundo (if coming from a wait) → Fechar os olhos → Surgir → Balançar/Travar → Trocar texto → Subir ações.

## Scene catalog

| Scene (asset) | Object | Kind | Entrance |
|---|---|---|---|
| `coruja-boas-vindas` | sparkle | arrival | Estalar |
| `coruja-espera` | hourglass, zz | waiting | Esperar (loop while loading) |
| `coruja-email` | envelope | handoff | Surgir + Flutuar |
| `coruja-sem-conexao` | cloud | warning | Surgir + Balançar |
| `coruja-cadastro` | form card | form | Escrever |
| `coruja-confirmado` | check | achievement | Surgir + Desenhar + Estalar + Piscadinha |
| `coruja-chave` | key | form | Surgir + Girar |
| `coruja-link-vencido` | broken chain | warning | Fechar os olhos + Surgir + Balançar |
| `coruja-fechado` | padlock | warning | Surgir + Travar + Fechar os olhos |
| `coruja-convite` | invitation card | handoff | Surgir + Estalar |
| `corujas-juntos` | second owl | achievement | Chegar + Estalar + Piscadinha |
| brand owl (splash) | sparkle, eyes | brand | Surgir + Abrir os olhos + Estalar ×3 + Piscadinha; name and slogan rise after |

Category illustrations and email images never animate.

## Layered SVG ids

Files in `../assets/corujas-em-camadas/`. Common ids: `k-base`, `k-olhos-abertos` (`k-olho-esq`, `k-olho-dir`), `k-olhos-sono`, `k-piscadinha`. Objects: `k-ampulheta`/`k-hourglass`, `k-zz`, `k-envelope`, `k-form`, `k-key`, `k-chain`, `k-lockShackle`, `k-lockBody`, `k-card`, `k-owl2`, `k-check-circulo`, `k-check-marca` (clipped by `k-revela`), `k-brilho-*`/`k-spark*`. The splash owl uses `o-corpo`, `o-olho-esq`, `o-olho-dir`, `o-sono`, `o-pisca`, `o-b1..3` (see `animations/Animacao-abertura.html`).
