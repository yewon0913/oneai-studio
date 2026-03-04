ALTER TABLE `projects` MODIFY COLUMN `projectMode` enum('single','couple','family') NOT NULL DEFAULT 'single';--> statement-breakpoint
ALTER TABLE `projects` ADD `roleReferenceImages` json;--> statement-breakpoint
ALTER TABLE `projects` ADD `familyMembers` json;