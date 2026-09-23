---
summary: How the WhatsApp channel works with Baileys — session storage, allowlist, reconnection, sending, media, ban-risk mitigations.
read_when: Working on apps/api/src/channels/whatsapp or anything that sends/receives WhatsApp messages.
updated: 2026-09-22
---

# WhatsApp channel (Baileys)

Decision and alternatives: `../decisions/0003-baileys-direct.md`.

## Setup
- A **dedicated SIM/number** for the bot, never a personal number. Baileys is unofficial, so a ban is possible and must not hit anyone's personal account.
- The Baileys version is **pinned exactly** in `package.json`. Upgrades are deliberate: read the changelog, then test pairing and send/receive.
- Pairing: on first boot (or after logout) the QR code/pairing code is printed to the logs (Dokploy log view). Scan it from the bot's phone.

## Session storage
- Don't use `useMultiFileAuthState` in production. It's meant for demos and does heavy file I/O.
- Implement the auth state on Postgres (`channels/whatsapp/auth-state.ts`): creds plus signal keys as rows, with writes batched. Deploys then don't require re-pairing.

## Inbound
1. Ignore groups, broadcasts, status updates and messages sent by the bot itself.
2. **Allowlist:** process only messages whose sender JID matches a `member.whatsappJid`. Drop everything else silently.
3. Normalize to an internal type `{ memberId, messageId, text?, audio?, image?, quotedMessageId?, receivedAt }`.
4. Deduplicate by `messageId`, because Baileys can deliver the same message twice on reconnect.
5. Hand off to the agent without blocking the socket event loop.

## Outbound
- Every send goes through a queue in `outbound.ts`: one in flight at a time, a small random delay between sends, retry with backoff.
- Show "typing…" presence while the agent is working, as a small UX touch.
- Keep messages short. WhatsApp formatting: `*bold*`, `_italic_`, lists with `•`.

## Connection lifecycle
- Handle `connection.update`: on `close`, reconnect with exponential backoff (cap ~5 min) **unless** the reason is `loggedOut`. In that case, log loudly and wait for re-pairing.
- Expose `/api/health/whatsapp` (connected / reconnecting / logged out). Uptime Kuma already runs on the server and can monitor it and alert.
- On SIGTERM, close the socket cleanly before the process exits.

## Media
- Audio (phase 2): download the voice note, transcribe it, then treat the text as a normal message. The transcription option is an open question in `../product/roadmap.md`.
- Images (phase 2): download and send to Claude as an image block (receipt reading).
- Don't store media after processing unless the user asks. Keep only the extracted data.

## Ban-risk mitigations
- Low volume: two users and a handful of messages a day.
- Never message numbers outside the allowlist, never bulk-send, never join groups.
- Keep the pinned Baileys version reasonably current. Very old protocol versions get flagged.
