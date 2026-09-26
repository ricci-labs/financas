CREATE TABLE "workspace_holidays" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"on_date" date NOT NULL,
	"name" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_holidays_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "workspace_holidays_name" CHECK (length(trim("workspace_holidays"."name")) between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "workspace_holidays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_holidays" ADD CONSTRAINT "workspace_holidays_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_holidays" ADD CONSTRAINT "workspace_holidays_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_holidays_one_per_day" ON "workspace_holidays" USING btree ("workspace_id","on_date") WHERE "workspace_holidays"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "workspace_holidays_tenant_isolation" ON "workspace_holidays" AS PERMISSIVE FOR ALL TO "financas_app" USING ("workspace_holidays"."workspace_id" = app_current_workspace_id()) WITH CHECK ("workspace_holidays"."workspace_id" = app_current_workspace_id());