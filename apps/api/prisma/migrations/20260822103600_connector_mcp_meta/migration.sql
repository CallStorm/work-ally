-- MCP initialize metadata cached from server (instructions / serverInfo)
ALTER TABLE `connectors`
  ADD COLUMN `mcp_instructions` LONGTEXT NULL,
  ADD COLUMN `mcp_server_name` VARCHAR(191) NULL,
  ADD COLUMN `mcp_server_version` VARCHAR(191) NULL,
  ADD COLUMN `mcp_synced_at` DATETIME(3) NULL;
