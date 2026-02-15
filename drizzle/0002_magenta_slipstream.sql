ALTER TABLE `batch_job_items` ADD `promptText` text;--> statement-breakpoint
ALTER TABLE `batch_jobs` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `batch_jobs` ADD `batchConfig` json;--> statement-breakpoint
ALTER TABLE `clients` ADD `gender` enum('female','male') DEFAULT 'female' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `partnerId` int;--> statement-breakpoint
ALTER TABLE `generations` ADD `merchandiseFormat` varchar(100);--> statement-breakpoint
ALTER TABLE `generations` ADD `outputWidth` int;--> statement-breakpoint
ALTER TABLE `generations` ADD `outputHeight` int;--> statement-breakpoint
ALTER TABLE `projects` ADD `partnerClientId` int;--> statement-breakpoint
ALTER TABLE `projects` ADD `projectMode` enum('single','couple') DEFAULT 'single' NOT NULL;