CREATE TABLE "membership_preferences" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"notify_bills_days_before" smallint DEFAULT 3 NOT NULL,
	"notify_channel" "notification_channel" DEFAULT 'whatsapp' NOT NULL,
	"notify_daily_digest" boolean DEFAULT false NOT NULL,
	"notify_budget_threshold_pct" smallint DEFAULT 80 NOT NULL,
	"notify_variable_income" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_preferences_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "membership_preferences_bills_days" CHECK ("membership_preferences"."notify_bills_days_before" between 0 and 30),
	CONSTRAINT "membership_preferences_budget_threshold" CHECK ("membership_preferences"."notify_budget_threshold_pct" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "membership_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "membership_preferences" ADD CONSTRAINT "membership_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_preferences" ADD CONSTRAINT "membership_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "membership_preferences_tenant_isolation" ON "membership_preferences" AS PERMISSIVE FOR ALL TO "financas_app" USING ("membership_preferences"."workspace_id" = app_current_workspace_id()) WITH CHECK ("membership_preferences"."workspace_id" = app_current_workspace_id());