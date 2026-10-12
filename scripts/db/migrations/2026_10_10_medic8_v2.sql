-- Medic8 additive follow-up (idempotent ALTERs applied in Medic8Model::ensureSchema).
-- Do not DROP or rewrite existing tables.
-- Also added at runtime: medic8_people.external_source_id + source_ref_id,
-- deleted_at on entity tables, unique external_source_id indexes after cleanup.

CREATE TABLE IF NOT EXISTS medic8_record_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  entity VARCHAR(64) NOT NULL,
  record_id INT NOT NULL,
  role VARCHAR(96) NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_medic8_record_doc (document_id, entity, record_id),
  KEY idx_medic8_rd_record (entity, record_id),
  KEY idx_medic8_rd_document (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
