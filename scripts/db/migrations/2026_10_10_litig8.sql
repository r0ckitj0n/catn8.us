-- Litig8 additive schema (idempotent CREATE TABLE IF NOT EXISTS).
-- Applied at runtime via Litig8Model::ensureSchema(); this file is the documented mirror.

CREATE TABLE IF NOT EXISTS litig8_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  label VARCHAR(191) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_litig8_categories_slug (slug),
  UNIQUE KEY uniq_litig8_categories_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_type VARCHAR(32) NOT NULL,
  account VARCHAR(191) NULL,
  thread_id VARCHAR(191) NULL,
  message_id VARCHAR(191) NULL,
  message_date DATETIME NULL,
  file_path VARCHAR(512) NULL,
  record_type VARCHAR(96) NULL,
  record_id VARCHAR(191) NULL,
  note TEXT NULL,
  fingerprint CHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_litig8_source_fingerprint (fingerprint),
  KEY idx_litig8_sources_message_date (message_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_matters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT NOT NULL,
  title VARCHAR(191) NOT NULL,
  category_slug VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  case_number_enc TEXT NULL,
  claim_number_enc TEXT NULL,
  parties_summary TEXT NULL,
  attorneys_summary TEXT NULL,
  summary TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_litig8_matters_owner (owner_user_id),
  KEY idx_litig8_matters_category (category_slug),
  KEY idx_litig8_matters_status (status),
  UNIQUE KEY uniq_litig8_matters_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matter_id INT NOT NULL,
  event_date DATETIME NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  location VARCHAR(255) NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_litig8_events_matter (matter_id, event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_deadlines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matter_id INT NULL,
  due_at DATETIME NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  completed_at DATETIME NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_litig8_deadlines_matter (matter_id, due_at),
  KEY idx_litig8_deadlines_due (due_at),
  KEY idx_litig8_deadlines_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT NOT NULL,
  name VARCHAR(191) NOT NULL,
  contact_type VARCHAR(32) NOT NULL DEFAULT 'other',
  organization VARCHAR(191) NULL,
  role_title VARCHAR(191) NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(191) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  ssn_enc TEXT NULL,
  account_number_enc TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_litig8_contacts_owner (owner_user_id),
  KEY idx_litig8_contacts_type (contact_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_matter_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matter_id INT NOT NULL,
  contact_id INT NOT NULL,
  role VARCHAR(96) NULL,
  notes TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_litig8_matter_contacts_matter (matter_id),
  KEY idx_litig8_matter_contacts_contact (contact_id),
  UNIQUE KEY uniq_litig8_matter_contacts (matter_id, contact_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT NOT NULL,
  title VARCHAR(191) NOT NULL,
  doc_type VARCHAR(96) NULL,
  file_path VARCHAR(512) NOT NULL,
  mime VARCHAR(120) NULL,
  sha256 CHAR(64) NULL,
  size_bytes INT UNSIGNED NULL,
  uploaded_by INT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_litig8_documents_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS litig8_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  actor_label VARCHAR(96) NULL,
  action VARCHAR(64) NOT NULL,
  table_name VARCHAR(96) NULL,
  record_id INT NULL,
  matter_id INT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  ip VARCHAR(64) NULL,
  ua VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_litig8_audit_matter (matter_id, created_at),
  KEY idx_litig8_audit_actor (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
