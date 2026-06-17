-- PSE System v3 — Supabase Schema (Vercel Deploy)
-- Paste dalam Supabase Dashboard → SQL Editor → Run

-- Settings (company profile, number format)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Administrator',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Pelanggan
CREATE TABLE IF NOT EXISTS clients (
  id             TEXT PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  client_name    TEXT,
  client_attn    TEXT,
  client_address TEXT,
  client_phone   TEXT,
  client_email   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Folder dokumen
CREATE TABLE IF NOT EXISTS documents (
  doc_number     TEXT PRIMARY KEY,
  doc_type       TEXT NOT NULL CHECK (doc_type IN ('quotation', 'invoice')),
  client_name    TEXT,
  client_code    TEXT,
  ref_quotation  TEXT,
  latest_version INT NOT NULL DEFAULT 0,
  status         TEXT DEFAULT 'active',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Versi dokumen
CREATE TABLE IF NOT EXISTS document_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number TEXT NOT NULL REFERENCES documents(doc_number) ON DELETE CASCADE,
  version    INT NOT NULL,
  snapshot   JSONB NOT NULL,
  total      NUMERIC(12,2) DEFAULT 0,
  doc_date   DATE,
  saved_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doc_number, version)
);

-- Counter nombor (server-side)
CREATE TABLE IF NOT EXISTS counters (
  id         TEXT PRIMARY KEY,
  value      INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log aktiviti
CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action     TEXT NOT NULL,
  doc_number TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic counter increment (elak duplicate nombor)
CREATE OR REPLACE FUNCTION increment_counter(counter_id TEXT)
RETURNS INT AS $$
DECLARE new_val INT;
BEGIN
  INSERT INTO counters (id, value, updated_at)
  VALUES (counter_id, 1, NOW())
  ON CONFLICT (id) DO UPDATE
    SET value = counters.value + 1, updated_at = NOW()
  RETURNING value INTO new_val;
  RETURN new_val;
END;
$$ LANGUAGE plpgsql;

-- Index
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_doc ON document_versions(doc_number, version DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);

-- Seed data
INSERT INTO app_settings (key, value) VALUES
  ('company', '{
    "name": "PILLAR STRIDE ENTERPRISE",
    "regNo": "(TR0299805-M)",
    "prefix": "PSE",
    "address": ["No. 27 Jalan Pinang Merah 4,", "Taman Sayong Pinang, Bandar Tenggara", "Kulai, Johor 81440"],
    "email": "zaliff2258@gmail.com",
    "phone": "+60133663007",
    "bank": {"payee": "PILLAR STRIDE ENTERPRISE", "bankName": "Maybank", "accountNo": "5515 8407 8633"}
  }'::jsonb),
  ('numberFormat', '"standard"'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_users (username, password_hash, name) VALUES
  ('admin', 'pse2026', 'Administrator PSE')
ON CONFLICT (username) DO NOTHING;

INSERT INTO clients (id, code, name, client_name, client_attn, client_address, client_phone, client_email) VALUES
  ('kosiswa', 'KOSISWA', 'KOSISWA UTHM',
   'KOSISWA UTHM — Universiti Tun Hussein Onn Malaysia (UTHM)',
   'Pn. Mimi', E'86400 Parit Raja\nBatu Pahat, Johor\nMalaysia',
   '60179863173', 'miminuraleeya94@gmail.com')
ON CONFLICT (id) DO NOTHING;
