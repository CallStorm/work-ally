-- AlterTable ResourceType enum equivalent: add app to resource_type column values handled by Prisma enum migration

-- CreateTable
CREATE TABLE `app_registry` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(512) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `visibility` ENUM('private', 'restricted', 'tenant') NOT NULL DEFAULT 'tenant',
    `owner_user_id` VARCHAR(191) NOT NULL,
    `default_model_config_id` VARCHAR(191) NULL,
    `ai_actions_enabled` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `app_registry_tenant_id_slug_key`(`tenant_id`, `slug`),
    INDEX `app_registry_tenant_id_enabled_idx`(`tenant_id`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sticky_notes` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('text', 'checklist') NOT NULL DEFAULT 'text',
    `title` VARCHAR(191) NOT NULL DEFAULT '',
    `content` TEXT NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT 'yellow',
    `labels` JSON NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `reminder_at` DATETIME(3) NULL,
    `reminder_fired_at` DATETIME(3) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sticky_notes_tenant_id_user_id_archived_updated_at_idx`(`tenant_id`, `user_id`, `archived`, `updated_at`),
    INDEX `sticky_notes_tenant_id_user_id_reminder_at_idx`(`tenant_id`, `user_id`, `reminder_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sticky_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `note_id` VARCHAR(191) NOT NULL,
    `message` VARCHAR(512) NOT NULL,
    `fired_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read` BOOLEAN NOT NULL DEFAULT false,

    INDEX `sticky_notifications_tenant_id_user_id_read_fired_at_idx`(`tenant_id`, `user_id`, `read`, `fired_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterEnum for acl_entries resource_type: add 'app'
ALTER TABLE `acl_entries` MODIFY `resource_type` ENUM('connector', 'skill', 'expert', 'knowledge', 'app') NOT NULL;

-- AddForeignKey
ALTER TABLE `app_registry` ADD CONSTRAINT `app_registry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sticky_notes` ADD CONSTRAINT `sticky_notes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sticky_notifications` ADD CONSTRAINT `sticky_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
