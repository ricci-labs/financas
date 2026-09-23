CREATE TYPE "public"."app_module" AS ENUM('entries', 'accounts', 'cards', 'contacts', 'planning', 'budgets', 'reports', 'attachments', 'settings', 'members', 'audit');--> statement-breakpoint
CREATE TYPE "public"."permission_action" AS ENUM('view', 'create', 'update', 'delete');--> statement-breakpoint
CREATE TABLE "module_actions" (
	"module" "app_module" NOT NULL,
	"action" "permission_action" NOT NULL,
	CONSTRAINT "module_actions_module_action_pk" PRIMARY KEY("module","action")
);
