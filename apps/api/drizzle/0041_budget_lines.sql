CREATE TABLE "budget_lines" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"category_account_id" uuid NOT NULL,
	"limit_cents" bigint,
	"valid_from" date NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_lines_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "budget_lines_limit" CHECK ("budget_lines"."limit_cents" is null or "budget_lines"."limit_cents" > 0),
	CONSTRAINT "budget_lines_valid_from_first_day" CHECK (extract(day from "budget_lines"."valid_from") = 1)
);
--> statement-breakpoint
ALTER TABLE "budget_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_category_fk" FOREIGN KEY ("workspace_id","category_account_id") REFERENCES "public"."ledger_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_lines_one_per_category_and_period" ON "budget_lines" USING btree ("workspace_id","category_account_id","valid_from") WHERE "budget_lines"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "budget_lines_tenant_isolation" ON "budget_lines" AS PERMISSIVE FOR ALL TO "financas_app" USING ("budget_lines"."workspace_id" = app_current_workspace_id()) WITH CHECK ("budget_lines"."workspace_id" = app_current_workspace_id());