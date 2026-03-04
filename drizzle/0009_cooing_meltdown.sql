ALTER TABLE `client_photos` MODIFY COLUMN `photoType` enum('front','side','additional') NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `projectMode` enum('single','couple') NOT NULL DEFAULT 'single';--> statement-breakpoint
ALTER TABLE `generations` DROP COLUMN `aiReviewScore`;--> statement-breakpoint
ALTER TABLE `generations` DROP COLUMN `aiReviewDetails`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `roleReferenceImages`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `familyMembers`;