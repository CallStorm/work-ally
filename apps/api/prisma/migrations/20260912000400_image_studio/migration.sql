-- CreateTable
CREATE TABLE `image_studio_models` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'openai_compatible',
    `base_url` VARCHAR(512) NOT NULL,
    `api_key_enc` TEXT NOT NULL,
    `model_name` VARCHAR(191) NOT NULL,
    `capabilities` JSON NOT NULL,
    `default_params` JSON NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `image_studio_models_tenant_id_enabled_idx`(`tenant_id`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `image_studio_projects` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `description` VARCHAR(2000) NOT NULL DEFAULT '',
    `cover_object_key` VARCHAR(512) NULL,
    `current_asset_id` VARCHAR(191) NULL,
    `default_model_id` VARCHAR(191) NULL,
    `starred` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `workspace_state` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `image_studio_projects_tenant_id_user_id_deleted_at_idx`(`tenant_id`, `user_id`, `deleted_at`),
    INDEX `image_studio_projects_tenant_id_user_id_updated_at_idx`(`tenant_id`, `user_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `image_studio_turns` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `parent_turn_id` VARCHAR(191) NULL,
    `prompt` TEXT NOT NULL,
    `model_id` VARCHAR(191) NOT NULL,
    `source_asset_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `image_studio_turns_project_id_created_at_idx`(`project_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `image_studio_assets` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `turn_id` VARCHAR(191) NULL,
    `object_key` VARCHAR(512) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `mime_type` VARCHAR(128) NOT NULL DEFAULT 'image/png',
    `selected` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `image_studio_assets_project_id_created_at_idx`(`project_id`, `created_at`),
    INDEX `image_studio_assets_turn_id_idx`(`turn_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `image_studio_models` ADD CONSTRAINT `image_studio_models_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_studio_projects` ADD CONSTRAINT `image_studio_projects_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_studio_projects` ADD CONSTRAINT `image_studio_projects_default_model_id_fkey` FOREIGN KEY (`default_model_id`) REFERENCES `image_studio_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_studio_turns` ADD CONSTRAINT `image_studio_turns_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `image_studio_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_studio_turns` ADD CONSTRAINT `image_studio_turns_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `image_studio_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_studio_turns` ADD CONSTRAINT `image_studio_turns_parent_turn_id_fkey` FOREIGN KEY (`parent_turn_id`) REFERENCES `image_studio_turns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_studio_assets` ADD CONSTRAINT `image_studio_assets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `image_studio_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_studio_assets` ADD CONSTRAINT `image_studio_assets_turn_id_fkey` FOREIGN KEY (`turn_id`) REFERENCES `image_studio_turns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
