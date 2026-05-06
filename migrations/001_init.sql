CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'operador',
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS demands (
  id BIGSERIAL PRIMARY KEY,
  protocol TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  requester TEXT NOT NULL,
  contact TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  assignee TEXT,
  origin TEXT,
  destination TEXT,
  description TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  proof TEXT,
  completion_note TEXT,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demand_notes (
  id BIGSERIAL PRIMARY KEY,
  demand_id BIGINT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL,
  text TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demand_attachments (
  id BIGSERIAL PRIMARY KEY,
  demand_id BIGINT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demand_history (
  id BIGSERIAL PRIMARY KEY,
  demand_id BIGINT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demands_status ON demands(status);
CREATE INDEX IF NOT EXISTS idx_demands_category ON demands(category);
CREATE INDEX IF NOT EXISTS idx_demands_priority ON demands(priority);
CREATE INDEX IF NOT EXISTS idx_demands_assignee ON demands(assignee);
CREATE INDEX IF NOT EXISTS idx_demands_due_at ON demands(due_at);
CREATE INDEX IF NOT EXISTS idx_demands_search ON demands USING gin (
  to_tsvector('portuguese', coalesce(protocol,'') || ' ' || coalesce(title,'') || ' ' || coalesce(requester,'') || ' ' || coalesce(description,''))
);
