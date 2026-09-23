---
name: adr
description: Record an architectural decision as a new ADR in docs/decisions and update the index. Use when the user and Claude settle a structural/tooling/process choice, when superseding an earlier decision, or when the user says "registra essa decisão" / "cria um ADR".
---

# Write an ADR

1. List existing ADRs: `ls docs/decisions/`. The next number is the highest `NNNN` + 1 (zero-padded to 4).
2. Check that no accepted ADR already covers this. If one does, the new ADR **supersedes** it. Never edit the old ADR's content.
3. Create `docs/decisions/NNNN-<short-kebab-title>.md` from the template in `docs/decisions/README.md`:
   - Frontmatter `summary` = the decision in one line; `read_when` = the situation that should trigger reading it; `updated` = today.
   - Context: the forces and constraints, including the server's limits if relevant.
   - Decision: what we do, stated plainly.
   - Alternatives considered: each with the concrete reason it lost.
   - Consequences: what gets easier, what gets harder, follow-up work.
   - Status is `Accepted` only if the user agreed in the conversation. Otherwise `Proposed`.
4. Add a row to the index table in `docs/decisions/README.md`.
5. If superseding: set the old ADR's status line to `Superseded by NNNN` and bump its `updated:`. This is the only edit allowed on an old ADR.
6. Update any doc that references the decision (grep for the old ADR number or topic) and bump their `updated:`.

## Checklist
- [ ] Number is sequential and the file name is kebab-case
- [ ] Frontmatter has summary, read_when, updated
- [ ] Every alternative has a reason it lost
- [ ] Index row added
- [ ] Referencing docs updated
