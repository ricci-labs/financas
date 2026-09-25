CREATE FUNCTION assert_entry_is_balanced(checked_entry uuid) RETURNS void
  LANGUAGE plpgsql
  AS $$
DECLARE
  line_count integer;
  total bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE id = checked_entry) THEN
    RETURN;
  END IF;

  SELECT count(*), coalesce(sum(amount_cents), 0)
    INTO line_count, total
    FROM postings
    WHERE entry_id = checked_entry;

  IF line_count < 2 THEN
    RAISE EXCEPTION 'Entry % needs at least two postings, has %', checked_entry, line_count
      USING ERRCODE = 'check_violation';
  END IF;

  IF total <> 0 THEN
    RAISE EXCEPTION 'Postings of entry % sum to %, not zero', checked_entry, total
      USING ERRCODE = 'check_violation';
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION assert_entry_is_balanced(uuid) FROM PUBLIC, financas_app;
--> statement-breakpoint
CREATE FUNCTION journal_entries_must_balance() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  PERFORM assert_entry_is_balanced(NEW.id);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE FUNCTION postings_must_balance() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  PERFORM assert_entry_is_balanced(NEW.entry_id);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_entries_must_balance
  AFTER INSERT ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION journal_entries_must_balance();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER postings_must_balance
  AFTER INSERT ON postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION postings_must_balance();
--> statement-breakpoint
CREATE FUNCTION workspace_is_being_erased(checked_workspace uuid) RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$ SELECT NOT EXISTS (SELECT 1 FROM workspaces WHERE id = checked_workspace) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION workspace_is_being_erased(uuid) FROM PUBLIC, financas_app;
--> statement-breakpoint
CREATE FUNCTION journal_entries_stamp_creation() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.created_at = now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER journal_entries_stamp_creation
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entries_stamp_creation();
--> statement-breakpoint
CREATE FUNCTION journal_entries_guard_changes() RETURNS trigger
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
--> statement-breakpoint
CREATE TRIGGER journal_entries_guard_changes
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entries_guard_changes();
--> statement-breakpoint
CREATE FUNCTION postings_guard_insert() RETURNS trigger
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

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER postings_guard_insert
  BEFORE INSERT ON postings
  FOR EACH ROW EXECUTE FUNCTION postings_guard_insert();
--> statement-breakpoint
CREATE FUNCTION postings_are_immutable() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF TG_OP = 'DELETE' AND workspace_is_being_erased(OLD.workspace_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Postings are immutable; replace entry % instead', OLD.entry_id
    USING ERRCODE = 'check_violation';
END
$$;
--> statement-breakpoint
CREATE TRIGGER postings_are_immutable
  BEFORE UPDATE OR DELETE ON postings
  FOR EACH ROW EXECUTE FUNCTION postings_are_immutable();
--> statement-breakpoint
CREATE FUNCTION ledger_accounts_refuse_deleting_used() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND EXISTS (
    SELECT 1
    FROM postings
    JOIN journal_entries entry
      ON entry.workspace_id = postings.workspace_id AND entry.id = postings.entry_id
    WHERE postings.workspace_id = NEW.workspace_id
      AND postings.account_id = NEW.id
      AND entry.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Account % is used by active entries; archive it instead', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_accounts_refuse_deleting_used
  BEFORE UPDATE OF deleted_at ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION ledger_accounts_refuse_deleting_used();
