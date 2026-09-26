CREATE TYPE "public"."recurrence_frequency" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_entry_type" AS ENUM('expense', 'income', 'card_purchase', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."weekend_rule" AS ENUM('keep', 'previous_business_day', 'next_business_day');--> statement-breakpoint
CREATE TABLE "recurrence_rules" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"description" text NOT NULL,
	"entry_type" "recurring_entry_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"amount_is_estimate" boolean DEFAULT false NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"interval" smallint DEFAULT 1 NOT NULL,
	"day_of_month" smallint,
	"nth_business_day" smallint,
	"weekend_rule" "weekend_rule" DEFAULT 'keep' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"source_account_id" uuid NOT NULL,
	"category_account_id" uuid NOT NULL,
	"remind_days_before" smallint,
	"auto_record" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurrence_rules_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "recurrence_rules_description" CHECK (length(trim("recurrence_rules"."description")) between 1 and 200),
	CONSTRAINT "recurrence_rules_amount" CHECK ("recurrence_rules"."amount_cents" > 0),
	CONSTRAINT "recurrence_rules_interval" CHECK ("recurrence_rules"."interval" between 1 and 52),
	CONSTRAINT "recurrence_rules_day_of_month" CHECK ("recurrence_rules"."day_of_month" is null or "recurrence_rules"."day_of_month" between 1 and 31),
	CONSTRAINT "recurrence_rules_nth_business_day" CHECK ("recurrence_rules"."nth_business_day" is null or "recurrence_rules"."nth_business_day" between 1 and 10),
	CONSTRAINT "recurrence_rules_one_day_choice" CHECK ("recurrence_rules"."day_of_month" is null or "recurrence_rules"."nth_business_day" is null),
	CONSTRAINT "recurrence_rules_weekly_repeats_weekday" CHECK ("recurrence_rules"."frequency" <> 'weekly' or ("recurrence_rules"."day_of_month" is null and "recurrence_rules"."nth_business_day" is null)),
	CONSTRAINT "recurrence_rules_ends_after_start" CHECK ("recurrence_rules"."ends_on" is null or "recurrence_rules"."ends_on" >= "recurrence_rules"."starts_on"),
	CONSTRAINT "recurrence_rules_remind_days_before" CHECK ("recurrence_rules"."remind_days_before" is null or "recurrence_rules"."remind_days_before" between 0 and 30),
	CONSTRAINT "recurrence_rules_two_accounts" CHECK ("recurrence_rules"."source_account_id" <> "recurrence_rules"."category_account_id")
);
--> statement-breakpoint
ALTER TABLE "recurrence_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_source_account_fk" FOREIGN KEY ("workspace_id","source_account_id") REFERENCES "public"."ledger_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_category_account_fk" FOREIGN KEY ("workspace_id","category_account_id") REFERENCES "public"."ledger_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "recurrence_rules_tenant_isolation" ON "recurrence_rules" AS PERMISSIVE FOR ALL TO "financas_app" USING ("recurrence_rules"."workspace_id" = app_current_workspace_id()) WITH CHECK ("recurrence_rules"."workspace_id" = app_current_workspace_id());