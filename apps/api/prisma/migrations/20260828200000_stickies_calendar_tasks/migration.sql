-- Drop sticky tables / enum (MySQL)
DROP TABLE IF EXISTS `sticky_notifications`;
DROP TABLE IF EXISTS `sticky_notes`;
DROP TABLE IF EXISTS `StickyNotification`;
-- if enum exists:
-- DROP any leftover; Prisma MySQL often inlines enums

CREATE TABLE `tasks` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `notes` TEXT NOT NULL,
  `completed` BOOLEAN NOT NULL DEFAULT false,
  `completed_at` DATETIME(3) NULL,
  `priority` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  `due_at` DATETIME(3) NOT NULL,
  `all_day` BOOLEAN NOT NULL DEFAULT true,
  `reminder_at` DATETIME(3) NULL,
  `reminder_fired_at` DATETIME(3) NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `tasks_tenant_id_user_id_due_at_idx` (`tenant_id`, `user_id`, `due_at`),
  INDEX `tasks_tenant_id_user_id_reminder_at_idx` (`tenant_id`, `user_id`, `reminder_at`),
  CONSTRAINT `tasks_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `task_notifications` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `task_id` VARCHAR(191) NOT NULL,
  `message` VARCHAR(512) NOT NULL,
  `fired_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`id`),
  INDEX `task_notifications_tenant_id_user_id_read_fired_at_idx` (`tenant_id`, `user_id`, `read`, `fired_at`),
  CONSTRAINT `task_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
