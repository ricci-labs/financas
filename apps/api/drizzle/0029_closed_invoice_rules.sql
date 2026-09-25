CREATE TRIGGER card_details_set_updated_at
  BEFORE UPDATE ON card_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER card_invoices_set_updated_at
  BEFORE UPDATE ON card_invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE postings
  ALTER CONSTRAINT postings_invoice_of_the_card_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE card_details
  ALTER CONSTRAINT card_details_payment_account_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION entry_touches_closed_invoice(checked_entry uuid) RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM postings
      JOIN card_invoices invoice
        ON invoice.workspace_id = postings.workspace_id AND invoice.id = postings.invoice_id
      WHERE postings.entry_id = checked_entry AND invoice.status = 'closed'
    )
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION entry_touches_closed_invoice(uuid) FROM PUBLIC, financas_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION postings_guard_insert() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE workspace_id = NEW.workspace_id AND id = NEW.entry_id AND created_at <> now()
  ) THEN
    RAISE EXCEPTION 'Entry % was recorded earlier; its postings are immutable', NEW.entry_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM ledger_accounts
    WHERE workspace_id = NEW.workspace_id AND id = NEW.account_id
      AND (archived_at IS NOT NULL OR deleted_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Account % is archived or deleted', NEW.account_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM card_invoices
    WHERE workspace_id = NEW.workspace_id AND id = NEW.invoice_id AND status = 'closed'
  ) AND NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE workspace_id = NEW.workspace_id AND id = NEW.entry_id
      AND entry_type IN ('adjustment', 'invoice_payment', 'refund')
  ) THEN
    RAISE EXCEPTION 'Invoice % is closed', NEW.invoice_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION journal_entries_guard_changes() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF workspace_is_being_erased(OLD.workspace_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Entry % can only be soft deleted', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF (OLD.workspace_id, OLD.id, OLD.occurred_on, OLD.entry_type, OLD.payment_method,
      OLD.installment_count, OLD.spent_by_user_id, OLD.source, OLD.created_by_user_id,
      OLD.replaces_entry_id, OLD.external_ref, OLD.created_at)
     IS DISTINCT FROM
     (NEW.workspace_id, NEW.id, NEW.occurred_on, NEW.entry_type, NEW.payment_method,
      NEW.installment_count, NEW.spent_by_user_id, NEW.source, NEW.created_by_user_id,
      NEW.replaces_entry_id, NEW.external_ref, NEW.created_at)
  THEN
    RAISE EXCEPTION 'Entry % can only change its description and notes; replace it instead', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF (OLD.deleted_at IS NULL) <> (NEW.deleted_at IS NULL) AND entry_touches_closed_invoice(NEW.id) THEN
    RAISE EXCEPTION 'Entry % is on a closed invoice; correct it with a refund or an adjustment', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1
    FROM postings
    JOIN ledger_accounts account
      ON account.workspace_id = postings.workspace_id AND account.id = postings.account_id
    WHERE postings.entry_id = NEW.id AND account.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Entry % uses a deleted account and cannot be restored', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
