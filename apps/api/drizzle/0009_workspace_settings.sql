CREATE TYPE "public"."budget_base" AS ENUM('fixed_income', 'all_income');--> statement-breakpoint
CREATE TYPE "public"."installment_budget_view" AS ENUM('purchase_month', 'per_installment');--> statement-breakpoint
CREATE TYPE "public"."period_anchor" AS ENUM('calendar_month', 'day_of_month', 'nth_business_day');--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"currency" char(3) DEFAULT 'BRL' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"period_anchor" "period_anchor" DEFAULT 'calendar_month' NOT NULL,
	"period_anchor_value" smallint,
	"installment_budget_view" "installment_budget_view" DEFAULT 'per_installment' NOT NULL,
	"budget_base" "budget_base" DEFAULT 'fixed_income' NOT NULL,
	"week_starts_on" smallint DEFAULT 0 NOT NULL,
	"pix_receiving_key" text,
	"pix_receiver_name" text,
	"pix_receiver_city" text,
	"contact_messages_daily_cap" smallint DEFAULT 20 NOT NULL,
	"charge_reminder_every_days" smallint DEFAULT 3,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_settings_currency_iso" CHECK ("workspace_settings"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "workspace_settings_period_anchor_value" CHECK (("workspace_settings"."period_anchor" = 'calendar_month' and "workspace_settings"."period_anchor_value" is null)
        or ("workspace_settings"."period_anchor" = 'day_of_month'
          and "workspace_settings"."period_anchor_value" is not null
          and "workspace_settings"."period_anchor_value" between 1 and 31)
        or ("workspace_settings"."period_anchor" = 'nth_business_day'
          and "workspace_settings"."period_anchor_value" is not null
          and "workspace_settings"."period_anchor_value" between 1 and 10)),
	CONSTRAINT "workspace_settings_week_start" CHECK ("workspace_settings"."week_starts_on" between 0 and 6),
	CONSTRAINT "workspace_settings_pix_complete" CHECK ("workspace_settings"."pix_receiving_key" is null
        or ("workspace_settings"."pix_receiver_name" is not null and "workspace_settings"."pix_receiver_city" is not null)),
	CONSTRAINT "workspace_settings_pix_lengths" CHECK (coalesce(length("workspace_settings"."pix_receiver_name"), 0) <= 25
        and coalesce(length("workspace_settings"."pix_receiver_city"), 0) <= 15),
	CONSTRAINT "workspace_settings_daily_cap" CHECK ("workspace_settings"."contact_messages_daily_cap" >= 0),
	CONSTRAINT "workspace_settings_reminder_interval" CHECK ("workspace_settings"."charge_reminder_every_days" is null or "workspace_settings"."charge_reminder_every_days" >= 1)
);
--> statement-breakpoint
ALTER TABLE "workspace_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "workspace_settings_tenant_isolation" ON "workspace_settings" AS PERMISSIVE FOR ALL TO "financas_app" USING ("workspace_settings"."workspace_id" = app_current_workspace_id()) WITH CHECK ("workspace_settings"."workspace_id" = app_current_workspace_id());