CREATE TABLE "charge_payments" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"charge_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_payments_entry_unique" UNIQUE("entry_id"),
	CONSTRAINT "charge_payments_amount" CHECK ("charge_payments"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "charge_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "charge_payments" ADD CONSTRAINT "charge_payments_charge_fk" FOREIGN KEY ("workspace_id","charge_id") REFERENCES "public"."charges"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "charge_payments_tenant_isolation" ON "charge_payments" AS PERMISSIVE FOR ALL TO "financas_app" USING ("charge_payments"."workspace_id" = app_current_workspace_id()) WITH CHECK ("charge_payments"."workspace_id" = app_current_workspace_id());