---
summary: Code, identifiers, docs and commits are in English; UI text and agent replies are in pt-BR; a glossary bridges them.
read_when: Naming things or writing docs or user-facing text.
updated: 2026-09-22
---

# 0008. English for code and docs, pt-BR for the UI

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
The users speak Brazilian Portuguese. The main reader of the docs is Claude. Code identifiers read most naturally in English.

## Decision
English for code, file names, URLs, docs and commits. pt-BR for all user-facing text (UI and agent replies). Claude talks to the user in pt-BR. `../domain/glossary.md` is the canonical PT↔EN mapping.

## Alternatives considered
- Everything in Portuguese: easier for the user to review, but docs and identifiers would use different vocabulary and cost more tokens.

## Consequences
- Brazilian concepts with no exact English equivalent (fatura, competência, melhor dia de compra) get an English code name plus a glossary entry.
- The root `README.md` is in English like the rest of the docs. Only product text (UI, agent replies) is pt-BR.
