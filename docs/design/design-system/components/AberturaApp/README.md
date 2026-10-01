---
summary: The app splash screen (PWA splash): layout, the brand entrance animation and its timing rule.
read_when: Building or changing the app splash screen, the PWA manifest colors or the brand entrance animation.
updated: 2026-10-01
---

# AberturaApp

AberturaApp (`AppSplash` in apps/web) is the app's opening screen (the PWA splash): `mint` background, the owl, the name and the slogan.

- Owl at **200px**.
- "twise" in Bricolage Grotesque 64px.
- "Leve, claro, a dois." in Figtree 18px/600.
- Everything in `on-mint`, centered.
- In the PWA, the manifest `background_color` is `mint` (#80dca5), and so is `theme_color`. This keeps the transition from the icon to the app seamless.

**Brand entrance (plays once on open):**
- The owl rises from below (0–0.45 s).
- It wakes up: the eyelids fade and the eyes open (0.55–0.8 s).
- The three sparkle strokes pop one by one (0.85 / 0.95 / 1.05 s).
- The name rises (0.6–0.9 s) and the slogan comes in (0.8–1.1 s).
- It ends with the wink of the mint eye (1.55–2.1 s).
- The owl SVG is layered: body, left eye, right eye, eyelids, wink and the three sparkles.

**Timing rule:** the animation never holds the app back.
- It plays while the app checks the session (`GET /api/auth/me`).
- If the response arrives before 1.2 s, the app waits only until 1.2 s and the wink is skipped.
- If it takes longer than 1.5 s, "Abrindo…" (opening) appears below with a small spinner.
- With `prefers-reduced-motion`, the screen appears ready, with no animation.
