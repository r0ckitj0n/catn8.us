-- Rel8ed additive schema (idempotent CREATE TABLE IF NOT EXISTS).
-- Applied at runtime via Rel8edModel::ensureSchema().

CREATE TABLE IF NOT EXISTS rel8ed_trees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  root_person_id INT NULL,
  owner_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rel8ed_trees_slug (slug),
  KEY idx_rel8ed_trees_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_people (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  gedcom_xref VARCHAR(64) NULL,
  name_display VARCHAR(255) NOT NULL DEFAULT '',
  name_given VARCHAR(191) NULL,
  name_surname VARCHAR(191) NULL,
  name_prefix VARCHAR(64) NULL,
  name_suffix VARCHAR(64) NULL,
  sex CHAR(1) NULL,
  birth_date_raw VARCHAR(128) NULL,
  birth_date_sort DATE NULL,
  birth_place VARCHAR(255) NULL,
  death_date_raw VARCHAR(128) NULL,
  death_date_sort DATE NULL,
  death_place VARCHAR(255) NULL,
  is_living TINYINT(1) NOT NULL DEFAULT 0,
  is_private TINYINT(1) NOT NULL DEFAULT 0,
  has_sources TINYINT(1) NOT NULL DEFAULT 0,
  raw_json LONGTEXT NULL,
  notes_text MEDIUMTEXT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_rel8ed_people_tree (tree_id),
  KEY idx_rel8ed_people_xref (tree_id, gedcom_xref),
  KEY idx_rel8ed_people_surname (tree_id, name_surname),
  KEY idx_rel8ed_people_birth (tree_id, birth_date_sort),
  KEY idx_rel8ed_people_living (tree_id, is_living, is_private),
  UNIQUE KEY uniq_rel8ed_people_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_names (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  name_type VARCHAR(32) NOT NULL DEFAULT 'primary',
  name_display VARCHAR(255) NOT NULL DEFAULT '',
  name_given VARCHAR(191) NULL,
  name_surname VARCHAR(191) NULL,
  name_prefix VARCHAR(64) NULL,
  name_suffix VARCHAR(64) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_rel8ed_names_person (person_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_families (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  gedcom_xref VARCHAR(64) NULL,
  husband_person_id INT NULL,
  wife_person_id INT NULL,
  marriage_date_raw VARCHAR(128) NULL,
  marriage_date_sort DATE NULL,
  marriage_place VARCHAR(255) NULL,
  raw_json LONGTEXT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_rel8ed_families_tree (tree_id),
  KEY idx_rel8ed_families_xref (tree_id, gedcom_xref),
  KEY idx_rel8ed_families_husb (husband_person_id),
  KEY idx_rel8ed_families_wife (wife_person_id),
  UNIQUE KEY uniq_rel8ed_families_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_family_children (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family_id INT NOT NULL,
  person_id INT NOT NULL,
  pedigree VARCHAR(32) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_rel8ed_fam_child (family_id, person_id),
  KEY idx_rel8ed_fam_children_person (person_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  person_id INT NULL,
  family_id INT NULL,
  tag VARCHAR(32) NOT NULL,
  type_label VARCHAR(128) NULL,
  date_raw VARCHAR(128) NULL,
  date_sort DATE NULL,
  place VARCHAR(255) NULL,
  description TEXT NULL,
  age_text VARCHAR(64) NULL,
  cause TEXT NULL,
  raw_json LONGTEXT NULL,
  has_sources TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rel8ed_events_person (person_id, date_sort),
  KEY idx_rel8ed_events_family (family_id),
  KEY idx_rel8ed_events_tree_tag (tree_id, tag),
  KEY idx_rel8ed_events_place (tree_id, place(64))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_attributes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  person_id INT NOT NULL,
  tag VARCHAR(32) NOT NULL,
  value_text TEXT NULL,
  date_raw VARCHAR(128) NULL,
  place VARCHAR(255) NULL,
  raw_json LONGTEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_rel8ed_attrs_person (person_id),
  KEY idx_rel8ed_attrs_tag (tree_id, tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  gedcom_xref VARCHAR(64) NULL,
  title VARCHAR(512) NULL,
  author VARCHAR(255) NULL,
  publication TEXT NULL,
  repository VARCHAR(255) NULL,
  text_body MEDIUMTEXT NULL,
  raw_json LONGTEXT NULL,
  external_source_id VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_rel8ed_sources_tree (tree_id),
  KEY idx_rel8ed_sources_xref (tree_id, gedcom_xref),
  UNIQUE KEY uniq_rel8ed_sources_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_citations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  source_id INT NULL,
  person_id INT NULL,
  family_id INT NULL,
  event_id INT NULL,
  page VARCHAR(255) NULL,
  quality VARCHAR(32) NULL,
  note TEXT NULL,
  raw_json LONGTEXT NULL,
  KEY idx_rel8ed_citations_person (person_id),
  KEY idx_rel8ed_citations_source (source_id),
  KEY idx_rel8ed_citations_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  gedcom_xref VARCHAR(64) NULL,
  person_id INT NULL,
  family_id INT NULL,
  title VARCHAR(255) NULL,
  body MEDIUMTEXT NOT NULL,
  is_story TINYINT(1) NOT NULL DEFAULT 0,
  raw_json LONGTEXT NULL,
  external_source_id VARCHAR(191) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_rel8ed_notes_person (person_id),
  KEY idx_rel8ed_notes_tree (tree_id),
  UNIQUE KEY uniq_rel8ed_notes_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  gedcom_xref VARCHAR(64) NULL,
  person_id INT NULL,
  title VARCHAR(255) NULL,
  file_name VARCHAR(255) NULL,
  stored_path VARCHAR(512) NULL,
  mime VARCHAR(128) NULL,
  size_bytes INT NULL,
  sha256 CHAR(64) NULL,
  media_type VARCHAR(32) NOT NULL DEFAULT 'document',
  note TEXT NULL,
  raw_json LONGTEXT NULL,
  external_source_id VARCHAR(191) NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_rel8ed_media_tree (tree_id),
  KEY idx_rel8ed_media_person (person_id),
  KEY idx_rel8ed_media_sha (sha256),
  UNIQUE KEY uniq_rel8ed_media_ext (external_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_places (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  place_name VARCHAR(255) NOT NULL,
  normalized VARCHAR(255) NOT NULL,
  event_count INT NOT NULL DEFAULT 0,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  geocode_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  geocode_raw TEXT NULL,
  geocoded_at DATETIME NULL,
  UNIQUE KEY uniq_rel8ed_place (tree_id, normalized),
  KEY idx_rel8ed_places_status (geocode_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_imports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  file_name VARCHAR(255) NULL,
  sha256 CHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  counts_json TEXT NULL,
  diff_json LONGTEXT NULL,
  applied_at DATETIME NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rel8ed_imports_tree (tree_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_dna_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  person_id INT NULL,
  label VARCHAR(191) NOT NULL DEFAULT 'Primary',
  notes TEXT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rel8ed_dna_tree (tree_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_dna_regions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profile_id INT NOT NULL,
  parent_region_id INT NULL,
  region_name VARCHAR(191) NOT NULL,
  percent DECIMAL(6,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_rel8ed_dna_regions_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_dna_communities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profile_id INT NOT NULL,
  community_name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_rel8ed_dna_comm_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_quality_flags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tree_id INT NOT NULL,
  person_id INT NULL,
  family_id INT NULL,
  flag_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'warn',
  message VARCHAR(512) NOT NULL,
  details_json TEXT NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rel8ed_quality_tree (tree_id, flag_type),
  KEY idx_rel8ed_quality_person (person_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rel8ed_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  actor_label VARCHAR(96) NULL,
  action VARCHAR(96) NOT NULL,
  table_name VARCHAR(96) NULL,
  record_id INT NULL,
  person_id INT NULL,
  before_json LONGTEXT NULL,
  after_json LONGTEXT NULL,
  ip VARCHAR(64) NULL,
  ua VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rel8ed_audit_created (created_at),
  KEY idx_rel8ed_audit_person (person_id),
  KEY idx_rel8ed_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
