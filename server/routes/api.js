const { readStore, writeStore, getSetting, setSetting, logActivity } = require('../db');
const { peekDocNumber, assignDocNumber, sanitizeCode } = require('../numbering');

function getLatestTotal(docNumber) {
  const versions = readStore('versions', []).filter(v => v.doc_number === docNumber);
  if (!versions.length) return 0;
  return versions.sort((a, b) => b.version - a.version)[0].total || 0;
}

function listDocuments(type = null) {
  let docs = Object.values(readStore('documents', {}));
  if (type && type !== 'all') docs = docs.filter(d => d.doc_type === type);
  return docs
    .map(d => ({ ...d, total: getLatestTotal(d.doc_number) }))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

module.exports = function apiRoutes(req, res) {
  const path = req.path;
  const method = req.method;

  try {
    // Dashboard
    if (method === 'GET' && path === '/dashboard') {
      const docs = listDocuments();
      return res.json({
        total: docs.length,
        quotations: docs.filter(d => d.doc_type === 'quotation').length,
        invoices: docs.filter(d => d.doc_type === 'invoice').length,
        totalValue: docs.reduce((s, d) => s + d.total, 0),
        recent: docs.slice(0, 8),
        activity: readStore('activity', []).slice(0, 10)
      });
    }

    // Me / Settings
    if (method === 'GET' && path === '/me') {
      const users = readStore('users', []);
      const user = users.find(u => u.id === req.session.userId);
      return res.json({ user: user ? { id: user.id, username: user.username, name: user.name } : null, company: getSetting('company'), numberFormat: getSetting('numberFormat', 'standard') });
    }
    if (method === 'GET' && path === '/settings') {
      return res.json({ company: getSetting('company'), numberFormat: getSetting('numberFormat', 'standard') });
    }
    if (method === 'PUT' && path === '/settings') {
      if (req.body.company) setSetting('company', req.body.company);
      if (req.body.numberFormat) setSetting('numberFormat', req.body.numberFormat);
      logActivity('settings_update');
      return res.json({ ok: true });
    }

    // Clients
    if (method === 'GET' && path === '/clients') {
      return res.json(readStore('clients', []));
    }
    if (method === 'POST' && path === '/clients') {
      const { id, code, name, client_name, client_attn, client_address, client_phone, client_email } = req.body;
      const clients = readStore('clients', []);
      const clientId = id || `client_${Date.now()}`;
      const safeCode = sanitizeCode(code || name);
      const row = { id: clientId, code: safeCode, name, client_name, client_attn, client_address, client_phone, client_email };
      const idx = clients.findIndex(c => c.id === clientId);
      if (idx >= 0) clients[idx] = row; else clients.push(row);
      writeStore('clients', clients);
      logActivity('client_save', null, { code: safeCode });
      return res.json({ ok: true, id: clientId });
    }
    if (method === 'DELETE' && path.startsWith('/clients/')) {
      const id = path.split('/')[2];
      writeStore('clients', readStore('clients', []).filter(c => c.id !== id));
      logActivity('client_delete', null, { id });
      return res.json({ ok: true });
    }

    // Number peek
    if (method === 'GET' && path === '/number/peek') {
      const { type, date, clientCode } = req.query;
      const format = getSetting('numberFormat', 'standard');
      const prefix = getSetting('company')?.prefix || 'PSE';
      return res.json({ number: peekDocNumber(format, type, date, clientCode, prefix), draft: true });
    }

    // Documents list
    if (method === 'GET' && path === '/documents') {
      return res.json(listDocuments(req.query.type));
    }

    // Document detail
    const docMatch = path.match(/^\/documents\/([^/]+)$/);
    if (method === 'GET' && docMatch) {
      const docNumber = decodeURIComponent(docMatch[1]);
      const doc = readStore('documents', {})[docNumber];
      if (!doc) return res.status(404).json({ error: 'Dokumen tidak dijumpai.' });
      const versions = readStore('versions', []).filter(v => v.doc_number === docNumber)
        .sort((a, b) => b.version - a.version)
        .map(v => ({ id: v.id, version: v.version, total: v.total, doc_date: v.doc_date, saved_at: v.saved_at }));
      return res.json({ ...doc, versions });
    }

    // Document version
    const verMatch = path.match(/^\/documents\/([^/]+)\/versions\/(\d+)$/);
    if (method === 'GET' && verMatch) {
      const docNumber = decodeURIComponent(verMatch[1]);
      const version = Number(verMatch[2]);
      const row = readStore('versions', []).find(v => v.doc_number === docNumber && v.version === version);
      if (!row) return res.status(404).json({ error: 'Versi tidak dijumpai.' });
      return res.json({ ...JSON.parse(row.snapshot), version: row.version, saved_at: row.saved_at });
    }

    // Finalize document
    if (method === 'POST' && path === '/documents/finalize') {
      const snapshot = req.body;
      const errors = [];
      if (!snapshot.clientName?.trim()) errors.push('Nama pelanggan diperlukan.');
      if (!snapshot.docSubject?.trim()) errors.push('Tajuk diperlukan.');
      if (!snapshot.items?.some(i => i.desc?.trim())) errors.push('Sekurang-kurangnya satu item diperlukan.');
      if (errors.length) return res.status(400).json({ error: errors.join(' ') });

      const format = getSetting('numberFormat', 'standard');
      const prefix = getSetting('company')?.prefix || 'PSE';
      let docNumber = snapshot.docNumber;

      if (snapshot.mode === 'new' || !docNumber || docNumber.startsWith('[DRAF]')) {
        docNumber = assignDocNumber(format, snapshot.docType, snapshot.docDate, snapshot.clientCode, prefix);
      }

      const subtotal = (snapshot.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
      const sst = snapshot.sstEnabled ? subtotal * 0.08 : 0;
      const total = subtotal + sst;
      const fullSnapshot = { ...snapshot, docNumber, subtotal, sst, total };

      const docs = readStore('documents', {});
      const existing = docs[docNumber];
      const version = existing ? existing.latest_version + 1 : 1;
      const now = new Date().toISOString();

      docs[docNumber] = {
        doc_number: docNumber, doc_type: snapshot.docType,
        client_name: snapshot.clientName, client_code: sanitizeCode(snapshot.clientCode),
        ref_quotation: snapshot.refQuotation || null,
        latest_version: version, created_at: existing?.created_at || now, updated_at: now
      };
      writeStore('documents', docs);

      const versions = readStore('versions', []);
      versions.push({
        id: Date.now(), doc_number: docNumber, version,
        snapshot: JSON.stringify(fullSnapshot), total, doc_date: snapshot.docDate, saved_at: now
      });
      writeStore('versions', versions);

      logActivity('document_finalize', docNumber, { version, type: snapshot.docType, total });
      return res.json({
        ok: true, docNumber, version, total,
        drivePath: `${snapshot.docType === 'quotation' ? 'sebutharga' : 'invois'}/${docNumber}`
      });
    }

    // Reset counters
    if (method === 'POST' && path === '/counters/reset') {
      if (!req.body.confirm) return res.status(400).json({ error: 'Confirmation required.' });
      writeStore('counters', {});
      logActivity('counters_reset');
      return res.json({ ok: true });
    }

    // Backup export
    if (method === 'GET' && path === '/backup/export') {
      const backup = {
        exportedAt: new Date().toISOString(), app: 'PSE System v3',
        settings: { company: getSetting('company'), numberFormat: getSetting('numberFormat') },
        counters: readStore('counters', {}),
        clients: readStore('clients', []),
        documents: readStore('documents', {}),
        versions: readStore('versions', [])
      };
      res.setHeader('Content-Disposition', `attachment; filename=PSE-backup-${new Date().toISOString().slice(0, 10)}.json`);
      return res.json(backup);
    }

    // Backup import
    if (method === 'POST' && path === '/backup/import') {
      const data = req.body;
      if (!data.documents) return res.status(400).json({ error: 'Fail backup tidak sah.' });
      if (data.settings?.company) setSetting('company', data.settings.company);
      if (data.settings?.numberFormat) setSetting('numberFormat', data.settings.numberFormat);
      if (data.counters) writeStore('counters', data.counters);
      if (data.clients) writeStore('clients', data.clients);
      writeStore('documents', data.documents);
      writeStore('versions', data.versions || []);
      logActivity('backup_import');
      return res.json({ ok: true });
    }

    res.status(404).json({ error: 'Endpoint tidak dijumpai.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
