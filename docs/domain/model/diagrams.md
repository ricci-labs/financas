---
summary: Mermaid ER diagrams of every model area (tenancy and access, ledger, third parties, planning, support), rendered by GitHub; key columns only.
read_when: You need a visual of tables and relationships, or are reviewing the model. Column details live in the area docs.
updated: 2026-09-25
---

# Model diagrams

Key columns only. Every tenant table also has `workspace_id` (composite FKs), `created_at`,
`updated_at`, and, where user-facing, `deleted_at` / `deleted_by_user_id`. Those are omitted to keep
the diagrams readable. Full columns: the area docs linked in each section.

## 1. Tenancy and access (`tenancy.md`, `access-control.md`)

```mermaid
erDiagram
    users ||--o{ channel_identities : "reached via"
    users ||--o{ sessions : has
    users ||--o{ auth_tokens : "email links"
    users ||--|| user_preferences : has
    users ||--o{ memberships : "belongs to"
    workspaces ||--o{ memberships : has
    workspaces ||--|| workspace_settings : has
    workspaces ||--o{ roles : defines
    workspaces ||--o{ invitations : sends
    roles ||--o{ memberships : grants
    roles ||--o{ role_permissions : contains
    module_actions ||--o{ role_permissions : "valid pair"
    memberships ||--|| membership_preferences : has
    roles ||--o{ invitations : "offered role"

    users {
        uuid id PK
        citext email UK
        text display_name
    }
    channel_identities {
        uuid id PK
        uuid user_id FK
        enum channel "whatsapp | email"
        text address UK "E.164"
        timestamptz verified_at
    }
    workspaces {
        uuid id PK "tenant key"
        text name
        uuid created_by_user_id FK
    }
    memberships {
        uuid workspace_id FK
        uuid user_id FK
        uuid role_id FK
    }
    roles {
        uuid id PK
        text name
        text system_key "owner | admin | member | viewer | null"
    }
    role_permissions {
        uuid role_id FK
        enum module FK
        enum action FK "view | create | update | delete"
    }
    module_actions {
        enum module PK
        enum action PK
    }
    workspace_settings {
        uuid workspace_id PK
        enum period_anchor
        smallint period_anchor_value
        enum installment_budget_view
        text pix_receiving_key
    }
```

## 2. Ledger (`ledger.md`)

```mermaid
erDiagram
    ledger_accounts ||--o{ ledger_accounts : "parent of"
    institutions ||--o{ ledger_accounts : issues
    ledger_accounts ||--o| card_details : "is a card"
    ledger_accounts ||--o{ card_invoices : "card has"
    journal_entries ||--|{ postings : "2+ lines, sum = 0"
    ledger_accounts ||--o{ postings : "posted to"
    card_invoices ||--o{ postings : "billed on"
    contacts ||--o{ postings : "owes via"
    journal_entries |o--o| journal_entries : "replaces"

    ledger_accounts {
        uuid id PK
        uuid parent_id FK
        enum kind "checking | savings | cash_wallet | credit_card | receivable | expense_category ..."
        enum class "generated: asset | liability | income | expense | equity"
        text name
        enum income_nature "fixed | variable"
        timestamptz archived_at
    }
    card_details {
        uuid account_id PK
        smallint closing_day
        smallint due_day
        bool purchase_on_closing_day_goes_next
        bigint limit_cents
    }
    card_invoices {
        uuid id PK
        uuid card_account_id FK
        date reference_month UK
        date closing_on
        date due_on
        enum status "future | open | closed"
    }
    journal_entries {
        uuid id PK
        date occurred_on
        text description
        enum entry_type
        enum payment_method
        smallint installment_count
        uuid replaces_entry_id FK
        timestamptz deleted_at
    }
    postings {
        uuid id PK
        uuid entry_id FK
        uuid account_id FK
        enum account_kind FK "composite FK for CHECKs"
        bigint amount_cents "signed, debit +"
        date effective_on
        uuid invoice_id FK
        uuid contact_id FK
        smallint installment_no
    }
```

## 3. Third parties (`third-parties.md`)

```mermaid
erDiagram
    contacts ||--o{ postings : "receivable lines"
    contacts ||--o{ charges : "is charged"
    charges ||--|{ charge_items : covers
    postings ||--o| charge_items : "charged as"
    charges ||--o{ charge_payments : "paid by"
    journal_entries ||--o{ charge_payments : "settlement entry"

    contacts {
        uuid id PK
        text name
        text phone_e164 UK
        timestamptz opted_out_at
    }
    charges {
        uuid id PK
        uuid contact_id FK
        bigint amount_cents
        date due_on
        enum status "draft | sent | partially_paid | paid | cancelled"
        text pix_payload
        timestamptz sent_at
    }
    charge_items {
        uuid charge_id FK
        uuid posting_id FK
        bigint amount_cents
    }
    charge_payments {
        uuid charge_id FK
        uuid entry_id FK
        bigint amount_cents
    }
```

## 4. Planning (`planning.md`)

```mermaid
erDiagram
    recurrence_rules ||--o{ planned_occurrences : generates
    planned_occurrences |o--o| journal_entries : "matched to"
    ledger_accounts ||--o{ recurrence_rules : "source / category"
    contacts ||--o{ recurrence_rules : "recurring charge"
    ledger_accounts ||--o{ budget_lines : "category limit"
    ledger_accounts ||--o{ goals : "held in"

    recurrence_rules {
        uuid id PK
        text description
        enum entry_type
        bigint amount_cents
        bool amount_is_estimate
        enum frequency
        smallint day_of_month
        smallint nth_business_day
        bool auto_record
    }
    planned_occurrences {
        uuid id PK
        uuid rule_id FK
        date due_on UK
        bigint amount_cents
        enum status "pending | matched | skipped"
        uuid matched_entry_id FK
    }
    budget_lines {
        uuid id PK
        uuid category_account_id FK
        bigint limit_cents
        date valid_from_period UK
    }
    goals {
        uuid id PK
        text name
        bigint target_cents
        uuid account_id FK
    }
    holidays {
        uuid id PK
        date on_date
        enum scope "national | workspace"
    }
```

## 5. Support (`support.md`)

```mermaid
erDiagram
    journal_entries ||--o{ entry_tags : tagged
    tags ||--o{ entry_tags : labels
    journal_entries ||--o{ entry_attachments : has
    charges ||--o{ charge_attachments : has
    files ||--o{ entry_attachments : "attached as"
    files ||--o{ charge_attachments : "attached as"
    users ||--o{ notification_outbox : "recipient"
    contacts ||--o{ notification_outbox : "recipient"
    users ||--o{ agent_runs : "talks to agent"
    users ||--o{ pending_actions : confirms

    files {
        uuid id PK
        text storage_key
        text mime_type
        text sha256 UK
    }
    notification_outbox {
        uuid id PK
        enum kind
        enum channel
        timestamptz scheduled_for
        enum status
        text dedupe_key UK
    }
    audit_log {
        uuid id PK
        uuid actor_user_id FK
        text action
        text table_name
        uuid row_id
        jsonb before
        jsonb after
    }
    agent_runs {
        uuid id PK
        text trace_id
        uuid user_id FK
        jsonb tool_calls
        numeric cost_usd
    }
    pending_actions {
        uuid id PK
        uuid user_id FK
        jsonb payload
        enum status
        timestamptz expires_at
    }
```
