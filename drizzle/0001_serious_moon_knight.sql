CREATE TABLE `batch_job_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchJobId` int NOT NULL,
	`projectId` int,
	`generationId` int,
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_job_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batch_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('queued','processing','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`totalItems` int NOT NULL DEFAULT 0,
	`completedItems` int NOT NULL DEFAULT 0,
	`failedItems` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`photoType` enum('front','side','additional') NOT NULL,
	`originalUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileName` varchar(255),
	`mimeType` varchar(100),
	`fileSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(30),
	`email` varchar(320),
	`consultationNotes` text,
	`preferredConcept` varchar(100),
	`status` enum('consulting','in_progress','completed','delivered') NOT NULL DEFAULT 'consulting',
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`clientId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`watermarkEnabled` boolean NOT NULL DEFAULT false,
	`galleryUrl` text,
	`downloadLinks` json,
	`status` enum('preparing','ready','sent','viewed') NOT NULL DEFAULT 'preparing',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`promptId` int,
	`promptText` text NOT NULL,
	`negativePrompt` text,
	`parameters` json,
	`resultImageUrl` text,
	`resultImageKey` varchar(512),
	`status` enum('pending','generating','completed','failed','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
	`qualityScore` int,
	`faceConsistencyScore` int,
	`reviewNotes` text,
	`stage` enum('draft','review','upscaled','final') NOT NULL DEFAULT 'draft',
	`upscaledImageUrl` text,
	`upscaledImageKey` varchar(512),
	`generationTimeMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('generation_complete','photo_uploaded','urgent_revision','batch_complete','delivery_viewed','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`relatedProjectId` int,
	`relatedClientId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `photo_restorations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`projectId` int,
	`originalUrl` text NOT NULL,
	`originalKey` varchar(512) NOT NULL,
	`restoredUrl` text,
	`restoredKey` varchar(512),
	`restorationType` enum('face_restore','colorize','denoise','upscale','full') NOT NULL DEFAULT 'full',
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `photo_restorations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` enum('wedding','restoration','kids','profile','video','custom') NOT NULL DEFAULT 'wedding',
	`concept` varchar(255),
	`status` enum('draft','generating','review','revision','upscaling','completed','delivered') NOT NULL DEFAULT 'draft',
	`referenceImageUrl` text,
	`referenceImageKey` varchar(512),
	`pinterestUrl` text,
	`notes` text,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('wedding','restoration','kids','profile','video','custom') NOT NULL DEFAULT 'wedding',
	`subcategory` varchar(100),
	`title` varchar(255) NOT NULL,
	`prompt` text NOT NULL,
	`negativePrompt` text,
	`parameters` json,
	`thumbnailUrl` text,
	`usageCount` int NOT NULL DEFAULT 0,
	`rating` int DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prompt_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generationId` int NOT NULL,
	`projectId` int NOT NULL,
	`sourceImageUrl` text NOT NULL,
	`videoUrl` text,
	`videoKey` varchar(512),
	`duration` int DEFAULT 5,
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_conversions_id` PRIMARY KEY(`id`)
);
