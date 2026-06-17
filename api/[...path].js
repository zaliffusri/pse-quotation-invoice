const { setAuthCookie, clearAuthCookie, getUserFromReq, requireUser } = require('../lib/auth');
const { getSupabase } = require('../lib/supabase');
const { getSetting, setSetting, logActivity, listDocuments } = require('../lib/db');
const { peekDocNumber, assignDocNumber, sanitizeCode } = require('../lib/numbering');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function getPath(req) {
  const slug = req.query.path;
  if (!slug) return '/';
  const parts = Array.isArray(slug) ? slug : [slug];
  return '/' + parts.join('/');
}

module.exports = async function handler(req, res) {
  const path = getPath(req);
  const method = req.method;
  const body = parseBody(req);

  try {
    // ─── Public: Auth ───
    if (method === 'POST' && path === '/auth/login') {
      const { username, password } = body;
      const sb = getSupabase();
      const { data: user } = await sb.from('admin_users')
        .select('id, username, name, password_hash')
        .eq('username', username).eq('password_hash', password).maybeSingle();
      if (!user) return res.status(401).json({ error: 'Username atau kata laluan salah.' });
      setAuthCookie(res, { id: user.id, username: user.username, name: user.name });
      return res.json({ ok: true, user: { id: user.id, username: user.username, name: user.name } });
    }

    if (method === 'POST' && path === '/auth/logout') {
      clearAuthCookie(res);
      return res.json({ ok: true });
    }

    if (method === 'GET' && path === '/auth/check') {
      const user = getUserFromReq(req);
      return res.json({ authenticated: !!user, user: user || null });
    }

    if (method === 'GET' && path === '/health') {
      return res.json({ ok: true, app: 'PSE System', version: '3.1', platform: 'vercel+supabase' });
    }

    // ─── Protected routes ───
    if (!requireUser(req, res)) return;

    const sb = getSupabase();

    if (method === 'GET' && path === '/dashboard') {
      const docs = await listDocuments();
      const { data: activity } = await sb.from('activity_log')
        .select('*').order('created_at', { ascending: false }).limit(10);
      return res.json({
        total: docs.length,
        quotations: docs.filter(d => d.doc_type === 'quotation').length,
        invoices: docs.filter(d => d.doc_type === 'invoice').length,
        totalValue: docs.reduce((s, d) => s + Number(d.total || 0), 0),
        recent: docs.slice(0, 8),
        activity: activity || []
      });
    }

    if (method === 'GET' && path === '/me') {
      const user = getUserFromReq(req);
      return res.json({
        user,
        company: await getSetting('company'),
        numberFormat: await getSetting('numberFormat', 'standard')
      });
    }

    if (method === 'GET' && path === '/settings') {
      return res.json({
        company: await getSetting('company'),
        numberFormat: await getSetting('numberFormat', 'standard')
      });
    }

    if (method === 'PUT' && path === '/settings') {
      if (body.company) await setSetting('company', body.company);
      if (body.numberFormat) await setSetting('numberFormat', body.numberFormat);
      await logActivity('settings_update');
      return res.json({ ok: true });
    }

    if (method === 'GET' && path === '/clients') {
      const { data, error } = await sb.from('clients').select('*').order('name');
      if (error) throw error;
      return res.json(data || []);
    }

    if (method === 'POST' && path === '/clients') {
      const { id, code, name, client_name, client_attn, client_address, client_phone, client_email } = body;
      const clientId = id || `client_${Date.now()}`;
      const safeCode = sanitizeCode(code || name);
      const row = { id: clientId, code: safeCode, name, client_name, client_attn, client_address, client_phone, client_email };
      const { error } = await sb.from('clients').upsert(row);
      if (error) throw error;
      await logActivity('client_save', null, { code: safeCode });
      return res.json({ ok: true, id: clientId });
    }

    const clientDel = path.match(/^\/clients\/(.+)$/);
    if (method === 'DELETE' && clientDel) {
      const { error } = await sb.from('clients').delete().eq('id', decodeURIComponent(clientDel[1]));
      if (error) throw error;
      await logActivity('client_delete', null, { id: clientDel[1] });
      return res.json({ ok: true });
    }

    if (method === 'GET' && path === '/number/peek') {
      const { type, date, clientCode } = req.query;
      const format = await getSetting('numberFormat', 'standard');
      const company = await getSetting('company');
      const number = await peekDocNumber(format, type, date, clientCode, company?.prefix || 'PSE');
      return res.json({ number, draft: true });
    }

    if (method === 'GET' && path === '/documents') {
      return res.json(await listDocuments(req.query.type));
    }

    const docMatch = path.match(/^\/documents\/([^/]+)$/);
    if (method === 'GET' && docMatch) {
      const docNumber = decodeURIComponent(docMatch[1]);
      const { data: doc, error } = await sb.from('documents').select('*').eq('doc_number', docNumber).maybeSingle();
      if (error) throw error;
      if (!doc) return res.status(404).json({ error: 'Dokumen tidak dijumpai.' });
      const { data: versions } = await sb.from('document_versions')
        .select('id, version, total, doc_date, saved_at')
        .eq('doc_number', docNumber).order('version', { ascending: false });
      return res.json({ ...doc, versions: versions || [] });
    }

    const verMatch = path.match(/^\/documents\/([^/]+)\/versions\/(\d+)$/);
    if (method === 'GET' && verMatch) {
      const docNumber = decodeURIComponent(verMatch[1]);
      const version = Number(verMatch[2]);
      const { data: row, error } = await sb.from('document_versions')
        .select('*').eq('doc_number', docNumber).eq('version', version).maybeSingle();
      if (error) throw error;
      if (!row) return res.status(404).json({ error: 'Versi tidak dijumpai.' });
      return res.json({ ...row.snapshot, version: row.version, saved_at: row.saved_at });
    }

    if (method === 'POST' && path === '/documents/finalize') {
      const snapshot = body;
      const errors = [];
      if (!snapshot.clientName?.trim()) errors.push('Nama pelanggan diperlukan.');
      if (!snapshot.docSubject?.trim()) errors.push('Tajuk diperlukan.');
      if (!snapshot.items?.some(i => i.desc?.trim())) errors.push('Sekurang-kurangnya satu item diperlukan.');
      if (errors.length) return res.status(400).json({ error: errors.join(' ') });

      const format = await getSetting('numberFormat', 'standard');
      const company = await getSetting('company');
      let docNumber = snapshot.docNumber;

      if (snapshot.mode === 'new' || !docNumber || String(docNumber).startsWith('[DRAF]')) {
        docNumber = await assignDocNumber(format, snapshot.docType, snapshot.docDate, snapshot.clientCode, company?.prefix || 'PSE');
      }

      const subtotal = (snapshot.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
      const sst = snapshot.sstEnabled ? subtotal * 0.08 : 0;
      const total = subtotal + sst;
      const fullSnapshot = { ...snapshot, docNumber, subtotal, sst, total };

      const { data: existing } = await sb.from('documents').select('latest_version, created_at')
        .eq('doc_number', docNumber).maybeSingle();
      const version = existing ? existing.latest_version + 1 : 1;
      const now = new Date().toISOString();

      const { error: docErr } = await sb.from('documents').upsert({
        doc_number: docNumber,
        doc_type: snapshot.docType,
        client_name: snapshot.clientName,
        client_code: sanitizeCode(snapshot.clientCode),
        ref_quotation: snapshot.refQuotation || null,
        latest_version: version,
        created_at: existing?.created_at || now,
        updated_at: now
      });
      if (docErr) throw docErr;

      const { error: verErr } = await sb.from('document_versions').insert({
        doc_number: docNumber,
        version,
        snapshot: fullSnapshot,
        total,
        doc_date: snapshot.docDate
      });
      if (verErr) throw verErr;

      await logActivity('document_finalize', docNumber, { version, type: snapshot.docType, total });
      return res.json({
        ok: true, docNumber, version, total,
        drivePath: `${snapshot.docType === 'quotation' ? 'sebutharga' : 'invois'}/${docNumber}`
      });
    }

    if (method === 'POST' && path === '/counters/reset') {
      if (!body.confirm) return res.status(400).json({ error: 'Confirmation required.' });
      const { data: rows } = await sb.from('counters').select('id');
      if (rows?.length) await sb.from('counters').delete().in('id', rows.map(r => r.id));
      await logActivity('counters_reset');
      return res.json({ ok: true });
    }

    if (method === 'GET' && path === '/backup/export') {
      const [{ data: clients }, { data: documents }, { data: versions }, { data: counters }] = await Promise.all([
        sb.from('clients').select('*'),
        sb.from('documents').select('*'),
        sb.from('document_versions').select('*'),
        sb.from('counters').select('*')
      ]);
      const backup = {
        exportedAt: new Date().toISOString(),
        app: 'PSE System v3.1',
        settings: { company: await getSetting('company'), numberFormat: await getSetting('numberFormat') },
        counters: Object.fromEntries((counters || []).map(c => [c.id, c.value])),
        clients: clients || [],
        documents: Object.fromEntries((documents || []).map(d => [d.doc_number, d])),
        versions: (versions || []).map(v => ({ ...v, snapshot: typeof v.snapshot === 'string' ? v.snapshot : JSON.stringify(v.snapshot) }))
      };
      res.setHeader('Content-Disposition', `attachment; filename=PSE-backup-${new Date().toISOString().slice(0, 10)}.json`);
      return res.json(backup);
    }

    if (method === 'POST' && path === '/backup/import') {
      const data = body;
      if (!data.documents) return res.status(400).json({ error: 'Fail backup tidak sah.' });
      if (data.settings?.company) await setSetting('company', data.settings.company);
      if (data.settings?.numberFormat) await setSetting('numberFormat', data.settings.numberFormat);
      if (data.counters) {
        const rows = Object.entries(data.counters).map(([id, value]) => ({ id, value }));
        if (rows.length) await sb.from('counters').upsert(rows);
      }
      if (data.clients?.length) await sb.from('clients').upsert(data.clients);
      const docRows = Object.values(data.documents || {});
      if (docRows.length) await sb.from('documents').upsert(docRows);
      if (data.versions?.length) {
        const verRows = data.versions.map(v => ({
          doc_number: v.doc_number,
          version: v.version,
          snapshot: typeof v.snapshot === 'string' ? JSON.parse(v.snapshot) : v.snapshot,
          total: v.total,
          doc_date: v.doc_date,
          saved_at: v.saved_at
        }));
        await sb.from('document_versions').upsert(verRows);
      }
      await logActivity('backup_import');
      return res.json({ ok: true });
    }

    return res.status(404).json({ error: 'Endpoint tidak dijumpai.', path });
  } catch (err) {
    console.error('[API Error]', path, err);
    return res.status(500).json({ error: err.message || 'Ralat server.' });
  }
};
