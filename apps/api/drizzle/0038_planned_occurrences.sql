CREATE TYPE "public"."occurrence_status" AS ENUM('pending', 'matched', 'skipped');--> statement-breakpoint
CREATE TABLE "planned_occurrences" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"rule_id" uuid NOT NULL,
	"due_on" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" "occurrence_status" DEFAULT 'pending' NOT NULL,
	"matched_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planned_occurrences_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "planned_occurrences_rule_due_on_unique" UNIQUE("rule_id","due_on"),
	CONSTRAINT "planned_occurrences_amount" CHECK ("planned_occurrences"."amount_cents" > 0),
	CONSTRAINT "planned_occurrences_matched_has_entry" CHECK (("planned_occurrences"."status" = 'matched') = ("planned_occurrences"."matched_entry_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "planned_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "planned_occurrences" ADD CONSTRAINT "planned_occurrences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_occurrences" ADD CONSTRAINT "planned_occurrences_rule_fk" FOREIGN KEY ("workspace_id","rule_id") REFERENCES "public"."recurrence_rules"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_occurrences" ADD CONSTRAINT "planned_occurrences_matched_entry_fk" FOREIGN KEY ("workspace_id","matched_entry_id") REFERENCES "public"."journal_entries"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "planned_occurrences_one_per_entry" ON "planned_occurrences" USING btree ("workspace_id","matched_entry_id") WHERE "planned_occurrences"."matched_entry_id" is not null;--> statement-breakpoint
CREATE POLICY "planned_occurrences_tenant_isolation" ON "planned_occurrences" AS PERMISSIVE FOR ALL TO "financas_app" USING ("planned_occurrences"."workspace_id" = app_current_workspace_id()) WITH CHECK ("planned_occurrences"."workspace_id" = app_current_workspace_id());