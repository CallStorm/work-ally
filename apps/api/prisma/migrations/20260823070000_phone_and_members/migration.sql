-- Replace email with phone; drop owner role; mark default groups

ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(191) NULL;

UPDATE `users` SET `phone` = REGEXP_REPLACE(`email`, '[^0-9]', '') WHERE `phone` IS NULL;
UPDATE `users` SET `phone` = CONCAT('1', SUBSTRING(`id`, 1, 10)) WHERE `phone` IS NULL OR `phone` = '';

ALTER TABLE `users` DROP INDEX `users_email_key`;
ALTER TABLE `users` DROP COLUMN `email`;
ALTER TABLE `users` MODIFY `phone` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `users_phone_key` ON `users`(`phone`);

UPDATE `memberships` SET `role` = 'admin' WHERE `role` = 'owner';
ALTER TABLE `memberships` MODIFY `role` ENUM('admin', 'member') NOT NULL;

ALTER TABLE `groups` ADD COLUMN `is_default` BOOLEAN NOT NULL DEFAULT false;
UPDATE `groups` SET `is_default` = true WHERE `name` = '默认组';
