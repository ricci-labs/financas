---
summary: Web is a Vite + React 19 SPA with Tailwind v4, shadcn/ui, TanStack Router/Query/Table, Recharts, PWA — served as static files by Hono.
read_when: Touching the web app setup, or considering SSR or another UI framework.
updated: 2026-09-22
---

# 0005. Vite + React SPA with Tailwind v4 and shadcn/ui

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
A private dashboard behind a login. No SEO. Must be usable on phones. The server has limited RAM.

## Decision
A Vite + React 19 + TypeScript SPA. Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui components, TanStack Router (file-based, typed search params), TanStack Query, TanStack Table, React Hook Form + Zod, Recharts, and `vite-plugin-pwa`. The build output is served by the API process.

## Alternatives considered
- Next.js / TanStack Start / React Router framework mode / SvelteKit: SSR brings an extra Node process and more complexity for no benefit here.
- Svelte 5: lighter and pleasant to use, but has a smaller ecosystem (no shadcn equivalent at the same maturity). It was the runner-up.

## Consequences
- No frontend server: zero extra RAM at runtime.
- Installable on phones through the PWA.
- shadcn components are copied into `components/ui` and are ours to maintain.
