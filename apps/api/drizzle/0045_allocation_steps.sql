CREATE TYPE "public"."allocation_step_kind" AS ENUM('fill_goal', 'cover_overspent', 'percent', 'fixed_amount', 'rest');--> statement-breakpoint
CREATE TABLE "allocation_steps" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"position" smallint NOT NULL,
	"kind" "allocation_step_kind" NOT NULL,
	"goal_id" uuid,
	"account_id" uuid,
	"percent" smallint,
	"amount_cents" bigint,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_steps_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "allocation_steps_position" CHECK ("allocation_steps"."position" >= 1),
	CONSTRAINT "allocation_steps_goal_only_to_fill" CHECK (("allocation_steps"."kind" = 'fill_goal') = ("allocation_steps"."goal_id" is not null)),
	CONSTRAINT "allocation_steps_account_where_money_moves" CHECK (("allocation_steps"."kind" in ('percent', 'fixed_amount', 'rest')) = ("allocation_steps"."account_id" is not null)),
	CONSTRAINT "allocation_steps_percent" CHECK (("allocation_steps"."kind" = 'percent') = ("allocation_steps"."percent" is not null) and ("allocation_steps"."percent" is null or "allocation_steps"."percent" between 1 and 100)),
	CONSTRAINT "allocation_steps_amount" CHECK (("allocation_steps"."kind" = 'fixed_amount') = ("allocation_steps"."amount_cents" is not null) and ("allocation_steps"."amount_cents" is null or "allocation_steps"."amount_cents" > 0))
);
--> statement-breakpoint
ALTER TABLE "allocation_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "allocation_steps" ADD CONSTRAINT "allocation_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_steps" ADD CONSTRAINT "allocation_steps_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_steps" ADD CONSTRAINT "allocation_steps_goal_fk" FOREIGN KEY ("workspace_id","goal_id") REFERENCES "public"."goals"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_steps" ADD CONSTRAINT "allocation_steps_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."ledger_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_steps_one_per_position" ON "allocation_steps" USING btree ("workspace_id","position") WHERE "allocation_steps"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "allocation_steps_tenant_isolation" ON "allocation_steps" AS PERMISSIVE FOR ALL TO "financas_app" USING ("allocation_steps"."workspace_id" = app_current_workspace_id()) WITH CHECK ("allocation_steps"."workspace_id" = app_current_workspace_id());