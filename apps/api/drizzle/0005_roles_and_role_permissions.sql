CREATE TYPE "public"."system_role_key" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"workspace_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"module" "app_module" NOT NULL,
	"action" "permission_action" NOT NULL,
	CONSTRAINT "role_permissions_role_id_module_action_pk" PRIMARY KEY("role_id","module","action")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"system_key" "system_role_key",
	"description" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_workspace_id_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_fk" FOREIGN KEY ("workspace_id","role_id") REFERENCES "public"."roles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_module_action_fk" FOREIGN KEY ("module","action") REFERENCES "public"."module_actions"("module","action") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_unique" ON "roles" USING btree ("workspace_id",lower("name")) WHERE "roles"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_system_key_unique" ON "roles" USING btree ("workspace_id","system_key") WHERE "roles"."system_key" is not null and "roles"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "role_permissions_tenant_isolation" ON "role_permissions" AS PERMISSIVE FOR ALL TO "financas_app" USING ("role_permissions"."workspace_id" = app_current_workspace_id()) WITH CHECK ("role_permissions"."workspace_id" = app_current_workspace_id());--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL TO "financas_app" USING ("roles"."workspace_id" = app_current_workspace_id()) WITH CHECK ("roles"."workspace_id" = app_current_workspace_id());