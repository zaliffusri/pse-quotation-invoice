/**
 * PSE Offline Store — cache + local API when tiada internet (PWA / iPhone)
 * Data disimpan dalam localStorage pada peranti.
 */
const Offline = (() => {
  const KEYS = {
    session: 'pse_offline_session',
    creds: 'pse_offline_creds',
    me: 'pse_offline_me',
    clients: 'pse_offline_clients',
    documents: 'pse_offline_documents',
    versions: 'pse_offline_versions',
    counters: 'pse_offline_counters',
    activity: 'pse_offline_activity',
    queue: 'pse_offline_queue'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function isOnline() {
    return navigator.onLine !== false;
  }

  function hasOfflineBundle() {
    return !!(read(KEYS.session, null) && read(KEYS.me, null));
  }

  function getSession() {
    return read(KEYS.session, null);
  }

  function setSession(user) {
    write(KEYS.session, { user, savedAt: new Date().toISOString() });
  }

  function clearSession() {
    localStorage.removeItem(KEYS.session);
  }

  function saveCreds(username, password) {
    write(KEYS.creds, { username, password });
  }

  function checkCreds(username, password) {
    const c = read(KEYS.creds, null);
    return !!(c && c.username === username && c.password === password);
  }

  function cacheMe(me) {
    write(KEYS.me, me);
  }

  function cacheClients(clients) {
    write(KEYS.clients, clients || []);
  }

  function getMe() {
    return read(KEYS.me, null);
  }

  function getSetting(key, fallback) {
    const me = getMe() || {};
    if (key === 'company') return me.company || fallback;
    if (key === 'numberFormat') return me.numberFormat || fallback || 'standard';
    if (key === 'products') return me.products || fallback || [];
    if (key === 'units') return me.units || fallback || [];
    if (key === 'promos') return me.promos || fallback || [];
    return fallback;
  }

  function patchMe(partial) {
    const me = getMe() || {};
    write(KEYS.me, { ...me, ...partial });
  }

  function getDocs() {
    return read(KEYS.documents, {});
  }

  function setDocs(docs) {
    write(KEYS.documents, docs);
  }

  function getVersions() {
    return read(KEYS.versions, []);
  }

  function setVersions(versions) {
    write(KEYS.versions, versions);
  }

  function getCounters() {
    return read(KEYS.counters, {});
  }

  function setCounters(counters) {
    write(KEYS.counters, counters);
  }

  function logActivity(action, docNumber = null, meta = null) {
    const log = read(KEYS.activity, []);
    log.unshift({
      id: Date.now(),
      action,
      doc_number: docNumber,
      meta,
      created_at: new Date().toISOString()
    });
    write(KEYS.activity, log.slice(0, 200));
  }

  function enqueue(method, path, body) {
    const queue = read(KEYS.queue, []);
    queue.push({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      method,
      path,
      body: body || null,
      createdAt: new Date().toISOString()
    });
    write(KEYS.queue, queue);
    updateBanner();
  }

  function queueLength() {
    return read(KEYS.queue, []).length;
  }

  function sanitizeCode(code) {
    return (code || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'GEN';
  }

  function pad(n, len = 3) {
    return String(n).padStart(len, '0');
  }

  function getDateParts(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const yyyy = String(date.getFullYear());
    const yy = yyyy.slice(2);
    const mm = pad(date.getMonth() + 1, 2);
    return { yyyy, yymm: `${yy}${mm}`, yyyymm: `${yyyy}${mm}` };
  }

  const FORMATS = {
    standard: {
      quo: (p, code, d, seq) => `${p}-QUO-${d.yyyy}-${pad(seq, 4)}`,
      inv: (p, code, d, seq) => `${p}-INV-${d.yyyy}-${pad(seq, 4)}`,
      rcp: (p, code, d, seq) => `${p}-RCP-${d.yyyy}-${pad(seq, 4)}`,
      counterKey: (type, d) => `${type}_std_${d.yyyy}`
    },
    classic: {
      quo: (p, code, d, seq) => `${p}/${code}/${d.yymm}-${pad(seq, 3)}`,
      inv: (p, code, d, seq) => `${p}/INV/${d.yymm}-${pad(seq, 3)}`,
      rcp: (p, code, d, seq) => `${p}/RCP/${d.yymm}-${pad(seq, 3)}`,
      counterKey: (type, d, code) =>
        type === 'quotation' ? `quo_cls_${code}_${d.yymm}` : `${type === 'receipt' ? 'rcp' : 'inv'}_cls_${d.yymm}`
    },
    monthly: {
      quo: (p, code, d, seq) => `${p}/QUO/${d.yyyymm}-${pad(seq, 3)}`,
      inv: (p, code, d, seq) => `${p}/INV/${d.yyyymm}-${pad(seq, 3)}`,
      rcp: (p, code, d, seq) => `${p}/RCP/${d.yyyymm}-${pad(seq, 3)}`,
      counterKey: (type, d) => `${type}_mth_${d.yyyymm}`
    },
    simple: {
      quo: (p, code, d, seq) => `QUO-${d.yyyymm}-${pad(seq, 3)}`,
      inv: (p, code, d, seq) => `INV-${d.yyyymm}-${pad(seq, 3)}`,
      rcp: (p, code, d, seq) => `RCP-${d.yyyymm}-${pad(seq, 3)}`,
      counterKey: (type, d) => `${type}_simp_${d.yyyymm}`
    }
  };

  function buildNumber(format, type, dateStr, clientCode, seq, prefix = 'PSE') {
    const fmt = FORMATS[format] || FORMATS.standard;
    const d = getDateParts(dateStr);
    const code = sanitizeCode(clientCode);
    const builder = type === 'quotation' ? fmt.quo : type === 'receipt' ? fmt.rcp : fmt.inv;
    return builder(prefix, code, d, seq);
  }

  function peekDocNumber(format, type, dateStr, clientCode, prefix = 'PSE') {
    const fmt = FORMATS[format] || FORMATS.standard;
    const d = getDateParts(dateStr);
    const code = sanitizeCode(clientCode);
    const key = fmt.counterKey(type, d, code);
    const counters = getCounters();
    const seq = (counters[key] || 0) + 1;
    return buildNumber(format, type, dateStr, clientCode, seq, prefix);
  }

  function assignDocNumber(format, type, dateStr, clientCode, prefix = 'PSE') {
    const fmt = FORMATS[format] || FORMATS.standard;
    const d = getDateParts(dateStr);
    const code = sanitizeCode(clientCode);
    const key = fmt.counterKey(type, d, code);
    const counters = getCounters();
    const seq = (counters[key] || 0) + 1;
    counters[key] = seq;
    setCounters(counters);
    return buildNumber(format, type, dateStr, clientCode, seq, prefix);
  }

  function calcDiscountAmount(subtotal, type = 'none', value = 0) {
    const sub = Number(subtotal) || 0;
    const val = Number(value) || 0;
    if (type === 'percent') {
      const pct = Math.min(100, Math.max(0, val));
      return Math.round(sub * pct / 100 * 100) / 100;
    }
    if (type === 'fixed') return Math.min(sub, Math.max(0, val));
    return 0;
  }

  function effectiveRentalStatus(doc) {
    if (!doc || doc.doc_type !== 'receipt') return null;
    if (doc.rental_status === 'returned') return 'returned';
    if (doc.rental_status !== 'rented') return doc.rental_status || null;
    const end = doc.rental_end;
    if (end && end < new Date().toISOString().slice(0, 10)) return 'overdue';
    return 'rented';
  }

  function getLatestSnapshot(docNumber) {
    const versions = getVersions()
      .filter((v) => v.doc_number === docNumber)
      .sort((a, b) => b.version - a.version);
    if (!versions.length) return null;
    const snap = versions[0].snapshot;
    return typeof snap === 'string' ? JSON.parse(snap) : snap;
  }

  function getLatestTotal(docNumber) {
    const versions = getVersions()
      .filter((v) => v.doc_number === docNumber)
      .sort((a, b) => b.version - a.version);
    return versions[0]?.total || 0;
  }

  function listDocuments(type = null) {
    let docs = Object.values(getDocs());
    if (type && type !== 'all') docs = docs.filter((d) => d.doc_type === type);
    return docs
      .map((d) => ({ ...d, total: getLatestTotal(d.doc_number) }))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  function drivePath(docType, docNumber) {
    if (docType === 'quotation') return `sebutharga/${docNumber}`;
    if (docType === 'receipt') return `resit/${docNumber}`;
    return `invois/${docNumber}`;
  }

  function buildDailyReport(dateStr) {
    const rows = [];
    getVersions().forEach((v) => {
      const snap = typeof v.snapshot === 'string' ? JSON.parse(v.snapshot) : v.snapshot;
      if (!snap || snap.docType !== 'receipt') return;
      const doc = getDocs()[v.doc_number];
      if (!doc) return;
      const latest = getVersions()
        .filter((x) => x.doc_number === v.doc_number)
        .sort((a, b) => b.version - a.version)[0];
      if (latest.version !== v.version) return;
      const d = snap.docDate || doc.updated_at?.slice(0, 10);
      if (d === dateStr) rows.push({ doc, snap });
    });

    const itemCounts = {};
    const paymentBreakdown = { cash: 0, transfer: 0, duitnow: 0, other: 0 };
    let totalSales = 0;
    let discountTotal = 0;

    const transactions = rows.map(({ doc, snap }) => {
      (snap.items || []).forEach((it) => {
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

  /** Cache GETs when online so offline mode has data */
  async function hydrateFromNetwork() {
    if (!isOnline() || !window.API) return;
    try {
      const me = await window.API.request('/me', { _skipOffline: true });
      cacheMe(me);
      const clients = await window.API.request('/clients', { _skipOffline: true });
      cacheClients(clients);
      const docs = await window.API.request('/documents', { _skipOffline: true });
      const docMap = {};
      const versions = [];
      for (const d of docs) {
        try {
          const detail = await window.API.request('/documents/' + encodeURIComponent(d.doc_number), { _skipOffline: true });
          docMap[d.doc_number] = detail;
          const verList = detail.versions || [];
          for (const v of verList) {
            try {
              const snap = await window.API.request(
                `/documents/${encodeURIComponent(d.doc_number)}/versions/${v.version}`,
                { _skipOffline: true }
              );
              versions.push({
                id: v.id || `${d.doc_number}_v${v.version}`,
                doc_number: d.doc_number,
                version: v.version,
                snapshot: snap,
                total: v.total ?? snap.total,
                doc_date: v.doc_date || snap.docDate,
                saved_at: v.saved_at || snap.saved_at
              });
            } catch { /* skip version */ }
          }
        } catch { /* skip doc */ }
      }
      setDocs(docMap);
      setVersions(versions);
    } catch (err) {
      console.warn('[Offline] hydrate failed', err);
    }
  }

  async function flushQueue() {
    if (!isOnline() || !window.API) return { synced: 0, failed: 0 };
    const queue = read(KEYS.queue, []);
    if (!queue.length) return { synced: 0, failed: 0 };

    const remaining = [];
    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        await window.API.request(item.path, {
          method: item.method,
          body: item.body ? JSON.stringify(item.body) : undefined,
          _skipOffline: true,
          _fromQueue: true
        });
        synced += 1;
      } catch (err) {
        failed += 1;
        remaining.push(item);
        console.warn('[Offline] sync failed', item.path, err);
      }
    }
    write(KEYS.queue, remaining);
    updateBanner();
    if (synced) {
      try { await hydrateFromNetwork(); } catch { /* ignore */ }
    }
    return { synced, failed };
  }

  function parseQuery(path) {
    const [pathname, qs] = path.split('?');
    const query = {};
    if (qs) {
      qs.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { pathname, query };
  }

  function handle(method, fullPath, body) {
    const { pathname, query } = parseQuery(fullPath);

    if (method === 'GET' && pathname === '/auth/check') {
      const session = getSession();
      return { authenticated: !!session?.user, user: session?.user || null };
    }

    if (method === 'POST' && pathname === '/auth/login') {
      if (!checkCreds(body.username, body.password)) {
        const err = new Error('Tiada sambungan. Log masuk online sekali dahulu pada telefon ini.');
        err.status = 401;
        throw err;
      }
      const session = getSession();
      const user = (session?.user && session.user.username === body.username)
        ? session.user
        : { id: 1, username: body.username, name: 'Administrator PSE' };
      setSession(user);
      return { ok: true, user, offline: true };
    }

    if (method === 'POST' && pathname === '/auth/logout') {
      clearSession();
      return { ok: true };
    }

    if (!getSession()?.user) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    if (method === 'GET' && pathname === '/me') {
      const me = getMe();
      if (!me) throw new Error('Data offline belum tersedia. Sambung internet sekali dahulu.');
      return me;
    }

    if (method === 'GET' && pathname === '/clients') {
      return read(KEYS.clients, []);
    }

    if (method === 'POST' && pathname === '/clients') {
      const clients = read(KEYS.clients, []);
      const clientId = body.id || `client_${Date.now()}`;
      const safeCode = sanitizeCode(body.code || body.name);
      const row = {
        id: clientId,
        code: safeCode,
        name: body.name,
        client_name: body.client_name,
        client_attn: body.client_attn,
        client_address: body.client_address,
        client_phone: body.client_phone,
        client_email: body.client_email
      };
      const idx = clients.findIndex((c) => c.id === clientId);
      if (idx >= 0) clients[idx] = row; else clients.push(row);
      cacheClients(clients);
      enqueue('POST', '/clients', body);
      logActivity('client_save', null, { code: safeCode, offline: true });
      return { ok: true, id: clientId, offline: true };
    }

    if (method === 'DELETE' && pathname.startsWith('/clients/')) {
      const id = decodeURIComponent(pathname.split('/')[2]);
      cacheClients(read(KEYS.clients, []).filter((c) => c.id !== id));
      enqueue('DELETE', pathname, null);
      return { ok: true, offline: true };
    }

    if (method === 'GET' && pathname === '/number/peek') {
      const format = getSetting('numberFormat', 'standard');
      const prefix = getSetting('company')?.prefix || 'PSE';
      return {
        number: peekDocNumber(format, query.type, query.date, query.clientCode || 'GEN', prefix),
        draft: true,
        offline: true
      };
    }

    if (method === 'GET' && pathname === '/documents') {
      return listDocuments(query.type || null);
    }

    const docMatch = pathname.match(/^\/documents\/([^/]+)$/);
    if (method === 'GET' && docMatch) {
      const docNumber = decodeURIComponent(docMatch[1]);
      const doc = getDocs()[docNumber];
      if (!doc) {
        const err = new Error('Dokumen tidak dijumpai.');
        err.status = 404;
        throw err;
      }
      const versions = getVersions()
        .filter((v) => v.doc_number === docNumber)
        .sort((a, b) => b.version - a.version)
        .map((v) => ({
          id: v.id,
          version: v.version,
          total: v.total,
          doc_date: v.doc_date,
          saved_at: v.saved_at
        }));
      return { ...doc, versions };
    }

    const verMatch = pathname.match(/^\/documents\/([^/]+)\/versions\/(\d+)$/);
    if (method === 'GET' && verMatch) {
      const docNumber = decodeURIComponent(verMatch[1]);
      const version = Number(verMatch[2]);
      const row = getVersions().find((v) => v.doc_number === docNumber && v.version === version);
      if (!row) {
        const err = new Error('Versi tidak dijumpai.');
        err.status = 404;
        throw err;
      }
      const snap = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
      return { ...snap, version: row.version, saved_at: row.saved_at };
    }

    if (method === 'POST' && pathname === '/documents/finalize') {
      const snapshot = body;
      const errors = [];
      if (!snapshot.clientName?.trim()) errors.push('Nama pelanggan diperlukan.');
      if (snapshot.docType !== 'receipt' && !snapshot.docSubject?.trim()) errors.push('Tajuk diperlukan.');
      if (!snapshot.items?.some((i) => i.desc?.trim())) errors.push('Sekurang-kurangnya satu item diperlukan.');
      if (errors.length) {
        const err = new Error(errors.join(' '));
        err.status = 400;
        throw err;
      }

      const format = getSetting('numberFormat', 'standard');
      const prefix = getSetting('company')?.prefix || 'PSE';
      let docNumber = snapshot.docNumber?.replace(/^\[DRAF\]\s*/, '');
      const docs = getDocs();
      const existing = docNumber ? docs[docNumber] : null;

      if (existing?.locked) {
        const err = new Error('Resit ini dikunci dan tidak boleh diubah.');
        err.status = 403;
        throw err;
      }

      if (snapshot.mode === 'new' || !docNumber || String(docNumber).startsWith('[DRAF]')) {
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
        const active = Object.values(docs).filter((d) =>
          d.doc_type === 'receipt' &&
          d.unit_id === snapshot.unitId &&
          d.rental_status === 'rented' &&
          d.doc_number !== docNumber
        );
        if (active.length) {
          const err = new Error(`${snapshot.unitName || 'Unit'} sedang disewa (${active[0].doc_number}). Tandakan pulang dahulu.`);
          err.status = 400;
          throw err;
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
      setDocs(docs);

      const versions = getVersions();
      versions.push({
        id: Date.now(),
        doc_number: docNumber,
        version,
        snapshot: fullSnapshot,
        total,
        doc_date: snapshot.docDate,
        saved_at: now
      });
      setVersions(versions);

      // Queue a server finalize with the assigned number (edit mode)
      const queueBody = { ...fullSnapshot, mode: 'edit', docNumber };
      enqueue('POST', '/documents/finalize', queueBody);
      logActivity(isReceipt ? 'receipt_finalize' : 'document_finalize', docNumber, { version, offline: true });

      return {
        ok: true,
        docNumber,
        version,
        total,
        locked: isReceipt,
        drivePath: drivePath(snapshot.docType, docNumber),
        offline: true
      };
    }

    if (method === 'GET' && pathname === '/dashboard') {
      const docs = listDocuments();
      const today = new Date().toISOString().slice(0, 10);
      const todayReceipts = docs.filter((d) => d.doc_type === 'receipt' && d.updated_at?.startsWith(today));
      const rentals = docs.filter((d) => d.doc_type === 'receipt' && d.rental_status === 'rented');
      const overdue = rentals.filter((d) => effectiveRentalStatus(d) === 'overdue');
      const report = buildDailyReport(today);
      return {
        total: docs.length,
        quotations: docs.filter((d) => d.doc_type === 'quotation').length,
        invoices: docs.filter((d) => d.doc_type === 'invoice').length,
        receipts: docs.filter((d) => d.doc_type === 'receipt').length,
        totalValue: docs.reduce((s, d) => s + d.total, 0),
        todaySales: todayReceipts.reduce((s, d) => s + d.total, 0),
        todayReceiptCount: todayReceipts.length,
        activeRentals: rentals.length,
        overdueRentals: overdue.length,
        todayTopItems: report.topItems.slice(0, 5),
        recent: docs.slice(0, 8),
        activity: read(KEYS.activity, []).slice(0, 10)
      };
    }

    if (method === 'GET' && pathname === '/rentals') {
      const statusFilter = query.status || 'all';
      return Object.values(getDocs())
        .filter((d) => d.doc_type === 'receipt' && d.rental_status)
        .map((d) => {
          const snap = getLatestSnapshot(d.doc_number);
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
            rental_status: effectiveRentalStatus(d),
            updated_at: d.updated_at
          };
        })
        .filter((r) => statusFilter === 'all' || r.rental_status === statusFilter)
        .sort((a, b) => (a.rental_end || '').localeCompare(b.rental_end || ''));
    }

    const rentalMatch = pathname.match(/^\/rentals\/([^/]+)$/);
    if (method === 'PATCH' && rentalMatch) {
      const docNumber = decodeURIComponent(rentalMatch[1]);
      const docs = getDocs();
      const doc = docs[docNumber];
      if (!doc || doc.doc_type !== 'receipt') {
        const err = new Error('Sewaan tidak dijumpai.');
        err.status = 404;
        throw err;
      }
      const newStatus = body.status;
      if (!['rented', 'returned'].includes(newStatus)) {
        const err = new Error('Status tidak sah.');
        err.status = 400;
        throw err;
      }
      docs[docNumber] = { ...doc, rental_status: newStatus, updated_at: new Date().toISOString() };
      setDocs(docs);
      enqueue('PATCH', pathname, body);
      return { ok: true, rental_status: newStatus, offline: true };
    }

    if (method === 'GET' && pathname === '/reports/daily') {
      return buildDailyReport(query.date || new Date().toISOString().slice(0, 10));
    }

    if (method === 'GET' && pathname === '/customers/search') {
      const q = (query.q || '').trim().toLowerCase();
      if (!q || q.length < 2) return [];
      const seen = new Set();
      const results = [];
      getVersions().forEach((v) => {
        const snap = typeof v.snapshot === 'string' ? JSON.parse(v.snapshot) : v.snapshot;
        if (!snap || snap.docType !== 'receipt') return;
        const name = (snap.clientName || '').trim();
        const phone = (snap.clientPhone || '').trim();
        if (!name || !name.toLowerCase().includes(q)) return;
        const key = `${name}|${phone}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ name, phone });
      });
      return results.slice(0, 8);
    }

    if (method === 'PUT' && pathname === '/products') {
      const products = (body.products || []).map((p) => ({
        id: p.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(p.name || '').trim(),
        price: Number(p.price) || 0,
        category: p.category || 'general'
      })).filter((p) => p.name);
      patchMe({ products });
      enqueue('PUT', '/products', { products });
      return { ok: true, products, offline: true };
    }

    if (method === 'PUT' && pathname === '/units') {
      const units = (body.units || []).map((u) => ({
        id: u.id || `unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(u.name || '').trim(),
        active: u.active !== false
      })).filter((u) => u.name);
      patchMe({ units });
      enqueue('PUT', '/units', { units });
      return { ok: true, units, offline: true };
    }

    if (method === 'PUT' && pathname === '/promos') {
      const promos = (body.promos || []).map((p) => ({
        id: p.id || `promo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(p.name || '').trim(),
        type: p.type === 'percent' ? 'percent' : 'fixed',
        value: Number(p.value) || 0
      })).filter((p) => p.name);
      patchMe({ promos });
      enqueue('PUT', '/promos', { promos });
      return { ok: true, promos, offline: true };
    }

    if (method === 'PUT' && pathname === '/settings') {
      if (body.numberFormat) patchMe({ numberFormat: body.numberFormat });
      if (body.company) patchMe({ company: body.company });
      enqueue('PUT', '/settings', body);
      return { ok: true, offline: true };
    }

    if (method === 'GET' && pathname === '/backup/export') {
      return {
        exportedAt: new Date().toISOString(),
        app: 'PSE System v3.1 (offline)',
        settings: {
          company: getSetting('company'),
          numberFormat: getSetting('numberFormat'),
          products: getSetting('products', []),
          units: getSetting('units', []),
          promos: getSetting('promos', [])
        },
        counters: getCounters(),
        clients: read(KEYS.clients, []),
        documents: getDocs(),
        versions: getVersions()
      };
    }

    if (method === 'POST' && (pathname === '/backup/import' || pathname === '/counters/reset' || pathname === '/auth/change-password')) {
      const err = new Error('Fungsi ini memerlukan internet.');
      err.status = 503;
      throw err;
    }

    const err = new Error('Endpoint tidak tersedia offline: ' + pathname);
    err.status = 404;
    throw err;
  }

  function updateBanner() {
    const el = document.getElementById('offlineBanner');
    if (!el) return;
    const offline = !isOnline();
    const pending = queueLength();
    if (!offline && !pending) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (offline) {
      el.textContent = pending
        ? `Mode offline — ${pending} perubahan menunggu sync`
        : 'Mode offline — data disimpan pada telefon';
      el.className = 'offline-banner offline-banner--off';
    } else if (pending) {
      el.textContent = `${pending} perubahan offline menunggu sync…`;
      el.className = 'offline-banner offline-banner--sync';
    }
  }

  function installBanner() {
    if (document.getElementById('offlineBanner')) return;
    const el = document.createElement('div');
    el.id = 'offlineBanner';
    el.className = 'offline-banner';
    el.hidden = true;
    el.setAttribute('role', 'status');
    document.body.prepend(el);
    updateBanner();
  }

  window.addEventListener('online', async () => {
    updateBanner();
    const result = await flushQueue();
    if (result.synced) updateBanner();
  });
  window.addEventListener('offline', updateBanner);

  return {
    isOnline,
    hasOfflineBundle,
    getSession,
    setSession,
    clearSession,
    saveCreds,
    checkCreds,
    cacheMe,
    cacheClients,
    hydrateFromNetwork,
    flushQueue,
    handle,
    queueLength,
    updateBanner,
    installBanner,
    KEYS
  };
})();
