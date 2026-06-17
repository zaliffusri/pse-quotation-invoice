const { createClient } = require('@supabase/supabase-js');

let client = null;

function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY mesti diset dalam environment variables.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

module.exports = { getSupabase };
