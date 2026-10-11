-- Litig8 additive follow-up (idempotent ALTERs applied in Litig8Model::ensureSchema).
-- Do not DROP or rewrite existing tables.
-- Also added at runtime: deleted_at on entity tables (matters, events, deadlines,
-- contacts, matter_contacts, documents), unique external_source_id indexes, and
-- the default litig8_categories seed rows.

CREATE TABLE IF NOT EXISTS litig8_record_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  entity VARCHAR(64) NOT NULL,
  record_id INT NOT NULL,
  role VARCHAR(96) NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_litig8_record_doc (document_id, entity, record_id),
  KEY idx_litig8_rd_record (entity, record_id),
  KEY idx_litig8_rd_document (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
