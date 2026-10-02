---
summary: How the owl scenes animate: the fixed-scene rule, the 17 named entrances with timing and easing, which scene uses which, and the layered SVG ids.
read_when: Animating an owl scene, a screen transition in the account area, or the app opening.
updated: 2026-10-02
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

## Entrance kits (static screens)

Files `kit-boas-vindas`, `kit-cadastro`, `kit-chave`, `kit-sem-conexao`, `kit-espera`, `kit-link-vencido`, `kit-convite-previa`, `kit-juntos`, `kit-email` in `../assets/corujas-em-camadas/`. Each is drawn with the **same strokes as its static scene** (`../assets/corujas/coruja-*.svg`): with no animation it renders exactly the static image, so the entrance never "jumps" when it ends. The eye state not shown at rest (`k-olhos-sono` or `k-olhos-abertos`) and `k-piscadinha` carry `opacity="0"`; keyframes override it. The older transition kits (`kit-cadastro-enviado`, `kit-esqueci-enviado`, …) stay for screen-to-screen transitions only.

Ids beyond the common ones: `k-brilho-1..3` (one per sparkle stroke), `k-espiral`, `k-pontos`, `k-chao`, `k-form`, `k-linha-1..3`, `k-lapis`, `k-key`, `k-nuvem`, `k-wifi` (with `k-wifi-risco`), `k-ampulheta`, `k-zz`, `k-chain`, `k-card`, `k-owl2`, `k-envelope`.

| Demo | Kit | Entrance | Timing |
|---|---|---|---|
| [`Animacao-entrada-login`](animations/Animacao-entrada-login.html) | `kit-boas-vindas` | Estalar (3 sparkle strokes one by one), then curl and dots appear | 0.35 / 0.47 / 0.59 s strokes, curl 0.75 s, dots 0.9 s; ends 1.1 s |
| [`Animacao-entrada-cadastro`](animations/Animacao-entrada-cadastro.html) | `kit-cadastro` | Escrever: card appears, pencil scribbles, lines written one by one, sparkle | card 0.2 s, pencil 0.45 s, lines 0.6 / 0.75 / 0.9 s, sparkle 1.15 s; ends 1.5 s |
| [`Animacao-entrada-chave`](animations/Animacao-entrada-chave.html) | `kit-chave` | Surgir + Girar, curl, sparkle after the turn | key 0.3 s, turn 0.65–1.1 s, curl 0.5 s, sparkle 1.1 s; ends 1.45 s |
| [`Animacao-entrada-sem-conexao`](animations/Animacao-entrada-sem-conexao.html) | `kit-sem-conexao` | warning: owl dozes, cloud appears and swings, wifi, slash | doze 0.3 s, cloud 0.5–1.6 s, wifi 0.9 s, slash 1.15 s; no sparkle |
| [`Animacao-entrada-espera`](animations/Animacao-entrada-espera.html) | `kit-espera` | Esperar once: hourglass turns and stops, zz rises | hourglass 0.5–1.2 s, zz 0.6–1.3 s; no loop |
| [`Animacao-entrada-link-vencido`](animations/Animacao-entrada-link-vencido.html) | `kit-link-vencido` | warning: eyes already closed, chain appears and swings | chain 0.3 s, swing 0.65–1.4 s, text 0.4 s, actions 0.75 s |
| [`Animacao-entrada-convite`](animations/Animacao-entrada-convite.html) | `kit-convite-previa` | Surgir + Estalar (card); 'for another person' (cream) without sparkle | card 0.3 s, sparkle 0.7 s, text 0.4 s, actions 0.8 s |
| [`Animacao-entrada-ja-participa`](animations/Animacao-entrada-ja-participa.html) | `kit-juntos` | Chegar only; sparkle fades in, no pop, no wink | owl2 0.3–0.75 s, sparkle 0.8 s, text 0.5 s, action 0.85 s |
| [`Animacao-entrada-envelope`](animations/Animacao-entrada-envelope.html) | `kit-email` | Surgir + Flutuar; sparkle fades in with it | envelope 0.3 s, float 0.65–1.45 s, text 0.4 s, actions 0.8 s |

Form screens (`/_auth`): play the entrance only on the first opening in the session; when moving between auth screens the owl stays mounted and uses the transition rules above instead.
