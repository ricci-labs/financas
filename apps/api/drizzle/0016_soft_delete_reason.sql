ALTER TABLE "roles" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "delete_reason" text;