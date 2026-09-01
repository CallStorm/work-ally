ALTER TABLE `attachments` ADD COLUMN `extracted_text` LONGTEXT NULL;
ALTER TABLE `model_configs` ADD COLUMN `supports_vision` BOOLEAN NOT NULL DEFAULT false;
