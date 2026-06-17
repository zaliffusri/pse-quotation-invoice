const { getSupabase } = require('./supabase');

async function getSetting(key, fallback = null) {
  const sb = getSupabase();
  const { data } = await sb.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return fallback;
  return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
}

async function setSetting(key, value) {
  const sb = getSupabase();
  const { error } = await sb.from('app_settings').upsert({
    key, value, updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function logActivity(action, docNumber = null, meta = null) {
  const sb = getSupabase();
  await sb.from('activity_log').insert({ action, doc_number: docNumber, meta });
}

async function listDocuments(type = null) {
  const sb = getSupabase();
  let q = sb.from('documents').select('*').order('updated_at', { ascending: false });
  if (type && type !== 'all') q = q.eq('doc_type', type);
  const { data: docs, error } = await q;
  if (error) throw error;

  const withTotals = await Promise.all((docs || []).map(async d => {
    const { data: ver } = await sb.from('document_versions')
      .select('total').eq('doc_number', d.doc_number)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    return { ...d, total: ver?.total || 0 };
  }));
  return withTotals;
}

module.exports = { getSetting, setSetting, logActivity, listDocuments };
