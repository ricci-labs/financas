CREATE FUNCTION assert_role_module_has_view(checked_role uuid, checked_module app_module) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM role_permissions
       WHERE role_id = checked_role AND module = checked_module AND action <> 'view'
     )
     AND NOT EXISTS (
       SELECT 1 FROM role_permissions
       WHERE role_id = checked_role AND module = checked_module AND action = 'view'
     )
  THEN
    RAISE EXCEPTION 'Role % has permissions on module % without view', checked_role, checked_module
      USING ERRCODE = 'check_violation';
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION role_permissions_require_view() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM assert_role_module_has_view(OLD.role_id, OLD.module);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM assert_role_module_has_view(NEW.role_id, NEW.module);
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER role_permissions_require_view
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION role_permissions_require_view();
