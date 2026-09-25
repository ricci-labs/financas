CREATE FUNCTION journal_entries_spender_is_member() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.spent_by_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE workspace_id = NEW.workspace_id
      AND user_id = NEW.spent_by_user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User % is not a member of workspace %', NEW.spent_by_user_id, NEW.workspace_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'journal_entries_spender_is_member';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER journal_entries_spender_is_member
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entries_spender_is_member();
