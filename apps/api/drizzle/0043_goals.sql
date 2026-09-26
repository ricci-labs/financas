CREATE TABLE "goals" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"target_cents" bigint NOT NULL,
	"target_on" date,
	"account_id" uuid NOT NULL,
	"is_reserve" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "goals_name" CHECK (length(trim("goals"."name")) between 1 and 80),
	CONSTRAINT "goals_target" CHECK ("goals"."target_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."ledger_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_per_account" ON "goals" USING btree ("workspace_id","account_id") WHERE "goals"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_reserve" ON "goals" USING btree ("workspace_id") WHERE "goals"."is_reserve" and "goals"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "goals_tenant_isolation" ON "goals" AS PERMISSIVE FOR ALL TO "financas_app" USING ("goals"."workspace_id" = app_current_workspace_id()) WITH CHECK ("goals"."workspace_id" = app_current_workspace_id());