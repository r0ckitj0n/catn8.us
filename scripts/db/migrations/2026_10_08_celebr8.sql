-- Additive Celebr8 schema (safe to re-run; application also ensureSchema()'s these tables).

CREATE TABLE IF NOT EXISTS celebr8_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(96) NOT NULL,
  title VARCHAR(191) NOT NULL,
  theme VARCHAR(255) NOT NULL DEFAULT '',
  event_date VARCHAR(64) NOT NULL DEFAULT '[PLACEHOLDER: date]',
  event_time VARCHAR(64) NOT NULL DEFAULT '[PLACEHOLDER: time]',
  location VARCHAR(512) NOT NULL DEFAULT '[PLACEHOLDER: location]',
  food TEXT NULL,
  schedule TEXT NULL,
  rsvp_deadline VARCHAR(64) NOT NULL DEFAULT '[PLACEHOLDER: RSVP deadline]',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_celebr8_events_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS celebr8_guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(191) NOT NULL,
  phone VARCHAR(64) NOT NULL DEFAULT '',
  email VARCHAR(191) NOT NULL DEFAULT '',
  rsvp_status VARCHAR(32) NOT NULL DEFAULT 'no_reply',
  party_size INT NOT NULL DEFAULT 1,
  kids_count INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  rsvp_updated_at DATETIME NULL,
  rsvp_updated_by VARCHAR(191) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_celebr8_guests_event (event_id),
  KEY idx_celebr8_guests_phone (phone),
  KEY idx_celebr8_guests_rsvp (event_id, rsvp_status),
  CONSTRAINT fk_celebr8_guests_event FOREIGN KEY (event_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS celebr8_text_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  guest_id INT NULL,
  to_address VARCHAR(191) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  claimed_at DATETIME NULL,
  claimed_by VARCHAR(191) NOT NULL DEFAULT '',
  sent_at DATETIME NULL,
  failed_at DATETIME NULL,
  error_text TEXT NULL,
  created_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_celebr8_text_status (status, id),
  KEY idx_celebr8_text_event (event_id),
  KEY idx_celebr8_text_guest (guest_id),
  CONSTRAINT fk_celebr8_text_event FOREIGN KEY (event_id) REFERENCES celebr8_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_celebr8_text_guest FOREIGN KEY (guest_id) REFERENCES celebr8_guests(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO celebr8_events (
  slug, title, theme, event_date, event_time, location, food, schedule, rsvp_deadline, notes
)
SELECT
  'halloween-party-2026',
  'Halloween Party 2026',
  '[PLACEHOLDER: theme — e.g. costume contest, haunted hayride]',
  '[PLACEHOLDER: date — TBD from party agent]',
  '[PLACEHOLDER: time — TBD from party agent]',
  '[PLACEHOLDER: location — TBD from party agent]',
  '[PLACEHOLDER: food — menu / potluck notes from party agent]',
  '[PLACEHOLDER: schedule — arrival, activities, wrap-up from party agent]',
  '[PLACEHOLDER: RSVP deadline — TBD from party agent]',
  '[PLACEHOLDER: notes — anything else Jon''s party agent will fill in]'
WHERE NOT EXISTS (
  SELECT 1 FROM celebr8_events WHERE slug = 'halloween-party-2026'
);
