CREATE FUNCTION roles_refuse_unsafe_delete() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.system_key IS NOT NULL THEN
    RAISE EXCEPTION 'System role % cannot be deleted', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE workspace_id = NEW.workspace_id AND role_id = NEW.id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Role % is assigned to an active member', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM invitations
    WHERE workspace_id = NEW.workspace_id AND role_id = NEW.id
      AND accepted_at IS NULL AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Role % is used by a pending invitation', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER roles_refuse_unsafe_delete
  BEFORE UPDATE OF deleted_at ON roles
  FOR EACH ROW EXECUTE FUNCTION roles_refuse_unsafe_delete();
--> statement-breakpoint
CREATE FUNCTION assigned_role_must_be_active() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM roles
    WHERE workspace_id = NEW.workspace_id AND id = NEW.role_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Role % was deleted', NEW.role_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER memberships_role_must_be_active
  BEFORE INSERT OR UPDATE OF role_id, deleted_at ON memberships
  FOR EACH ROW EXECUTE FUNCTION assigned_role_must_be_active();
--> statement-breakpoint
CREATE TRIGGER invitations_role_must_be_active
  BEFORE INSERT OR UPDATE OF role_id, deleted_at ON invitations
  FOR EACH ROW EXECUTE FUNCTION assigned_role_must_be_active();
