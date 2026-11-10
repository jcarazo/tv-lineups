CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`country_code` text NOT NULL,
	`name` text NOT NULL,
	`logo` text,
	`keywords` text DEFAULT '[]' NOT NULL,
	`epg_ids` text DEFAULT '[]' NOT NULL,
	`category_id` integer,
	`logo_status` text DEFAULT 'unchecked' NOT NULL,
	`logo_http_status` integer,
	`logo_content_type` text,
	`logo_error` text,
	`logo_checked_at` integer,
	`logo_flagged` integer DEFAULT false NOT NULL,
	`logo_flag_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`country_code`) REFERENCES `countries`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_country_name` ON `channels` (`country_code`,`name`);--> statement-breakpoint
CREATE TABLE `countries` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lineup_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lineup_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`dial` integer NOT NULL,
	FOREIGN KEY (`lineup_id`) REFERENCES `lineups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_lineup_dial` ON `lineup_entries` (`lineup_id`,`dial`);--> statement-breakpoint
CREATE UNIQUE INDEX `entries_lineup_channel` ON `lineup_entries` (`lineup_id`,`channel_id`);--> statement-breakpoint
CREATE TABLE `lineups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`country_code` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`country_code`) REFERENCES `countries`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lineups_country_slug` ON `lineups` (`country_code`,`slug`);