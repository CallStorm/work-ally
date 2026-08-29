-- MySQL utf8mb4 TEXT is 65,535 bytes; 50k CJK exceeds that.
ALTER TABLE `handbook_notes` MODIFY `body_md` LONGTEXT NOT NULL;
