#!/usr/bin/env node
/**
 * Uji sambungan Supabase — jalankan selepas setup SQL schema
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { getSupabase } = require('../lib/supabase');

async function main() {
  console.log('\nMenguji sambungan Supabase...\n');

  const sb = getSupabase();

  const tables = ['app_settings', 'admin_users', 'clients', 'documents', 'counters'];
  for (const name of tables) {
    const { error } = await sb.from(name).select('*').limit(1);
    if (error) {
      console.error(`GAGAL: ${name} — ${error.message}`);
      console.error('\nPastikan anda dah run supabase/schema-vercel.sql dalam SQL Editor\n');
      process.exit(1);
    }
    console.log(`OK: ${name}`);
  }

  const { error: rpcErr } = await sb.rpc('increment_counter', { counter_id: '__test__' });
  if (rpcErr) {
    console.error(`GAGAL: increment_counter — ${rpcErr.message}`);
    process.exit(1);
  }
  await sb.from('counters').delete().eq('id', '__test__');
  console.log('OK: increment_counter');

  const { data: users } = await sb.from('admin_users').select('username');
  const { data: clients } = await sb.from('clients').select('name');
  console.log('\nSupabase sedia!');
  console.log(`Admin: ${users?.map(u => u.username).join(', ') || '-'}`);
  console.log(`Pelanggan: ${clients?.length || 0} rekod\n`);
}

main().catch(err => {
  console.error('\nRalat:', err.message);
  console.error('Semak SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dalam .env.local\n');
  process.exit(1);
});
