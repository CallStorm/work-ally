-- CreateTable
CREATE TABLE `notes_ai_threads` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `note_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notes_ai_threads_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    UNIQUE INDEX `notes_ai_threads_tenant_id_user_id_note_id_key`(`tenant_id`, `user_id`, `note_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notes_ai_messages` (
    `id` VARCHAR(191) NOT NULL,
    `thread_id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `draft_md` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notes_ai_messages_thread_id_created_at_idx`(`thread_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notes_ai_threads` ADD CONSTRAINT `notes_ai_threads_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes_ai_threads` ADD CONSTRAINT `notes_ai_threads_note_id_fkey` FOREIGN KEY (`note_id`) REFERENCES `handbook_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes_ai_messages` ADD CONSTRAINT `notes_ai_messages_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `notes_ai_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
