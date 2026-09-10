DROP INDEX "calendar_events_owner_id_idx";--> statement-breakpoint
-- Temporarily default existing events to the migration timestamp; remove defaults after backfill.
ALTER TABLE "calendar_events" ADD COLUMN "start_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "end_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "is_regular" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "regular_config" jsonb;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "start_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "end_at" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "calendar_events_owner_id_start_at_idx" ON "calendar_events" USING btree ("owner_id","start_at");
