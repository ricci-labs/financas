CREATE VIEW "public"."account_balances" WITH (security_invoker = true) AS (
    select
      account.workspace_id,
      account.id as account_id,
      account.kind,
      account.class,
      coalesce(sum(line.amount_cents) filter (where entry.id is not null), 0)::bigint
        as balance_cents,
      (case when account.class in ('liability', 'income', 'equity') then -1 else 1 end
        * coalesce(sum(line.amount_cents) filter (where entry.id is not null), 0))::bigint
        as natural_balance_cents
    from ledger_accounts account
    left join postings line
      on line.workspace_id = account.workspace_id and line.account_id = account.id
    left join journal_entries entry
      on entry.workspace_id = line.workspace_id
      and entry.id = line.entry_id
      and entry.deleted_at is null
    where account.deleted_at is null
    group by account.workspace_id, account.id, account.kind, account.class
  );--> statement-breakpoint
CREATE VIEW "public"."invoice_totals" WITH (security_invoker = true) AS (
    select
      invoice.workspace_id,
      invoice.id as invoice_id,
      invoice.card_account_id,
      invoice.reference_month,
      invoice.closing_on,
      invoice.due_on,
      invoice.status,
      coalesce(-sum(line.amount_cents)
        filter (where entry.entry_type <> 'invoice_payment'), 0)::bigint as total_cents,
      coalesce(sum(line.amount_cents)
        filter (where entry.entry_type = 'invoice_payment'), 0)::bigint as paid_cents,
      coalesce(-sum(line.amount_cents) filter (where entry.id is not null), 0)::bigint
        as due_cents
    from card_invoices invoice
    left join postings line
      on line.workspace_id = invoice.workspace_id and line.invoice_id = invoice.id
    left join journal_entries entry
      on entry.workspace_id = line.workspace_id
      and entry.id = line.entry_id
      and entry.deleted_at is null
    group by invoice.workspace_id, invoice.id
  );