---
summary: Postman collection of every API route (docs/api/financas.postman_collection.json), how to import and run it locally or against the deployed app, and how it is kept complete.
read_when: Testing the API by hand or with the Collection Runner, or adding, renaming or removing a route (the collection must follow).
updated: 2026-09-27
---

# Postman collection

Files:
- `financas.postman_collection.json`: every route, in an order the Collection Runner can follow.
- `financas-local.postman_environment.json`: `baseUrl`, `appOrigin`, `email` and `password` for
  local use.

## Import and run
1. In Postman, import both files. For the deployed app, duplicate the environment and set
   `baseUrl` and `appOrigin` to the app URL, e.g. `https://financas.example.com`. The deployed app
   sits behind Cloudflare Access, so also set `cfAccessClientId` and `cfAccessClientSecret` to an
   Access service token (`../operations/deploy.md` → First deploy, step 5), as current values only.
2. Set `email` and `password` of an existing user (`pnpm ops:create-user`, or
   `node dist/ops/create-user.mjs` in the container). Keep the real password in the environment's
   **current value** only, so it is never exported.
3. Run **Session → Log in** first: Postman keeps the session cookie in its cookie jar for that host.
4. Run the collection (Runner) from top to bottom, leaving out **Manual flows**. Create requests
   save the ids they get (`workspaceId`, `checkingId`, `entryId`, …) in collection variables, and
   later requests use them. **Workspace → Create workspace** makes a fresh workspace to play in.
   The two **Attachments** uploads need a file picked in the `file` field.
5. **Manual flows** need an emailed token (`linkToken`, `invitationToken`: the value after
   `#token=` in the link), a second user, or a destructive choice. Run them one by one.

## What the collection does for you
- **Writes get an `Origin` header.** The API refuses writes that don't prove they come from the app
  (`sameOriginWrites`), and Postman sends no `Origin`. A collection pre-request script adds
  `Origin: {{appOrigin}}` to every non-GET request. `appOrigin` must equal the app's `PUBLIC_URL`:
  in dev that is `http://localhost:5173` (the Vite server, which also proxies `/api`, so `baseUrl`
  can be the same).
- When `cfAccessClientId` and `cfAccessClientSecret` are set, every request carries the Cloudflare
  Access service token headers, so it passes Access without the email code.
- It sets `today`, `pastDay`, `in30Days`, `period` (YYYY-MM), `year` and `nextYear` before each
  request, so the dated examples always fit.
- Every response is checked for no server error, and each happy-path request for its expected
  status.

## Kept complete by a test
`apps/api/src/app.postman.test.ts` compares the collection with the routes of `createApp()`: a
route without a request, or a request for a route that no longer exists, fails `pnpm check`. When
you add or change a route, add or edit its request: copy a similar one in the JSON, or edit it in
Postman and export the collection (v2.1) over this file. Examples use placeholders only
(`Member A`, `Conta X`, `@example.test`), never real household data.

Checked on 2026-09-27 with the Postman CLI runner against the local API: 101 requests and 201
assertions passed (everything except Manual flows).
