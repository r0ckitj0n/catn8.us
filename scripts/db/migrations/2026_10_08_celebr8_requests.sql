-- Additive Celebr8r requests, reply threads, guest groups, and outbox request_id.
-- Safe to re-run; application also ensureSchema()'s these tables.

CREATE TABLE IF NOT EXISTS celebr8_guest_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(191) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_celebr8_guest_groups_event_name (event_id, name),
  KEY idx_celebr8_guest_groups_event (event_id),
  CONSTRAINT fk_celebr8_guest_groups_event FOREIGN KEY (event_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS celebr8_guest_group_members (
  group_id INT NOT NULL,
  guest_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, guest_id),
  KEY idx_celebr8_ggm_guest (guest_id),
  CONSTRAINT fk_celebr8_ggm_group FOREIGN KEY (group_id) REFERENCES celebr8_guest_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_celebr8_ggm_guest FOREIGN KEY (guest_id) REFERENCES celebr8_guests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS celebr8_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  party_id INT NULL,
  request_text TEXT NOT NULL,
  show_before_sending TINYINT(1) NOT NULL DEFAULT 1,
  audience_type VARCHAR(32) NOT NULL DEFAULT 'none',
  audience_guest_ids TEXT NULL,
  audience_rsvp_status VARCHAR(32) NOT NULL DEFAULT '',
  audience_group_id INT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_by_user_id INT NULL,
  notify_count INT NOT NULL DEFAULT 0,
  notified_at DATETIME NULL,
  claimed_at DATETIME NULL,
  claimed_by VARCHAR(191) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_celebr8_requests_status (status, id),
  KEY idx_celebr8_requests_party (party_id),
  KEY idx_celebr8_requests_notified (status, notified_at),
  CONSTRAINT fk_celebr8_requests_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE SET NULL,
  CONSTRAINT fk_celebr8_requests_group FOREIGN KEY (audience_group_id) REFERENCES celebr8_guest_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS celebr8_request_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  author_role VARCHAR(32) NOT NULL,
  body TEXT NOT NULL,
  created_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_celebr8_req_msg_request (request_id, id),
  CONSTRAINT fk_celebr8_req_msg_request FOREIGN KEY (request_id) REFERENCES celebr8_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- celebr8_text_messages.request_id is added by Celebr8AgentModel::ensureSchema()
-- (information_schema-safe). Do not blind-ALTER here so this file stays re-runnable.
