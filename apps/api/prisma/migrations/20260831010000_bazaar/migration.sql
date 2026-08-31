-- CreateTable
CREATE TABLE `bazaar_companies` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `slogan` VARCHAR(120) NOT NULL DEFAULT '',
    `stall_skin` VARCHAR(32) NOT NULL DEFAULT 'neon-blue',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bazaar_companies_tenant_id_user_id_key`(`tenant_id`, `user_id`),
    INDEX `bazaar_companies_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bazaar_products` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `pitch` TEXT NOT NULL,
    `features_json` TEXT NOT NULL,
    `cover_hue` INTEGER NOT NULL DEFAULT 210,
    `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
    `score` INTEGER NOT NULL DEFAULT 0,
    `rating_count` INTEGER NOT NULL DEFAULT 0,
    `avg_stars` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bazaar_products_tenant_id_status_published_at_idx`(`tenant_id`, `status`, `published_at`),
    INDEX `bazaar_products_tenant_id_status_score_idx`(`tenant_id`, `status`, `score`),
    INDEX `bazaar_products_tenant_id_company_id_idx`(`tenant_id`, `company_id`),
    INDEX `bazaar_products_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bazaar_ratings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `stars` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bazaar_ratings_product_id_user_id_key`(`product_id`, `user_id`),
    INDEX `bazaar_ratings_tenant_id_product_id_idx`(`tenant_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bazaar_companies` ADD CONSTRAINT `bazaar_companies_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_products` ADD CONSTRAINT `bazaar_products_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_products` ADD CONSTRAINT `bazaar_products_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `bazaar_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_ratings` ADD CONSTRAINT `bazaar_ratings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_ratings` ADD CONSTRAINT `bazaar_ratings_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `bazaar_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
