-- PSE Document System — Supabase Schema (Fasa 3)
-- Import dalam Supabase SQL Editor: https://supabase.com/dashboard

-- Profil syarikat
CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY DEFAULT 'pse-main',
  name        TEXT NOT NULL,
  reg_no      TEXT,
  address     JSONB,
  bank        JSONB,
  settings    JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Pelanggan
CREATE TABLE IF NOT EXISTS clients (
  id          TEXT PRIMARY KEY,
  company_id  TEXT REFERENCES companies(id) DEFAULT 'pse-main',
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  attn        TEXT,
  address     TEXT,
  phone       TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Folder dokumen (satu row = satu no. rujukan)
CREATE TABLE IF NOT EXISTS documents (
  doc_number    TEXT PRIMARY KEY,
  company_id    TEXT REFERENCES companies(id) DEFAULT 'pse-main',
  doc_type      TEXT NOT NULL CHECK (doc_type IN ('quotation', 'invoice')),
  client_id     TEXT REFERENCES clients(id),
  client_name   TEXT,
  ref_quotation TEXT,
  latest_version INT DEFAULT 0,
  status        TEXT DEFAULT 'active' CHECK (status IN ('draft','active','paid','cancelled')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Versi dokumen (v1, v2, v3...)
CREATE TABLE IF NOT EXISTS document_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number  TEXT NOT NULL REFERENCES documents(doc_number) ON DELETE CASCADE,
  version     INT NOT NULL,
  snapshot    JSONB NOT NULL,
  total       NUMERIC(12,2) DEFAULT 0,
  doc_date    DATE,
  due_date    DATE,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  saved_by    TEXT,
  UNIQUE(doc_number, version)
);

-- Counter nombor (SERVER-SIDE — elak duplicate!)
CREATE TABLE IF NOT EXISTS counters (
  id          TEXT PRIMARY KEY,
  company_id  TEXT REFERENCES companies(id) DEFAULT 'pse-main',
  value       INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Status bayaran invois
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number  TEXT NOT NULL REFERENCES documents(doc_number),
  amount      NUMERIC(12,2) NOT NULL,
  paid_at     DATE,
  method      TEXT,
  reference   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Log sync / audit
CREATE TABLE IF NOT EXISTS sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,
  doc_number  TEXT,
  version     INT,
  provider    TEXT DEFAULT 'supabase',
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_doc ON document_versions(doc_number, version DESC);
CREATE INDEX IF NOT EXISTS idx_payments_doc ON payments(doc_number);

-- Row Level Security (aktifkan selepas setup auth)
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "PSE users only" ON documents FOR ALL USING (auth.role() = 'authenticated');

-- Seed company
INSERT INTO companies (id, name, reg_no) VALUES
  ('pse-main', 'Pillar Stride Enterprise', 'TR0299805-M')
ON CONFLICT (id) DO NOTHING;
