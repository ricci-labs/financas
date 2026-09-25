ALTER FUNCTION workspaces_require_an_owner() SECURITY DEFINER SET search_path = public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION owner_may_have_been_removed() SECURITY DEFINER SET search_path = public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION role_permissions_require_view() SECURITY DEFINER SET search_path = public, pg_temp;
--> statement-breakpoint
REVOKE ALL ON FUNCTION assert_workspace_has_owner(uuid) FROM PUBLIC, financas_app;
--> statement-breakpoint
REVOKE ALL ON FUNCTION assert_role_module_has_view(uuid, app_module) FROM PUBLIC, financas_app;
