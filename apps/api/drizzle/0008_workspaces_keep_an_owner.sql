CREATE FUNCTION assert_workspace_has_owner(checked_workspace uuid) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspaces WHERE id = checked_workspace) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM memberships
    JOIN roles ON roles.workspace_id = memberships.workspace_id AND roles.id = memberships.role_id
    WHERE memberships.workspace_id = checked_workspace
      AND memberships.deleted_at IS NULL
      AND roles.deleted_at IS NULL
      AND roles.system_key = 'owner'
  ) THEN
    RAISE EXCEPTION 'Workspace % must keep at least one active owner', checked_workspace
      USING ERRCODE = 'check_violation';
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION workspaces_require_an_owner() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM assert_workspace_has_owner(NEW.id);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE FUNCTION owner_may_have_been_removed() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM assert_workspace_has_owner(OLD.workspace_id);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER workspaces_require_an_owner
  AFTER INSERT ON workspaces
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION workspaces_require_an_owner();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER memberships_keep_an_owner
  AFTER UPDATE OR DELETE ON memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION owner_may_have_been_removed();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER roles_keep_an_owner
  AFTER UPDATE OR DELETE ON roles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION owner_may_have_been_removed();
