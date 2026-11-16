-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `failed_login_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deactivated_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_active_idx`(`active`),
    INDEX `users_deactivated_at_idx`(`deactivated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assigned_by` CHAR(36) NULL,

    INDEX `user_roles_role_id_idx`(`role_id`),
    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` CHAR(36) NOT NULL,
    `permission_id` CHAR(36) NOT NULL,

    INDEX `role_permissions_permission_id_idx`(`permission_id`),
    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `family_id` CHAR(36) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `replaced_by_id` CHAR(36) NULL,
    `user_agent` VARCHAR(255) NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
    INDEX `refresh_tokens_family_id_idx`(`family_id`),
    INDEX `refresh_tokens_revoked_at_idx`(`revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_records` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `idempotency_key` VARCHAR(64) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `status` ENUM('PROCESSING', 'COMPLETED') NOT NULL,
    `response_status` SMALLINT NULL,
    `resource_type` VARCHAR(50) NULL,
    `resource_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `idempotency_records_expires_at_idx`(`expires_at`),
    INDEX `idempotency_records_resource_type_resource_id_idx`(`resource_type`, `resource_id`),
    UNIQUE INDEX `idempotency_records_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('SEDE', 'ALMACEN', 'AREA', 'TALLER') NOT NULL,
    `parent_id` CHAR(36) NULL,
    `address` VARCHAR(255) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `locations_code_key`(`code`),
    INDEX `locations_parent_id_idx`(`parent_id`),
    INDEX `locations_type_idx`(`type`),
    INDEX `locations_active_idx`(`active`),
    UNIQUE INDEX `locations_parent_id_name_key`(`parent_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extinguisher_types` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `agent` VARCHAR(60) NOT NULL,
    `nominal_capacity` DECIMAL(10, 2) NOT NULL,
    `capacity_unit` ENUM('KG', 'L', 'LB') NOT NULL,
    `useful_life_years` SMALLINT UNSIGNED NULL,
    `description` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `extinguisher_types_code_key`(`code`),
    INDEX `extinguisher_types_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_parties` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `party_type` ENUM('PROVEEDOR_MANTENIMIENTO', 'TALLER', 'PROVEEDOR', 'OTRO') NOT NULL,
    `tax_id` VARCHAR(20) NULL,
    `contact_name` VARCHAR(150) NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(255) NULL,
    `address` VARCHAR(255) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `external_parties_code_key`(`code`),
    INDEX `external_parties_active_idx`(`active`),
    INDEX `external_parties_party_type_idx`(`party_type`),
    INDEX `external_parties_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `assigned_user_id` CHAR(36) NOT NULL,
    `last_sync_at` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `devices_code_key`(`code`),
    INDEX `devices_assigned_user_id_active_idx`(`assigned_user_id`, `active`),
    INDEX `devices_last_sync_at_idx`(`last_sync_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extinguishers` (
    `id` CHAR(36) NOT NULL,
    `asset_code` VARCHAR(20) NOT NULL,
    `serial_number` VARCHAR(100) NULL,
    `type_id` CHAR(36) NOT NULL,
    `brand` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `capacity_value` DECIMAL(10, 2) NOT NULL,
    `capacity_unit` ENUM('KG', 'L', 'LB') NOT NULL,
    `manufacture_date` DATE NULL,
    `acquired_at` DATE NULL,
    `commissioned_at` DATE NULL,
    `manufacturer_expiry_date` DATE NULL,
    `logistics_status` ENUM('EN_ALMACEN', 'ASIGNADO', 'EN_MANTENIMIENTO', 'DADO_DE_BAJA') NOT NULL,
    `technical_condition` ENUM('OPERATIVO', 'OBSERVADO', 'NO_OPERATIVO', 'PENDIENTE_INSPECCION') NOT NULL,
    `placement_type` ENUM('INTERNAL', 'EXTERNAL', 'NONE') NOT NULL,
    `current_location_id` CHAR(36) NULL,
    `current_external_party_id` CHAR(36) NULL,
    `current_since` DATETIME(3) NULL,
    `retired_at` DATETIME(3) NULL,
    `retirement_reason` VARCHAR(500) NULL,
    `notes` TEXT NULL,
    `row_version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `extinguishers_asset_code_key`(`asset_code`),
    INDEX `extinguishers_serial_number_idx`(`serial_number`),
    INDEX `extinguishers_current_location_id_logistics_status_idx`(`current_location_id`, `logistics_status`),
    INDEX `extinguishers_current_external_party_id_idx`(`current_external_party_id`),
    INDEX `extinguishers_logistics_status_idx`(`logistics_status`),
    INDEX `extinguishers_technical_condition_idx`(`technical_condition`),
    INDEX `extinguishers_type_id_idx`(`type_id`),
    INDEX `extinguishers_manufacturer_expiry_date_idx`(`manufacturer_expiry_date`),
    INDEX `extinguishers_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movements` (
    `id` CHAR(36) NOT NULL,
    `extinguisher_id` CHAR(36) NOT NULL,
    `asset_sequence` INTEGER UNSIGNED NOT NULL,
    `movement_type` ENUM('INGRESO', 'SALIDA', 'TRASLADO', 'RETORNO_ALMACEN', 'ENVIO_MANTENIMIENTO', 'RETORNO_MANTENIMIENTO', 'BAJA', 'AJUSTE') NOT NULL,
    `entry_source` ENUM('COMPRA_CENTRAL', 'COMPRA_LOCAL', 'CARGA_INICIAL', 'RETORNO_MANTENIMIENTO', 'TRASLADO') NULL,
    `origin_kind` ENUM('LOCATION', 'EXTERNAL_PARTY', 'NONE') NOT NULL,
    `origin_location_id` CHAR(36) NULL,
    `origin_external_party_id` CHAR(36) NULL,
    `origin_label` VARCHAR(255) NOT NULL,
    `destination_kind` ENUM('LOCATION', 'EXTERNAL_PARTY', 'NONE') NOT NULL,
    `destination_location_id` CHAR(36) NULL,
    `destination_external_party_id` CHAR(36) NULL,
    `destination_label` VARCHAR(255) NOT NULL,
    `moved_at` DATETIME(3) NOT NULL,
    `requested_by` VARCHAR(150) NULL,
    `authorized_by` VARCHAR(150) NULL,
    `delivered_by` VARCHAR(150) NULL,
    `received_by` VARCHAR(150) NULL,
    `reason` VARCHAR(500) NOT NULL,
    `document_ref` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `corrects_movement_id` CHAR(36) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `client_uuid` CHAR(36) NULL,
    `capture_mode` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
    `device_id` CHAR(36) NULL,
    `synced_at` DATETIME(3) NULL,

    UNIQUE INDEX `movements_client_uuid_key`(`client_uuid`),
    INDEX `movements_extinguisher_id_moved_at_idx`(`extinguisher_id`, `moved_at`),
    INDEX `movements_movement_type_moved_at_idx`(`movement_type`, `moved_at`),
    INDEX `movements_origin_location_id_idx`(`origin_location_id`),
    INDEX `movements_destination_location_id_idx`(`destination_location_id`),
    INDEX `movements_origin_external_party_id_idx`(`origin_external_party_id`),
    INDEX `movements_destination_external_party_id_idx`(`destination_external_party_id`),
    INDEX `movements_created_by_created_at_idx`(`created_by`, `created_at`),
    INDEX `movements_device_id_synced_at_idx`(`device_id`, `synced_at`),
    INDEX `movements_created_at_idx`(`created_at`),
    UNIQUE INDEX `movements_extinguisher_id_asset_sequence_key`(`extinguisher_id`, `asset_sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_orders` (
    `id` CHAR(36) NOT NULL,
    `extinguisher_id` CHAR(36) NOT NULL,
    `provider_id` CHAR(36) NULL,
    `workshop_location_id` CHAR(36) NULL,
    `status` ENUM('ABIERTA', 'EN_PROVEEDOR', 'CERRADA', 'CANCELADA') NOT NULL,
    `sent_movement_id` CHAR(36) NOT NULL,
    `return_movement_id` CHAR(36) NULL,
    `opened_at` DATETIME(3) NOT NULL,
    `expected_return_date` DATE NULL,
    `closed_at` DATETIME(3) NULL,
    `reason` VARCHAR(500) NOT NULL,
    `authorized_by` VARCHAR(150) NULL,
    `document_ref` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `maintenance_orders_sent_movement_id_key`(`sent_movement_id`),
    UNIQUE INDEX `maintenance_orders_return_movement_id_key`(`return_movement_id`),
    INDEX `maintenance_orders_extinguisher_id_status_idx`(`extinguisher_id`, `status`),
    INDEX `maintenance_orders_provider_id_idx`(`provider_id`),
    INDEX `maintenance_orders_workshop_location_id_idx`(`workshop_location_id`),
    INDEX `maintenance_orders_expected_return_date_idx`(`expected_return_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_services` (
    `id` CHAR(36) NOT NULL,
    `extinguisher_id` CHAR(36) NOT NULL,
    `maintenance_order_id` CHAR(36) NULL,
    `service_type` ENUM('MANTENIMIENTO', 'RECARGA', 'REPARACION', 'PRUEBA_HIDROSTATICA') NOT NULL,
    `performed_at` DATETIME(3) NOT NULL,
    `performed_on` DATE NOT NULL,
    `performed_by_user_id` CHAR(36) NULL,
    `provider_id` CHAR(36) NULL,
    `result` ENUM('APROBADO', 'APROBADO_CON_OBSERVACIONES', 'RECHAZADO') NOT NULL,
    `certificate_no` VARCHAR(100) NULL,
    `certificate_date` DATE NULL,
    `next_due_date` DATE NULL,
    `cost` DECIMAL(12, 2) NULL,
    `currency` CHAR(3) NULL,
    `notes` TEXT NULL,
    `document_ref` VARCHAR(100) NULL,
    `corrects_id` CHAR(36) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `maintenance_services_extinguisher_id_performed_at_idx`(`extinguisher_id`, `performed_at`),
    INDEX `maintenance_services_service_type_next_due_date_idx`(`service_type`, `next_due_date`),
    INDEX `maintenance_services_maintenance_order_id_idx`(`maintenance_order_id`),
    INDEX `maintenance_services_provider_id_idx`(`provider_id`),
    INDEX `maintenance_services_next_due_date_idx`(`next_due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inspections` (
    `id` CHAR(36) NOT NULL,
    `extinguisher_id` CHAR(36) NOT NULL,
    `inspected_at` DATETIME(3) NOT NULL,
    `inspected_on` DATE NOT NULL,
    `inspector_user_id` CHAR(36) NULL,
    `inspector_name` VARCHAR(150) NOT NULL,
    `result` ENUM('APROBADO', 'APROBADO_CON_OBSERVACIONES', 'RECHAZADO') NOT NULL,
    `checklist_json` JSON NULL,
    `next_due_date` DATE NULL,
    `notes` TEXT NULL,
    `document_ref` VARCHAR(100) NULL,
    `corrects_id` CHAR(36) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `client_uuid` CHAR(36) NULL,
    `capture_mode` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
    `device_id` CHAR(36) NULL,
    `synced_at` DATETIME(3) NULL,

    UNIQUE INDEX `inspections_client_uuid_key`(`client_uuid`),
    INDEX `inspections_extinguisher_id_inspected_at_idx`(`extinguisher_id`, `inspected_at`),
    INDEX `inspections_next_due_date_idx`(`next_due_date`),
    INDEX `inspections_inspector_user_id_idx`(`inspector_user_id`),
    INDEX `inspections_result_idx`(`result`),
    INDEX `inspections_device_id_synced_at_idx`(`device_id`, `synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `due_dates` (
    `id` CHAR(36) NOT NULL,
    `extinguisher_id` CHAR(36) NOT NULL,
    `event_type` ENUM('EQUIPO', 'INSPECCION', 'MANTENIMIENTO', 'RECARGA', 'PRUEBA_HIDROSTATICA') NOT NULL,
    `due_date` DATE NOT NULL,
    `source_type` ENUM('EXTINGUISHER', 'INSPECTION', 'MAINTENANCE_SERVICE') NOT NULL,
    `source_id` CHAR(36) NOT NULL,
    `source_event_at` DATETIME(3) NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `due_dates_event_type_due_date_idx`(`event_type`, `due_date`),
    INDEX `due_dates_due_date_idx`(`due_date`),
    INDEX `due_dates_source_type_source_id_idx`(`source_type`, `source_id`),
    UNIQUE INDEX `due_dates_extinguisher_id_event_type_key`(`extinguisher_id`, `event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_settings` (
    `id` CHAR(36) NOT NULL,
    `event_type` ENUM('EQUIPO', 'INSPECCION', 'MANTENIMIENTO', 'RECARGA', 'PRUEBA_HIDROSTATICA') NOT NULL,
    `days_before` INTEGER NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` CHAR(36) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `alert_settings_event_type_key`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `actor_label` VARCHAR(255) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` CHAR(36) NULL,
    `before_data` JSON NULL,
    `after_data` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `request_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
    INDEX `audit_logs_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `code_counters` (
    `id` CHAR(36) NOT NULL,
    `scope` VARCHAR(30) NOT NULL,
    `prefix` VARCHAR(10) NOT NULL,
    `next_value` INTEGER UNSIGNED NOT NULL,
    `padding` TINYINT UNSIGNED NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `code_counters_scope_key`(`scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_replaced_by_id_fkey` FOREIGN KEY (`replaced_by_id`) REFERENCES `refresh_tokens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_records` ADD CONSTRAINT `idempotency_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_assigned_user_id_fkey` FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `extinguisher_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_current_location_id_fkey` FOREIGN KEY (`current_location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_current_external_party_id_fkey` FOREIGN KEY (`current_external_party_id`) REFERENCES `external_parties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_extinguisher_id_fkey` FOREIGN KEY (`extinguisher_id`) REFERENCES `extinguishers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_origin_location_id_fkey` FOREIGN KEY (`origin_location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_origin_external_party_id_fkey` FOREIGN KEY (`origin_external_party_id`) REFERENCES `external_parties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_destination_location_id_fkey` FOREIGN KEY (`destination_location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_destination_external_party_id_fkey` FOREIGN KEY (`destination_external_party_id`) REFERENCES `external_parties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_corrects_movement_id_fkey` FOREIGN KEY (`corrects_movement_id`) REFERENCES `movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_orders` ADD CONSTRAINT `maintenance_orders_extinguisher_id_fkey` FOREIGN KEY (`extinguisher_id`) REFERENCES `extinguishers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_orders` ADD CONSTRAINT `maintenance_orders_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `external_parties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_orders` ADD CONSTRAINT `maintenance_orders_workshop_location_id_fkey` FOREIGN KEY (`workshop_location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_orders` ADD CONSTRAINT `maintenance_orders_sent_movement_id_fkey` FOREIGN KEY (`sent_movement_id`) REFERENCES `movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_orders` ADD CONSTRAINT `maintenance_orders_return_movement_id_fkey` FOREIGN KEY (`return_movement_id`) REFERENCES `movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_orders` ADD CONSTRAINT `maintenance_orders_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_services` ADD CONSTRAINT `maintenance_services_extinguisher_id_fkey` FOREIGN KEY (`extinguisher_id`) REFERENCES `extinguishers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_services` ADD CONSTRAINT `maintenance_services_maintenance_order_id_fkey` FOREIGN KEY (`maintenance_order_id`) REFERENCES `maintenance_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_services` ADD CONSTRAINT `maintenance_services_performed_by_user_id_fkey` FOREIGN KEY (`performed_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_services` ADD CONSTRAINT `maintenance_services_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `external_parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_services` ADD CONSTRAINT `maintenance_services_corrects_id_fkey` FOREIGN KEY (`corrects_id`) REFERENCES `maintenance_services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_services` ADD CONSTRAINT `maintenance_services_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_extinguisher_id_fkey` FOREIGN KEY (`extinguisher_id`) REFERENCES `extinguishers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_inspector_user_id_fkey` FOREIGN KEY (`inspector_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_corrects_id_fkey` FOREIGN KEY (`corrects_id`) REFERENCES `inspections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `due_dates` ADD CONSTRAINT `due_dates_extinguisher_id_fkey` FOREIGN KEY (`extinguisher_id`) REFERENCES `extinguishers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_settings` ADD CONSTRAINT `alert_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restricciones manuales (Prisma no expresa CHECK ni columnas generadas).
-- Referencia: docs/modelo-entidad-relacion.md §5.1.
-- ---------------------------------------------------------------------------

-- C-02, C-03, C-04, C-05, C-06
ALTER TABLE `extinguishers`
    ADD CONSTRAINT `extinguishers_asset_code_chk`
        CHECK (REGEXP_LIKE(`asset_code`, '^[A-Z0-9][A-Z0-9_-]{2,19}$', 'c')),
    ADD CONSTRAINT `extinguishers_placement_chk`
        CHECK (
            (`placement_type` = 'INTERNAL' AND `current_location_id` IS NOT NULL AND `current_external_party_id` IS NULL)
            OR (`placement_type` = 'EXTERNAL' AND `current_external_party_id` IS NOT NULL AND `current_location_id` IS NULL)
            OR (`placement_type` = 'NONE' AND `current_location_id` IS NULL AND `current_external_party_id` IS NULL)
        ),
    ADD CONSTRAINT `extinguishers_retired_chk`
        CHECK (
            (`logistics_status` = 'DADO_DE_BAJA' AND `placement_type` = 'NONE' AND `retired_at` IS NOT NULL)
            OR (`logistics_status` <> 'DADO_DE_BAJA' AND `retired_at` IS NULL)
        ),
    ADD CONSTRAINT `extinguishers_row_version_chk`
        CHECK (`row_version` >= 1);

-- C-07 (origen y destino coherentes con su tipo) y `entry_source` solo en INGRESO
ALTER TABLE `movements`
    ADD CONSTRAINT `movements_origin_kind_chk`
        CHECK (
            (`origin_kind` = 'LOCATION' AND `origin_location_id` IS NOT NULL AND `origin_external_party_id` IS NULL)
            OR (`origin_kind` = 'EXTERNAL_PARTY' AND `origin_external_party_id` IS NOT NULL AND `origin_location_id` IS NULL)
            OR (`origin_kind` = 'NONE' AND `origin_location_id` IS NULL AND `origin_external_party_id` IS NULL)
        ),
    ADD CONSTRAINT `movements_destination_kind_chk`
        CHECK (
            (`destination_kind` = 'LOCATION' AND `destination_location_id` IS NOT NULL AND `destination_external_party_id` IS NULL)
            OR (`destination_kind` = 'EXTERNAL_PARTY' AND `destination_external_party_id` IS NOT NULL AND `destination_location_id` IS NULL)
            OR (`destination_kind` = 'NONE' AND `destination_location_id` IS NULL AND `destination_external_party_id` IS NULL)
        ),
    ADD CONSTRAINT `movements_entry_source_chk`
        CHECK (
            (`movement_type` = 'INGRESO' AND `entry_source` IS NOT NULL)
            OR (`movement_type` <> 'INGRESO' AND `entry_source` IS NULL)
        ),
    ADD CONSTRAINT `movements_reason_length_chk`
        CHECK (CHAR_LENGTH(`reason`) >= 5);

-- C-11, C-18, C-19
ALTER TABLE `maintenance_services`
    ADD CONSTRAINT `maintenance_services_next_due_chk`
        CHECK (`next_due_date` IS NULL OR `next_due_date` > `performed_on`),
    ADD CONSTRAINT `maintenance_services_cost_chk`
        CHECK (`cost` IS NULL OR `cost` >= 0),
    ADD CONSTRAINT `maintenance_services_currency_chk`
        CHECK (
            (`cost` IS NULL AND `currency` IS NULL)
            OR (`cost` IS NOT NULL AND `currency` IS NOT NULL)
        );

-- C-11 (inspecciones)
ALTER TABLE `inspections`
    ADD CONSTRAINT `inspections_next_due_chk`
        CHECK (`next_due_date` IS NULL OR `next_due_date` > `inspected_on`);

-- C-12
ALTER TABLE `alert_settings`
    ADD CONSTRAINT `alert_settings_days_before_chk`
        CHECK (`days_before` IS NULL OR `days_before` >= 0);

-- C-15 (orden interna o externa, nunca ambas)
ALTER TABLE `maintenance_orders`
    ADD CONSTRAINT `maintenance_orders_party_chk`
        CHECK ((`provider_id` IS NULL) <> (`workshop_location_id` IS NULL));

-- C-10: una sola orden activa por activo (columna generada + índice único)
ALTER TABLE `maintenance_orders`
    ADD COLUMN `active_key` CHAR(36)
        GENERATED ALWAYS AS (
            CASE
                WHEN `status` IN ('ABIERTA', 'EN_PROVEEDOR') THEN `extinguisher_id`
                ELSE NULL
            END
        ) STORED,
    ADD UNIQUE INDEX `maintenance_orders_active_key_key` (`active_key`);
