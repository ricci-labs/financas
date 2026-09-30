CREATE FUNCTION ledger_accounts_owner_is_member() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE workspace_id = NEW.workspace_id
      AND user_id = NEW.owner_user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User % is not a member of workspace %', NEW.owner_user_id, NEW.workspace_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ledger_accounts_owner_is_member';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_accounts_owner_is_member
  BEFORE INSERT OR UPDATE OF owner_user_id ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION ledger_accounts_owner_is_member();
--> statement-breakpoint
CREATE FUNCTION card_details_holder_is_member() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.holder_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE workspace_id = NEW.workspace_id
      AND user_id = NEW.holder_user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User % is not a member of workspace %', NEW.holder_user_id, NEW.workspace_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'card_details_holder_is_member';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER card_details_holder_is_member
  BEFORE INSERT OR UPDATE OF holder_user_id ON card_details
  FOR EACH ROW EXECUTE FUNCTION card_details_holder_is_member();
