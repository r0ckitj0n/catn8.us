-- Medic8 additive schema (idempotent CREATE TABLE IF NOT EXISTS).
-- Applied at runtime via Medic8Model::ensureSchema(); this file is the documented mirror.

CREATE TABLE IF NOT EXISTS medic8_people (
  id INT AUTO_INCREMENT PRIMARY KEY,
  catn8_user_id INT NULL,
  owner_user_id INT NOT NULL,
  display_name VARCHAR(191) NOT NULL,
  relation_to_admin VARCHAR(96) NULL,
  dob DATE NULL,
  sensitivity_default VARCHAR(16) NOT NULL DEFAULT 'normal',
  is_opted_in TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medic8_people_owner (owner_user_id),
  KEY idx_medic8_people_user (catn8_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_sources (
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
  UNIQUE KEY uniq_medic8_source_fingerprint (fingerprint),
  KEY idx_medic8_sources_message_date (message_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_providers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NULL,
  name VARCHAR(191) NOT NULL,
  specialty VARCHAR(191) NULL,
  practice VARCHAR(191) NULL,
  phone VARCHAR(64) NULL,
  fax VARCHAR(64) NULL,
  email VARCHAR(191) NULL,
  address TEXT NULL,
  portal_name VARCHAR(191) NULL,
  portal_url VARCHAR(512) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medic8_providers_person (person_id),
  UNIQUE KEY uniq_medic8_providers_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_medications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  name VARCHAR(191) NOT NULL,
  generic_name VARCHAR(191) NULL,
  strength VARCHAR(96) NULL,
  dose_per_admin VARCHAR(96) NULL,
  frequency VARCHAR(191) NULL,
  schedule_json JSON NULL,
  route VARCHAR(64) NULL,
  prn TINYINT(1) NOT NULL DEFAULT 0,
  indication VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'current',
  sensitivity VARCHAR(16) NOT NULL DEFAULT 'normal',
  prescriber_provider_id INT NULL,
  pharmacy_provider_id INT NULL,
  rx_number_enc TEXT NULL,
  start_date DATE NULL,
  stop_date DATE NULL,
  last_fill_date DATE NULL,
  days_supply INT NULL,
  qty DECIMAL(12,2) NULL,
  refills_left INT NULL,
  next_refill_due DATE NULL,
  auto_refill TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  source_ref_id INT NULL,
  confidence DECIMAL(5,4) NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medic8_meds_person_status (person_id, status),
  KEY idx_medic8_meds_next_refill (next_refill_due),
  UNIQUE KEY uniq_medic8_meds_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_med_fills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medication_id INT NOT NULL,
  fill_date DATE NOT NULL,
  qty DECIMAL(12,2) NULL,
  days_supply INT NULL,
  pharmacy_id INT NULL,
  cost DECIMAL(10,2) NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_fills_med (medication_id),
  UNIQUE KEY uniq_medic8_fills_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  provider_id INT NULL,
  location VARCHAR(255) NULL,
  purpose VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  telehealth_url VARCHAR(512) NULL,
  notes TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medic8_appts_person_starts (person_id, starts_at),
  UNIQUE KEY uniq_medic8_appts_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_conditions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  name VARCHAR(191) NOT NULL,
  status VARCHAR(64) NULL,
  onset_date DATE NULL,
  sensitivity VARCHAR(16) NOT NULL DEFAULT 'normal',
  notes TEXT NULL,
  source_ref_id INT NULL,
  confidence DECIMAL(5,4) NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medic8_conditions_person (person_id),
  UNIQUE KEY uniq_medic8_conditions_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_allergies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  allergen VARCHAR(191) NOT NULL,
  reaction VARCHAR(255) NULL,
  status VARCHAR(64) NULL,
  recorded_at DATETIME NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medic8_allergies_person (person_id),
  UNIQUE KEY uniq_medic8_allergies_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_labs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'lab',
  test VARCHAR(191) NOT NULL,
  taken_at DATETIME NULL,
  value VARCHAR(96) NULL,
  unit VARCHAR(64) NULL,
  ref_range VARCHAR(96) NULL,
  flag VARCHAR(32) NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_labs_person_taken (person_id, taken_at),
  KEY idx_medic8_labs_test (person_id, test),
  UNIQUE KEY uniq_medic8_labs_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_procedures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  name VARCHAR(191) NOT NULL,
  performed_at DATETIME NULL,
  impression TEXT NULL,
  document_id INT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_procedures_person (person_id),
  UNIQUE KEY uniq_medic8_procedures_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_encounters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  occurred_at DATETIME NULL,
  provider_id INT NULL,
  encounter_type VARCHAR(96) NULL,
  summary TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_encounters_person (person_id, occurred_at),
  UNIQUE KEY uniq_medic8_encounters_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_disability_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  event_date DATE NULL,
  program VARCHAR(32) NULL,
  event_type VARCHAR(96) NULL,
  description TEXT NULL,
  case_number_enc TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_disability_person (person_id, event_date),
  UNIQUE KEY uniq_medic8_disability_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_insurance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  plan_name VARCHAR(191) NOT NULL,
  carrier VARCHAR(191) NULL,
  plan_type VARCHAR(96) NULL,
  member_id_enc TEXT NULL,
  group_no_enc TEXT NULL,
  medicare_number_enc TEXT NULL,
  ssn_enc TEXT NULL,
  effective_from DATE NULL,
  effective_to DATE NULL,
  phone VARCHAR(64) NULL,
  notes TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_medic8_insurance_person (person_id),
  UNIQUE KEY uniq_medic8_insurance_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
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
  KEY idx_medic8_documents_person (person_id),
  UNIQUE KEY uniq_medic8_documents_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_portal_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  sent_at DATETIME NULL,
  direction VARCHAR(16) NULL,
  provider_id INT NULL,
  subject VARCHAR(255) NULL,
  summary TEXT NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_portal_person (person_id, sent_at),
  UNIQUE KEY uniq_medic8_portal_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  invoice_date DATE NULL,
  provider_id INT NULL,
  items_json JSON NULL,
  amount DECIMAL(10,2) NULL,
  status VARCHAR(64) NULL,
  source_ref_id INT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_invoices_person (person_id),
  UNIQUE KEY uniq_medic8_invoices_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_person_id INT NOT NULL,
  grantee_user_id INT NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'all',
  role VARCHAR(16) NOT NULL DEFAULT 'viewer',
  include_high_sensitivity TINYINT(1) NOT NULL DEFAULT 0,
  granted_by INT NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_shares_grantee (grantee_user_id),
  KEY idx_medic8_shares_owner (owner_person_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inviter_user_id INT NOT NULL,
  email VARCHAR(191) NOT NULL,
  person_id INT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_medic8_invite_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  actor_label VARCHAR(96) NULL,
  action VARCHAR(64) NOT NULL,
  table_name VARCHAR(96) NULL,
  record_id INT NULL,
  person_id INT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  ip VARCHAR(64) NULL,
  ua VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medic8_audit_person (person_id, created_at),
  KEY idx_medic8_audit_actor (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medic8_ingest_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_ref_id INT NULL,
  proposed_table VARCHAR(96) NOT NULL,
  proposed_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  KEY idx_medic8_ingest_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
