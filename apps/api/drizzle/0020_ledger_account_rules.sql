CREATE FUNCTION ledger_accounts_refuse_cycles() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT NEW.parent_id
      UNION
      SELECT account.parent_id
      FROM ledger_accounts account
      JOIN ancestors ON account.id = ancestors.id
      WHERE account.parent_id IS NOT NULL
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Account % cannot be placed under its own descendant', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_accounts_refuse_cycles
  BEFORE INSERT OR UPDATE OF parent_id ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION ledger_accounts_refuse_cycles();
--> statement-breakpoint
CREATE FUNCTION ledger_accounts_keep_tree_active() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM ledger_accounts
    WHERE workspace_id = NEW.workspace_id AND id = NEW.parent_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Parent account % was deleted', NEW.parent_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM ledger_accounts
    WHERE workspace_id = NEW.workspace_id AND parent_id = NEW.id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Account % has active children', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_accounts_keep_tree_active
  BEFORE INSERT OR UPDATE OF parent_id, deleted_at ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION ledger_accounts_keep_tree_active();
--> statement-breakpoint
CREATE FUNCTION ledger_accounts_protect_system() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF (OLD.is_system OR NEW.is_system)
     AND (OLD.name, OLD.kind, OLD.parent_id, OLD.archived_at, OLD.deleted_at)
         IS DISTINCT FROM (NEW.name, NEW.kind, NEW.parent_id, NEW.archived_at, NEW.deleted_at)
  THEN
    RAISE EXCEPTION 'System account % can only be personalized', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_accounts_protect_system
  AFTER UPDATE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION ledger_accounts_protect_system();
