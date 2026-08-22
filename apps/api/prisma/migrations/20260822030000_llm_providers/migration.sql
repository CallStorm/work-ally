-- CreateTable
CREATE TABLE `llm_providers` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `preset` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `base_url` VARCHAR(191) NOT NULL,
    `api_key_enc` TEXT NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `llm_providers_tenant_id_enabled_idx`(`tenant_id`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `model_configs` DROP INDEX `model_configs_tenant_id_model_id_key`;
ALTER TABLE `model_configs` ADD COLUMN `provider_id` VARCHAR(191) NULL;
ALTER TABLE `model_configs` ALTER COLUMN `is_auto_candidate` SET DEFAULT false;

-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `model_config_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `model_configs_tenant_id_provider_id_model_id_key` ON `model_configs`(`tenant_id`, `provider_id`, `model_id`);

-- AddForeignKey
ALTER TABLE `llm_providers` ADD CONSTRAINT `llm_providers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `model_configs` ADD CONSTRAINT `model_configs_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `llm_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_model_config_id_fkey` FOREIGN KEY (`model_config_id`) REFERENCES `model_configs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove legacy auto rows
DELETE FROM `model_configs` WHERE `model_id` = 'auto';
