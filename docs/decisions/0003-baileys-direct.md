---
summary: WhatsApp via Baileys (WhiskeySockets) used directly in the API process — not Evolution API, not the official Cloud API.
read_when: Touching the WhatsApp channel or reconsidering how WhatsApp is integrated.
updated: 2026-09-22
---

# 0003. Baileys directly for WhatsApp

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
The couple needs a WhatsApp bot for personal use at low volume. The server has little RAM. The user wants control over the integration.

## Decision
Use `baileys` (WhiskeySockets) directly inside the API process, with a dedicated SIM and the auth state stored in Postgres.

## Alternatives considered
- Evolution API: a wrapper around Baileys with a panel, multi-instance support and Redis. It's more moving parts and RAM for a single bot.
- Official WhatsApp Cloud API (Meta): stable with no ban risk, but it needs a business setup and approved templates, and may cost money per conversation.

## Consequences
- Unofficial: a ban is possible, so use a dedicated number and low volume.
- Breaking changes are frequent: pin the exact version, upgrade on purpose.
- We own reconnection, dedup, the send queue and auth-state persistence (`../integrations/whatsapp.md`).
