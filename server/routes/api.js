const { readStore, writeStore, getSetting, setSetting, logActivity } = require('../db');
const { peekDocNumber, assignDocNumber, sanitizeCode } = require('../numbering');
const { getLatestSnapshot, getReceiptSnapshots, effectiveRentalStatus, calcDiscountAmount } = require('../helpers');

function drivePath(docType, docNumber) {
  if (docType === 'quotation') return `sebutharga/${docNumber}`;
  if (docType === 'receipt') return `resit/${docNumber}`;
  return `invois/${docNumber}`;
}

function docTypeLabel(type) {
  if (type === 'quotation') return 'Sebutharga';
  if (type === 'receipt') return 'Resit';
  return 'Invois';
}

function getLatestTotal(docNumber) {
  const versions = readStore('versions', []).filter(v => v.doc_number === docNumber);
  if (!versions.length) return 0;
  return versions.sort((a, b) => b.version - a.version)[0].total || 0;
}

function buildDailyReport(dateStr) {  const rows = getReceiptSnapshots(({ doc, snap }) => {
    const d = snap.docDate || doc.updated_at?.slice(0, 10);
    return d === dateStr;
  });

  const itemCounts = {};
  const paymentBreakdown = { cash: 0, transfer: 0, duitnow: 0, other: 0 };
  let totalSales = 0;
  let discountTotal = 0;

  const transactions = rows.map(({ doc, snap }) => {
    (snap.items || []).forEach(it => {
      const key = it.desc?.trim();
      if (!key) return;
      itemCounts[key] = (itemCounts[key] || 0) + (Number(it.qty) || 1);
    });
    const pm = snap.paymentMethod || doc.payment_method || 'cash';
    const key = ['cash', 'transfer', 'duitnow'].includes(pm) ? pm : 'other';
    paymentBreakdown[key] = (paymentBreakdown[key] || 0) + (snap.total || 0);
    totalSales += snap.total || 0;
    discountTotal += snap.discountAmount || 0;
    return {
      doc_number: doc.doc_number,
      client_name: snap.clientName,
      unit_name: snap.unitName || doc.unit_name,
      total: snap.total,
      payment_method: pm,
      rental_status: effectiveRentalStatus(doc)
    };
  });

  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, qty]) => ({ name, qty }));

  return {
    date: dateStr,
    transactionCount: transactions.length,
    totalSales,
    discountTotal,
    paymentBreakdown,
    topItems,
    transactions
  };
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
      const today = new Date().toISOString().slice(0, 10);
      const todayReceipts = docs.filter(d => d.doc_type === 'receipt' && d.updated_at?.startsWith(today));
      const rentals = docs.filter(d => d.doc_type === 'receipt' && d.rental_status === 'rented');
      const overdue = rentals.filter(d => effectiveRentalStatus(d) === 'overdue');
      const report = buildDailyReport(today);
      return res.json({
        total: docs.length,
        quotations: docs.filter(d => d.doc_type === 'quotation').length,
        invoices: docs.filter(d => d.doc_type === 'invoice').length,
        receipts: docs.filter(d => d.doc_type === 'receipt').length,
        totalValue: docs.reduce((s, d) => s + d.total, 0),
        todaySales: todayReceipts.reduce((s, d) => s + d.total, 0),
        todayReceiptCount: todayReceipts.length,
        activeRentals: rentals.length,
        overdueRentals: overdue.length,
        todayTopItems: report.topItems.slice(0, 5),
        recent: docs.slice(0, 8),
        activity: readStore('activity', []).slice(0, 10)
      });
    }

    // Me / Settings
    if (method === 'GET' && path === '/me') {
      const users = readStore('users', []);
      const user = users.find(u => u.id === req.session.userId);
      return res.json({
        user: user ? { id: user.id, username: user.username, name: user.name } : null,
        company: getSetting('company'),
        numberFormat: getSetting('numberFormat', 'standard'),
        products: getSetting('products', []),
        units: getSetting('units', []),
        promos: getSetting('promos', [])
      });
    }
    if (method === 'GET' && path === '/settings') {
      return res.json({
        company: getSetting('company'),
        numberFormat: getSetting('numberFormat', 'standard'),
        products: getSetting('products', []),
        units: getSetting('units', []),
        promos: getSetting('promos', [])
      });
    }
    if (method === 'PUT' && path === '/settings') {
      if (req.body.company) setSetting('company', req.body.company);
      if (req.body.numberFormat) setSetting('numberFormat', req.body.numberFormat);
      logActivity('settings_update');
      return res.json({ ok: true });
    }

    // Product catalog (kaunter)
    if (method === 'GET' && path === '/products') {
      return res.json(getSetting('products', []));
    }
    if (method === 'PUT' && path === '/products') {
      const products = (req.body.products || []).map(p => ({
        id: p.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(p.name || '').trim(),
        price: Number(p.price) || 0,
        category: p.category || 'general'
      })).filter(p => p.name);
      setSetting('products', products);
      logActivity('products_update', null, { count: products.length });
      return res.json({ ok: true, products });
    }

    // PS5 units
    if (method === 'GET' && path === '/units') {
      return res.json(getSetting('units', []));
    }
    if (method === 'PUT' && path === '/units') {
      const units = (req.body.units || []).map(u => ({
        id: u.id || `unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(u.name || '').trim(),
        active: u.active !== false
      })).filter(u => u.name);
      setSetting('units', units);
      logActivity('units_update', null, { count: units.length });
      return res.json({ ok: true, units });
    }

    // Promo presets
    if (method === 'GET' && path === '/promos') {
      return res.json(getSetting('promos', []));
    }
    if (method === 'PUT' && path === '/promos') {
      const promos = (req.body.promos || []).map(p => ({
        id: p.id || `promo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(p.name || '').trim(),
        type: p.type === 'percent' ? 'percent' : 'fixed',
        value: Number(p.value) || 0
      })).filter(p => p.name);
      setSetting('promos', promos);
      logActivity('promos_update', null, { count: promos.length });
      return res.json({ ok: true, promos });
    }

    // Customer search (repeat renters)
    if (method === 'GET' && path === '/customers/search') {
      const q = (req.query.q || '').trim().toLowerCase();
      if (!q || q.length < 2) return res.json([]);
      const seen = new Set();
      const results = [];
      getReceiptSnapshots().forEach(({ snap }) => {
        const name = (snap.clientName || '').trim();
        const phone = (snap.clientPhone || '').trim();
        if (!name || !name.toLowerCase().includes(q)) return;
        const key = `${name}|${phone}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ name, phone });
      });
      return res.json(results.slice(0, 8));
    }

    // Rentals
    if (method === 'GET' && path === '/rentals') {
      const statusFilter = req.query.status || 'all';
      const docs = Object.values(readStore('documents', {}))
        .filter(d => d.doc_type === 'receipt' && d.rental_status)
        .map(d => {
          const snap = getLatestSnapshot(d.doc_number);
          const status = effectiveRentalStatus(d);
          return {
            doc_number: d.doc_number,
            client_name: d.client_name,
            client_phone: snap?.clientPhone || d.client_phone,
            unit_id: d.unit_id,
            unit_name: d.unit_name || snap?.unitName,
            rental_start: snap?.docDate || d.created_at?.slice(0, 10),
            rental_end: d.rental_end || snap?.rentalEnd,
            total: d.total || snap?.total,
            payment_method: d.payment_method || snap?.paymentMethod,
            rental_status: status,
            updated_at: d.updated_at
          };
        })
        .filter(r => statusFilter === 'all' || r.rental_status === statusFilter)
        .sort((a, b) => (a.rental_end || '').localeCompare(b.rental_end || ''));
      return res.json(docs);
    }

    const rentalMatch = path.match(/^\/rentals\/([^/]+)$/);
    if (method === 'PATCH' && rentalMatch) {
      const docNumber = decodeURIComponent(rentalMatch[1]);
      const docs = readStore('documents', {});
      const doc = docs[docNumber];
      if (!doc || doc.doc_type !== 'receipt') return res.status(404).json({ error: 'Sewaan tidak dijumpai.' });
      const newStatus = req.body.status;
      if (!['rented', 'returned'].includes(newStatus)) {
        return res.status(400).json({ error: 'Status tidak sah.' });
      }
      docs[docNumber] = { ...doc, rental_status: newStatus, updated_at: new Date().toISOString() };
      writeStore('documents', docs);
      logActivity('rental_status', docNumber, { status: newStatus });
      return res.json({ ok: true, rental_status: newStatus });
    }

    // Reports
    if (method === 'GET' && path === '/reports/daily') {
      const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
      return res.json(buildDailyReport(dateStr));
    }

    if (method === 'GET' && path === '/reports/daily/export') {
      const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
      const report = buildDailyReport(dateStr);
      const lines = [
        'PSE Laporan Harian,' + dateStr,
        'Transaksi,' + report.transactionCount,
        'Jumlah Jualan,' + report.totalSales.toFixed(2),
        'Jumlah Diskaun,' + report.discountTotal.toFixed(2),
        '',
        'Kaedah Bayaran,Jumlah',
        ...Object.entries(report.paymentBreakdown).map(([k, v]) => `${k},${v.toFixed(2)}`),
        '',
        'Item,Paling Laris (Qty)',
        ...report.topItems.map(i => `"${i.name.replace(/"/g, '""')}",${i.qty}`),
        '',
        'No Resit,Nama,Unit,Jumlah,Kaedah Bayaran',
        ...report.transactions.map(t =>
          `${t.doc_number},"${(t.client_name || '').replace(/"/g, '""')}","${(t.unit_name || '').replace(/"/g, '""')}",${t.total.toFixed(2)},${t.payment_method}`
        )
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=PSE-laporan-${dateStr}.csv`);
      return res.send('\uFEFF' + lines.join('\n'));
    }

    // Change password
    if (method === 'POST' && path === '/auth/change-password') {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Kata laluan semasa dan baru diperlukan.' });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'Kata laluan baru minimum 6 aksara.' });
      }
      const users = readStore('users', []);
      const user = users.find(u => u.id === req.session.userId);
      if (!user || user.password_hash !== currentPassword) {
        return res.status(401).json({ error: 'Kata laluan semasa salah.' });
      }
      user.password_hash = newPassword;
      writeStore('users', users);
      logActivity('password_change', null, { userId: user.id });
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
      if (snapshot.docType !== 'receipt' && !snapshot.docSubject?.trim()) errors.push('Tajuk diperlukan.');
      if (!snapshot.items?.some(i => i.desc?.trim())) errors.push('Sekurang-kurangnya satu item diperlukan.');
      if (errors.length) return res.status(400).json({ error: errors.join(' ') });

      const format = getSetting('numberFormat', 'standard');
      const prefix = getSetting('company')?.prefix || 'PSE';
      let docNumber = snapshot.docNumber?.replace(/^\[DRAF\]\s*/, '');

      const docs = readStore('documents', {});
      const existing = docNumber ? docs[docNumber] : null;

      if (existing?.locked) {
        return res.status(403).json({ error: 'Resit ini dikunci dan tidak boleh diubah. Nombor resit rasmi kekal ikut bayaran sebenar.' });
      }

      if (snapshot.mode === 'new' || !docNumber || docNumber.startsWith('[DRAF]')) {
        docNumber = assignDocNumber(format, snapshot.docType, snapshot.docDate, snapshot.clientCode || 'WALKIN', prefix);
      }

      const subtotal = (snapshot.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
      const discountAmount = calcDiscountAmount(subtotal, snapshot.discountType, snapshot.discountValue);
      const afterDiscount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
      const sst = snapshot.sstEnabled ? afterDiscount * 0.08 : 0;
      const total = Math.round((afterDiscount + sst) * 100) / 100;
      const fullSnapshot = {
        ...snapshot,
        docNumber,
        docSubject: snapshot.docSubject || (snapshot.docType === 'receipt' ? 'RESIT SEWA PS5' : ''),
        subtotal,
        discountAmount,
        sst,
        total
      };

      const version = existing ? existing.latest_version + 1 : 1;
      const now = new Date().toISOString();
      const isReceipt = snapshot.docType === 'receipt';

      if (isReceipt && snapshot.unitId) {
        const active = Object.values(docs).filter(d =>
          d.doc_type === 'receipt' &&
          d.unit_id === snapshot.unitId &&
          d.rental_status === 'rented' &&
          d.doc_number !== docNumber
        );
        if (active.length) {
          return res.status(400).json({
            error: `${snapshot.unitName || 'Unit'} sedang disewa (${active[0].doc_number}). Tandakan pulang dahulu.`
          });
        }
      }

      docs[docNumber] = {
        doc_number: docNumber,
        doc_type: snapshot.docType,
        client_name: snapshot.clientName,
        client_code: sanitizeCode(snapshot.clientCode || 'WALKIN'),
        client_phone: snapshot.clientPhone || null,
        ref_quotation: snapshot.refQuotation || null,
        latest_version: version,
        locked: isReceipt ? true : (existing?.locked || false),
        unit_id: isReceipt ? (snapshot.unitId || null) : (existing?.unit_id || null),
        unit_name: isReceipt ? (snapshot.unitName || null) : (existing?.unit_name || null),
        payment_method: isReceipt ? (snapshot.paymentMethod || 'cash') : (existing?.payment_method || null),
        rental_end: isReceipt ? (snapshot.rentalEnd || null) : (existing?.rental_end || null),
        rental_status: isReceipt ? 'rented' : (existing?.rental_status || null),
        created_at: existing?.created_at || now,
        updated_at: now
      };
      writeStore('documents', docs);

      const versions = readStore('versions', []);
      versions.push({
        id: Date.now(), doc_number: docNumber, version,
        snapshot: JSON.stringify(fullSnapshot), total, doc_date: snapshot.docDate, saved_at: now
      });
      writeStore('versions', versions);

      logActivity(isReceipt ? 'receipt_finalize' : 'document_finalize', docNumber, { version, type: snapshot.docType, total });
      return res.json({
        ok: true, docNumber, version, total, locked: isReceipt,
        drivePath: drivePath(snapshot.docType, docNumber)
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
        settings: {
          company: getSetting('company'),
          numberFormat: getSetting('numberFormat'),
          products: getSetting('products', []),
          units: getSetting('units', []),
          promos: getSetting('promos', [])
        },
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
      if (data.settings?.products) setSetting('products', data.settings.products);
      if (data.settings?.units) setSetting('units', data.settings.units);
      if (data.settings?.promos) setSetting('promos', data.settings.promos);
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
