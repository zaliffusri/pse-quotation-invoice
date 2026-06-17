#!/usr/bin/env node
/**
 * Import data tempatan (folder data/) ke Supabase
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { getSupabase } = require('../lib/supabase');

const dataDir = path.join(__dirname, '..', 'data');

function readJson(name, fallback) {
  const file = path.join(dataDir, `${name}.json`);
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

async function main() {
  console.log('\nImport data tempatan ke Supabase...\n');
  const sb = getSupabase();

  const settings = readJson('settings', {});
  if (settings.company) {
    await sb.from('app_settings').upsert({ key: 'company', value: settings.company });
    console.log('OK: company settings');
  }
  if (settings.numberFormat) {
    await sb.from('app_settings').upsert({ key: 'numberFormat', value: settings.numberFormat });
    console.log('OK: numberFormat');
  }

  const clients = readJson('clients', []);
  if (clients.length) {
    const { error } = await sb.from('clients').upsert(clients);
    if (error) throw error;
    console.log(`OK: ${clients.length} pelanggan`);
  }

  const documents = readJson('documents', {});
  const docRows = Object.values(documents);
  if (docRows.length) {
    const { error } = await sb.from('documents').upsert(docRows);
    if (error) throw error;
    console.log(`OK: ${docRows.length} dokumen`);
  }

  const versions = readJson('versions', []);
  if (versions.length) {
    const verRows = versions.map(v => ({
      doc_number: v.doc_number,
      version: v.version,
      snapshot: typeof v.snapshot === 'string' ? JSON.parse(v.snapshot) : v.snapshot,
      total: v.total,
      doc_date: v.doc_date,
      saved_at: v.saved_at || new Date().toISOString()
    }));
    const { error } = await sb.from('document_versions').upsert(verRows);
    if (error) throw error;
    console.log(`OK: ${verRows.length} versi dokumen`);
  }

  const counters = readJson('counters', {});
  const counterRows = Object.entries(counters).map(([id, value]) => ({ id, value }));
  if (counterRows.length) {
    const { error } = await sb.from('counters').upsert(counterRows);
    if (error) throw error;
    console.log(`OK: ${counterRows.length} counter`);
  }

  const empty = !clients.length && !docRows.length && !counterRows.length;
  if (empty) console.log('Tiada data tempatan — schema seed data sudah cukup.');
  console.log('\nImport selesai!\n');
}

main().catch(err => {
  console.error('Ralat import:', err.message);
  process.exit(1);
});
