const COMPANY = {
  name: 'PILLAR STRIDE ENTERPRISE',
  regNo: '(TR0299805-M)',
  prefix: 'PSE',
  address: [
    'No. 27 Jalan Pinang Merah 4,',
    'Taman Sayong Pinang, Bandar Tenggara',
    'Kulai, Johor 81440'
  ],
  email: 'zaliff2258@gmail.com',
  phone: '+60133663007',
  bank: {
    payee: 'PILLAR STRIDE ENTERPRISE',
    bankName: 'Maybank',
    accountNo: '5515 8407 8633'
  }
};

const SST_RATE = 0.08;

const NUMBER_FORMATS = {
  standard: {
    hint: 'PSE-QUO-2026-0001 / PSE-INV-2026-0001 — counter setahun, reset melalui Tetapan',
    quo: (p, code, d, seq) => `${p}-QUO-${d.yyyy}-${pad(seq, 4)}`,
    inv: (p, code, d, seq) => `${p}-INV-${d.yyyy}-${pad(seq, 4)}`,
    counterKey: (type, d) => `${type}_std_${d.yyyy}`
  },
  classic: {
    hint: 'PSE/KOD/YYMM-001 — counter ikut pelanggan (sebutharga) / bulan (invois)',
    quo: (p, code, d, seq) => `${p}/${code}/${d.yymm}-${pad(seq, 3)}`,
    inv: (p, code, d, seq) => `${p}/INV/${d.yymm}-${pad(seq, 3)}`,
    counterKey: (type, d, code) => type === 'quotation' ? `quo_cls_${code}_${d.yymm}` : `inv_cls_${d.yymm}`
  },
  monthly: {
    hint: 'PSE/QUO/202602-001 — reset setiap bulan',
    quo: (p, code, d, seq) => `${p}/QUO/${d.yyyymm}-${pad(seq, 3)}`,
    inv: (p, code, d, seq) => `${p}/INV/${d.yyyymm}-${pad(seq, 3)}`,
    counterKey: (type, d) => `${type}_mth_${d.yyyymm}`
  },
  simple: {
    hint: 'QUO-202602-001 / INV-202602-001',
    quo: (p, code, d, seq) => `QUO-${d.yyyymm}-${pad(seq, 3)}`,
    inv: (p, code, d, seq) => `INV-${d.yyyymm}-${pad(seq, 3)}`,
    counterKey: (type, d) => `${type}_simp_${d.yyyymm}`
  }
};

const DEFAULT_ITEMS = [
  { desc: 'Pakej Lengkap Mesin Slushy', price: 3200, qty: 1 },
  { desc: 'Pemegang Cawan', price: 30, qty: 1 },
  { desc: 'Sokongan Teknikal (6 Bulan)', price: 0, qty: 1 }
];

const DEFAULT_TERMS_QUO = [
  'Hak Milik Sementara: Mesin ini kekal menjadi Hak Milik Pembekal sehingga pembayaran penuh diselesaikan.',
  'Hak Milik Kekal: Hak milik hanya akan berpindah kepada pelanggan setelah bayaran akhir diterima.',
  'Bayaran perlulah dalam tempoh 7 hari pada awal setiap bulan.',
  'Tempoh maksimum bayaran bulanan hanya 12 bulan.',
  'Kerosakan: Sebarang kerosakan mesin akibat kecuaian pengguna semasa tempoh pembayaran adalah tanggungjawab pelanggan sepenuhnya.',
  'Kegagalan Bayaran: Jika pembayaran tertunggak melebihi 30 hari, Pembekal berhak mengambil semula (repossess) mesin tersebut tanpa sebarang pemulangan wang.',
  'Bagi pembayaran, sila tulis cek atas nama Pillar Stride Enterprise dan depositkan ke akaun Maybank 551584078633.'
];

const DEFAULT_TERMS_INV = [
  'Bayaran perlu dibuat sebelum tarikh akhir bayar yang dinyatakan di atas.',
  'Sila buat bayaran ke akaun bank seperti butiran di bawah.',
  'Sila sertakan nombor invois sebagai rujukan bayaran.',
  'Invois ini adalah sah tanpa tandatangan apabila dijana melalui sistem.'
];

const DOC_LABELS = {
  quotation: {
    type: 'SEBUTHARGA', refLabel: 'Ruj.', dateLabel: 'Tarikh',
    clientLabel: 'Kepada', fromLabel: 'Daripada', greeting: 'Tuan/Puan,',
    sectionTitle: '1. Jadual Sebutharga',
    tableHeaders: ['No', 'Item', 'Harga Seunit (RM)', 'Bilangan (Unit)', 'Jumlah (RM)'],
    subtotal: 'Subjumlah (RM)', grandTotal: 'Jumlah Keseluruhan (RM)', total: 'Jumlah (RM)', sst: 'SST 8% (RM)',
    termsTitle: 'Terma & Syarat', bankingTitle: 'Maklumat Pembayaran',
    payee: 'Nama Penerima', bank: 'Bank', account: 'No. Akaun', paymentRef: 'Rujukan bayaran',
    attn: 'Perhatian', tel: 'Tel', email: 'E-mel',
    defaultSubject: 'SEBUTHARGA PEMBEKALAN PAKEJ LENGKAP MESIN SLUSHY'
  },
  invoice: {
    type: 'INVOIS', refLabel: 'No. Invois', dateLabel: 'Tarikh', dueLabel: 'Tarikh Akhir Bayar',
    quoRefLabel: 'Ruj. Sebutharga', clientLabel: 'Kepada', fromLabel: 'Daripada', greeting: 'Tuan/Puan,',
    sectionTitle: '1. Butiran Invois',
    tableHeaders: ['No', 'Item', 'Harga Seunit (RM)', 'Bilangan (Unit)', 'Jumlah (RM)'],
    subtotal: 'Subjumlah (RM)', grandTotal: 'Jumlah Keseluruhan (RM)', total: 'Jumlah (RM)', sst: 'SST 8% (RM)',
    termsTitle: 'Terma & Syarat', bankingTitle: 'Maklumat Pembayaran',
    payee: 'Nama Penerima', bank: 'Bank', account: 'No. Akaun', paymentRef: 'Rujukan bayaran',
    attn: 'Perhatian', tel: 'Tel', email: 'E-mel',
    defaultSubject: 'INVOIS PEMBEKALAN PAKEJ LENGKAP MESIN SLUSHY'
  }
};

const DEFAULT_CLIENTS = [{
  id: 'kosiswa', name: 'KOSISWA UTHM', code: 'KOSISWA',
  clientName: 'KOSISWA UTHM — Universiti Tun Hussein Onn Malaysia (UTHM)',
  clientAttn: 'Pn. Mimi',
  clientAddress: '86400 Parit Raja\nBatu Pahat, Johor\nMalaysia',
  clientPhone: '60179863173', clientEmail: 'miminuraleeya94@gmail.com'
}];

const state = {
  docType: 'quotation',
  items: DEFAULT_ITEMS.map(i => ({ ...i })),
  terms: [...DEFAULT_TERMS_QUO],
  mode: 'new',
  lockedNumber: false,
  finalized: false,
  dirty: false,
  editingVersion: null,
  selectedFolder: null
};

const $ = id => document.getElementById(id);

function pad(n, len = 3) { return String(n).padStart(len, '0'); }

function getDateParts(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(2);
  const mm = pad(date.getMonth() + 1, 2);
  return { yyyy, yymm: `${yy}${mm}`, yyyymm: `${yyyy}${mm}` };
}

function getNumberFormat() {
  const fmt = $('numberFormat')?.value || PSEStorage.loadSettings().numberFormat || 'standard';
  return NUMBER_FORMATS[fmt] || NUMBER_FORMATS.standard;
}

function sanitizeCode(code) {
  return (code || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'GEN';
}

function counterKey(type, date, clientCode) {
  const fmt = getNumberFormat();
  const d = getDateParts(date);
  const code = sanitizeCode(clientCode);
  return fmt.counterKey(type, d, code);
}

function peekSequence(type, date, clientCode) {
  const counters = PSEStorage.loadCounters();
  const key = counterKey(type, date, clientCode);
  return (counters[key] || 0) + 1;
}

function commitSequence(type, date, clientCode) {
  const counters = PSEStorage.loadCounters();
  const key = counterKey(type, date, clientCode);
  const next = (counters[key] || 0) + 1;
  counters[key] = next;
  PSEStorage.saveCounters(counters);
  return next;
}

function buildDocNumber(type, date, clientCode, seq) {
  const fmt = getNumberFormat();
  const d = getDateParts(date);
  const code = sanitizeCode(clientCode);
  const builder = type === 'quotation' ? fmt.quo : fmt.inv;
  return builder(COMPANY.prefix, code, d, seq);
}

function peekDocNumber(type, date, clientCode) {
  return buildDocNumber(type, date, clientCode, peekSequence(type, date, clientCode));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount) {
  return amount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function escapeAttr(str) { return String(str).replace(/"/g, '&quot;'); }
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getLabels(docType) { return DOC_LABELS[docType] || DOC_LABELS.quotation; }

function calcSubtotal(items) {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
}

function calcTotals(items, sstEnabled) {
  const subtotal = calcSubtotal(items);
  const sst = sstEnabled ? subtotal * SST_RATE : 0;
  return { subtotal, sst, total: subtotal + sst };
}

function getFormData() {
  return {
    docType: state.docType,
    docNumber: $('docNumber').value.replace(/^\[DRAF\]\s*/, ''),
    docDate: $('docDate').value,
    dueDate: $('dueDate').value,
    sstEnabled: $('sstEnabled').checked,
    refQuotation: $('refQuotation').value,
    numberFormat: $('numberFormat').value,
    clientCode: $('clientCode').value,
    clientName: $('clientName').value.trim(),
    clientAttn: $('clientAttn').value.trim(),
    clientAddress: $('clientAddress').value.trim(),
    clientPhone: $('clientPhone').value.trim(),
    clientEmail: $('clientEmail').value.trim(),
    docSubject: $('docSubject').value.trim(),
    items: state.items.map(i => ({ ...i })),
    terms: [...state.terms]
  };
}

function isDocumentEmpty(data) {
  const hasClient = !!(data.clientName || data.clientAttn || data.clientAddress);
  const hasItems = data.items.some(i => i.desc?.trim());
  const hasSubject = !!data.docSubject;
  return !hasClient && !hasItems && !hasSubject;
}

function validateDocument(data) {
  const errors = [];
  if (!data.clientName) errors.push('Nama pelanggan diperlukan.');
  if (!data.docSubject) errors.push('Tajuk dokumen diperlukan.');
  if (!data.items.some(i => i.desc?.trim())) errors.push('Sekurang-kurangnya satu item diperlukan.');
  return errors;
}

function markDirty() {
  state.dirty = true;
  state.finalized = false;
  updateWorkflowUI();
  autoSaveDraft();
}

function getFormSnapshot() {
  const data = getFormData();
  const totals = calcTotals(data.items, data.sstEnabled);
  return { ...data, ...totals, mode: state.mode, editingVersion: state.editingVersion };
}

function autoSaveDraft() {
  PSEStorage.saveDraft({
    ...getFormSnapshot(),
    savedAt: new Date().toISOString(),
    lockedNumber: state.lockedNumber,
    finalized: false
  });
}

function updateDocNumberDisplay() {
  const date = new Date($('docDate').value + 'T00:00:00');
  const code = $('clientCode').value || 'GEN';

  if (state.lockedNumber && state.mode === 'edit') {
    $('docNumber').value = $('docNumber').dataset.committed || $('docNumber').value;
    $('docStatus').textContent = `Edit ${state.editingVersion ? 'v' + state.editingVersion : ''} — nombor dikunci`;
    $('docStatus').className = 'status-badge status-edit';
  } else if (state.finalized) {
    $('docNumber').value = $('docNumber').dataset.committed || $('docNumber').value;
    $('docStatus').textContent = 'Disahkan — boleh buat dokumen baru';
    $('docStatus').className = 'status-badge status-done';
  } else {
    const peek = peekDocNumber(state.docType, date, code);
    $('docNumber').value = `[DRAF] ${peek}`;
    $('docNumber').dataset.peek = peek;
    $('docStatus').textContent = 'Draf — nombor belum disahkan (sahkan dulu sebelum No. Baru)';
    $('docStatus').className = 'status-badge status-draft';
  }
  $('numberHint').textContent = getNumberFormat().hint;
}

function updateWorkflowUI() {
  const data = getFormData();
  const empty = isDocumentEmpty(data);
  const valid = validateDocument(data).length === 0;

  $('btnFinalize').disabled = !valid || state.finalized;
  $('btnNewDoc').disabled = !state.finalized;
  $('btnPrint').disabled = !state.finalized && !(state.mode === 'edit' && $('docNumber').dataset.committed);

  if (state.finalized) {
    $('btnNewDoc').title = 'Buka draf dokumen baru dengan nombor seterusnya';
  } else if (empty) {
    $('btnNewDoc').title = 'Isi & sahkan dokumen semasa dahulu';
  } else {
    $('btnNewDoc').title = 'Sahkan dokumen semasa (Simpan & Sahkan) sebelum buat nombor baru';
  }

  $('btnFinalize').title = valid
    ? (state.mode === 'edit' ? 'Simpan sebagai versi baru' : 'Sahkan & assign nombor rasmi')
    : 'Lengkapkan maklumat dokumen dahulu';

  updateDocNumberDisplay();
}

function loadClients() {
  try {
    const saved = PSEStorage.read(PSEStorage.KEYS.clients, null);
    return saved?.length ? saved : DEFAULT_CLIENTS.map(c => ({ ...c }));
  } catch { return DEFAULT_CLIENTS.map(c => ({ ...c })); }
}

function saveClients(clients) {
  PSEStorage.write(PSEStorage.KEYS.clients, clients);
}

function renderClientTemplates() {
  const select = $('clientTemplate');
  select.innerHTML = '<option value="">— Pilih pelanggan —</option>';
  loadClients().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.code})`;
    select.appendChild(opt);
  });
}

function applyClient(client) {
  if (!client) return;
  $('clientCode').value = client.code || '';
  $('clientName').value = client.clientName || '';
  $('clientAttn').value = client.clientAttn || '';
  $('clientAddress').value = client.clientAddress || '';
  $('clientPhone').value = client.clientPhone || '';
  $('clientEmail').value = client.clientEmail || '';
  markDirty();
  renderPreview();
}

function applyFormData(data, options = {}) {
  const { locked = false, version = null, finalized = false } = options;
  state.docType = data.docType || 'quotation';
  state.items = (data.items || DEFAULT_ITEMS).map(i => ({ ...i }));
  state.terms = [...(data.terms || DEFAULT_TERMS_QUO)];
  state.mode = locked ? 'edit' : 'new';
  state.lockedNumber = locked;
  state.editingVersion = version;
  state.finalized = finalized;
  state.dirty = false;

  document.querySelector(`input[name="docType"][value="${state.docType}"]`).checked = true;
  if (data.numberFormat) $('numberFormat').value = data.numberFormat;

  $('docNumber').value = data.docNumber || '';
  $('docNumber').dataset.committed = data.docNumber || '';
  $('docDate').value = (data.docDate || '').split('T')[0] || new Date().toISOString().split('T')[0];
  $('dueDate').value = (data.dueDate || '').split('T')[0] || addDays($('docDate').value, 7);
  $('sstEnabled').checked = !!data.sstEnabled;
  $('refQuotation').value = data.refQuotation || '';
  $('clientCode').value = data.clientCode || '';
  $('clientName').value = data.clientName || '';
  $('clientAttn').value = data.clientAttn || '';
  $('clientAddress').value = data.clientAddress || '';
  $('clientPhone').value = data.clientPhone || '';
  $('clientEmail').value = data.clientEmail || '';
  $('docSubject').value = data.docSubject || getLabels(state.docType).defaultSubject;

  updateDocTypeUI();
  renderTermsEditor();
  renderItemsEditor();
  updateWorkflowUI();
  renderPreview();
}

function renderItemsEditor() {
  const container = $('itemsEditor');
  container.innerHTML = `<div class="item-row item-row-head"><span>Item</span><span>Harga</span><span>Qty</span><span>Jumlah</span><span></span></div>`;
  state.items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    const sub = (Number(item.price) || 0) * (Number(item.qty) || 0);
    row.innerHTML = `
      <input class="item-desc" type="text" value="${escapeAttr(item.desc)}" data-idx="${idx}" data-field="desc">
      <input type="number" min="0" step="0.01" value="${item.price}" data-idx="${idx}" data-field="price">
      <input type="number" min="0" step="1" value="${item.qty}" data-idx="${idx}" data-field="qty">
      <input type="text" readonly value="${formatCurrency(sub)}" class="readonly-num">
      <button type="button" class="btn-remove" data-remove="${idx}">&times;</button>`;
    container.appendChild(row);
  });
  container.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('input', e => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      state.items[idx][field] = field === 'desc' ? e.target.value : Number(e.target.value);
      markDirty();
      renderItemsEditor();
      renderPreview();
    });
  });
  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.items.length > 1) {
        state.items.splice(Number(btn.dataset.remove), 1);
        markDirty();
        renderItemsEditor();
        renderPreview();
      }
    });
  });
}

function renderTermsEditor() {
  const container = $('termsEditor');
  container.innerHTML = '';
  state.terms.forEach((term, idx) => {
    const row = document.createElement('div');
    row.className = 'term-row';
    row.innerHTML = `<textarea data-term="${idx}" rows="2">${escapeHtml(term)}</textarea>
      <button type="button" class="btn-remove" data-remove-term="${idx}">&times;</button>`;
    container.appendChild(row);
  });
  container.querySelectorAll('[data-term]').forEach(ta => {
    ta.addEventListener('input', e => {
      state.terms[Number(e.target.dataset.term)] = e.target.value;
      markDirty();
      renderPreview();
    });
  });
  container.querySelectorAll('[data-remove-term]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.terms.splice(Number(btn.dataset.removeTerm), 1);
      markDirty();
      renderTermsEditor();
      renderPreview();
    });
  });
}

function renderPreview() {
  const data = getFormData();
  const L = getLabels(data.docType);
  const { subtotal, sst, total } = calcTotals(data.items, data.sstEnabled);
  const displayNumber = state.finalized || state.lockedNumber
    ? (data.docNumber || '—')
    : ($('docNumber').dataset.peek || data.docNumber);

  const versionBadge = state.mode === 'edit' && state.editingVersion
    ? `<span class="version-badge">Versi asas: v${state.editingVersion} → simpan = versi baru</span>` : '';

  const itemsRows = data.items.map((item, i) => {
    const sub = (Number(item.price) || 0) * (Number(item.qty) || 0);
    return `<tr><td class="num">${i + 1}</td><td>${escapeHtml(item.desc)}</td>
      <td class="amount">${formatCurrency(Number(item.price) || 0)}</td>
      <td class="num">${item.qty}</td><td class="amount">${formatCurrency(sub)}</td></tr>`;
  }).join('');

  const totalRows = data.sstEnabled ? `
    <tr><td colspan="4" class="total-label">${L.subtotal}</td><td class="amount">${formatCurrency(subtotal)}</td></tr>
    <tr><td colspan="4" class="total-label">${L.sst}</td><td class="amount">${formatCurrency(sst)}</td></tr>
    <tr><td colspan="4" class="total-label">${L.grandTotal}</td><td class="amount">${formatCurrency(total)}</td></tr>`
    : `<tr><td colspan="4" class="total-label">${L.total}</td><td class="amount">${formatCurrency(total)}</td></tr>`;

  const clientLines = [
    data.clientName,
    data.clientAttn ? `${L.attn}: ${data.clientAttn}` : '',
    data.clientAddress?.replace(/\n/g, '<br>'),
    data.clientPhone ? `${L.tel}: ${data.clientPhone}` : '',
    data.clientEmail ? `${L.email}: ${data.clientEmail}` : ''
  ].filter(Boolean).join('<br>');

  $('documentPreview').innerHTML = `
    ${versionBadge}
    <div class="doc-header">
      <div class="doc-header-left">
        <img src="assets/logo.png" alt="Logo" class="doc-logo" onerror="this.style.display='none'">
        <div class="doc-company">
          <h2>${COMPANY.name} ${COMPANY.regNo}</h2>
          ${COMPANY.address.map(l => `<p>${l}</p>`).join('')}
          <p>${COMPANY.email} | ${COMPANY.phone}</p>
        </div>
      </div>
      <div class="doc-header-right">
        <div class="doc-type-label">${L.type}</div>
        <div class="doc-ref"><strong>${L.refLabel}</strong> ${escapeHtml(displayNumber)}</div>
        ${data.docType === 'invoice' && data.refQuotation ? `<div class="doc-ref"><strong>${L.quoRefLabel}:</strong> ${escapeHtml(data.refQuotation)}</div>` : ''}
        <div class="doc-date"><strong>${L.dateLabel}:</strong> ${formatDate(data.docDate)}</div>
        ${data.docType === 'invoice' && data.dueDate ? `<div class="doc-date"><strong>${L.dueLabel}:</strong> ${formatDate(data.dueDate)}</div>` : ''}
      </div>
    </div>
    <div class="client-block">
      <div class="client-box"><div class="label">${L.clientLabel}</div><p>${clientLines || '<em>—</em>'}</p></div>
      <div class="client-box"><div class="label">${L.fromLabel}</div><p>
        <strong>${COMPANY.name}</strong><br>${COMPANY.address.join('<br>')}<br>${COMPANY.phone}<br>${COMPANY.email}</p></div>
    </div>
    <p class="doc-greeting">${L.greeting}</p>
    <div class="doc-subject">${escapeHtml(data.docSubject)}</div>
    <p class="section-title">${L.sectionTitle}</p>
    <table class="items-table"><thead><tr>${L.tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${itemsRows}</tbody><tfoot>${totalRows}</tfoot></table>
    ${data.terms.length ? `<div class="terms-block"><h3>${L.termsTitle}</h3><ol>${data.terms.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ol></div>` : ''}
    <div class="banking-block"><h3>${L.bankingTitle}</h3><p>
      ${L.payee}: <strong>${COMPANY.bank.payee}</strong><br>${L.bank}: <strong>${COMPANY.bank.bankName}</strong><br>
      ${L.account}: <strong>${COMPANY.bank.accountNo}</strong><br>
      <em>${L.paymentRef}: ${escapeHtml(displayNumber)}</em></p></div>
    <div class="doc-footer"><strong>${COMPANY.name}</strong> ${COMPANY.regNo}<br>
      ${COMPANY.address.join(', ')} | Tel: ${COMPANY.phone}</div>`;
}

function updateDocTypeUI() {
  const isQuo = state.docType === 'quotation';
  $('refQuoRow').style.display = isQuo ? 'none' : 'block';
  $('dueDateRow').style.display = isQuo ? 'none' : 'block';
  $('btnConvertInvoice').style.display = isQuo && state.finalized ? 'inline-block' : (isQuo ? 'inline-block' : 'none');
}

function switchDocType(type) {
  if (state.lockedNumber) {
    alert('Nombor dokumen dikunci semasa edit. Buka dokumen baru untuk tukar jenis.');
    document.querySelector(`input[name="docType"][value="${state.docType}"]`).checked = true;
    return;
  }
  state.docType = type;
  state.terms = type === 'quotation' ? [...DEFAULT_TERMS_QUO] : [...DEFAULT_TERMS_INV];
  const L = getLabels(type);
  const subject = $('docSubject').value;
  if (type === 'invoice') {
    $('docSubject').value = subject.match(/^SEBUTHARGA/i) ? subject.replace(/^SEBUTHARGA/i, 'INVOIS') : L.defaultSubject;
    if (!$('dueDate').value) $('dueDate').value = addDays($('docDate').value, 7);
  } else {
    $('docSubject').value = subject.match(/^INVOIS/i) ? subject.replace(/^INVOIS/i, 'SEBUTHARGA') : L.defaultSubject;
  }
  markDirty();
  updateDocTypeUI();
  renderTermsEditor();
  updateWorkflowUI();
  renderPreview();
}

async function finalizeDocument() {
  const data = getFormData();
  const errors = validateDocument(data);
  if (errors.length) {
    alert('Tidak boleh sahkan:\n\n• ' + errors.join('\n• '));
    return;
  }

  let docNumber = ($('docNumber').dataset.committed || data.docNumber).replace(/^\[DRAF\]\s*/, '');
  const date = new Date(data.docDate + 'T00:00:00');

  if (state.mode === 'new') {
    const seq = commitSequence(state.docType, date, data.clientCode);
    docNumber = buildDocNumber(state.docType, date, data.clientCode, seq);
  }

  const snapshot = { ...getFormSnapshot(), docNumber };
  const version = PSEStorage.saveVersion(docNumber, snapshot);

  $('docNumber').value = docNumber;
  $('docNumber').dataset.committed = docNumber;
  state.finalized = true;
  state.dirty = false;
  state.editingVersion = version;
  state.mode = 'edit';
  state.lockedNumber = true;
  state.selectedFolder = docNumber;

  PSEStorage.clearDraft();
  await PSESync.onDocumentFinalized(docNumber, version, snapshot);
  renderDocumentLibrary();
  renderVersionPanel(docNumber);
  updateWorkflowUI();
  renderPreview();
  PSESync.renderDashboard();

  const drivePath = PSESync.getDrivePath(snapshot.docType, docNumber);
  alert(`Dokumen disahkan!\n\n${docNumber} — v${version}\n\nFolder Drive: ${drivePath}/\n\nTekan "Dokumen Baru" untuk seterusnya.`);

  if (PSEConfig.features.autoPdfOnFinalize) {
    if (confirm('Buka dialog cetak PDF sekarang?')) {
      PSESync.triggerAutoPrint();
    }
  }
}

function startNewDocument(force = false) {
  if (!force && !state.finalized) {
    if (!isDocumentEmpty(getFormData())) {
      alert('Dokumen semasa belum disahkan.\n\nSila klik "Simpan & Sahkan" dahulu sebelum buat dokumen baru.\n\nNombor hanya akan digunakan selepas disahkan — elak nombor terbuang.');
      return;
    }
    if (!confirm('Draf kosong akan dibuang. Teruskan dokumen baru?')) return;
  }

  PSEStorage.clearDraft();
  state.mode = 'new';
  state.lockedNumber = false;
  state.finalized = false;
  state.dirty = false;
  state.editingVersion = null;
  state.selectedFolder = null;
  state.docType = 'quotation';
  state.items = DEFAULT_ITEMS.map(i => ({ ...i }));
  state.terms = [...DEFAULT_TERMS_QUO];

  document.querySelector('input[name="docType"][value="quotation"]').checked = true;
  $('docSubject').value = DOC_LABELS.quotation.defaultSubject;
  $('refQuotation').value = '';
  $('sstEnabled').checked = false;
  $('clientName').value = '';
  $('clientAttn').value = '';
  $('clientAddress').value = '';
  $('clientPhone').value = '';
  $('clientEmail').value = '';
  $('clientCode').value = '';
  $('docDate').value = new Date().toISOString().split('T')[0];
  $('dueDate').value = addDays($('docDate').value, 7);
  $('docNumber').dataset.committed = '';

  renderVersionPanel(null);
  updateDocTypeUI();
  renderTermsEditor();
  renderItemsEditor();
  updateWorkflowUI();
  renderPreview();
  renderDocumentLibrary();
}

function openDocumentForEdit(docNumber, version = null) {
  const snap = PSEStorage.getVersion(docNumber, version);
  if (!snap) return alert('Dokumen tidak dijumpai.');

  if (!state.finalized && !isDocumentEmpty(getFormData())) {
    if (!confirm('Draf semasa belum disahkan. Buang dan buka dokumen lama?')) return;
  }

  state.selectedFolder = docNumber;
  applyFormData(snap, { locked: true, version: snap.version, finalized: false });
  state.dirty = false;
  renderVersionPanel(docNumber);
  renderDocumentLibrary();
}

function renderDocumentLibrary() {
  const list = $('docLibrary');
  const filter = $('libraryFilter')?.value || 'all';
  let docs = PSEStorage.listDocuments(filter === 'all' ? null : filter);

  if (!docs.length) {
    list.innerHTML = '<p class="hint">Tiada dokumen disimpan. Sahkan dokumen pertama anda.</p>';
    return;
  }

  list.innerHTML = docs.map(d => `
    <div class="folder-item ${state.selectedFolder === d.docNumber ? 'active' : ''}" data-doc="${escapeAttr(d.docNumber)}">
      <div class="folder-icon">📁</div>
      <div class="folder-info">
        <strong>${escapeHtml(d.docNumber)}</strong>
        <span>${d.type === 'quotation' ? 'Sebutharga' : 'Invois'} · ${escapeHtml(d.clientName || '—')}</span>
        <span class="folder-meta">${d.latestVersion} versi · RM ${formatCurrency(d.total)} · ${formatDateTime(d.updatedAt)}</span>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-doc]').forEach(el => {
    el.addEventListener('click', () => openDocumentForEdit(el.dataset.doc));
  });
}

function renderVersionPanel(docNumber) {
  const panel = $('versionPanel');
  if (!docNumber) {
    panel.innerHTML = '<p class="hint">Pilih folder dokumen untuk lihat sejarah versi.</p>';
    return;
  }

  const versions = PSEStorage.getVersionList(docNumber);
  panel.innerHTML = `
    <p class="version-folder-title">📁 ${escapeHtml(docNumber)}</p>
    ${versions.map(v => `
      <div class="version-item ${v.version === state.editingVersion ? 'active' : ''}" data-doc="${escapeAttr(docNumber)}" data-ver="${v.version}">
        <strong>v${v.version}</strong>
        <span>${formatDateTime(v.savedAt)}</span>
        <span>RM ${formatCurrency(v.total)} · ${formatDate(v.docDate)}</span>
      </div>`).join('')}
    <p class="hint" style="margin-top:0.5rem">Edit & sahkan = versi baru (v${versions.length + 1})</p>`;

  panel.querySelectorAll('.version-item').forEach(el => {
    el.addEventListener('click', () => openDocumentForEdit(el.dataset.doc, Number(el.dataset.ver)));
  });
}

function convertToInvoice() {
  const quoNumber = $('docNumber').dataset.committed || getFormData().docNumber;
  if (!quoNumber || quoNumber.startsWith('[DRAF]')) {
    alert('Sahkan sebutharga dahulu sebelum tukar invois.');
    return;
  }
  if (!confirm(`Buat invois baru berdasarkan ${quoNumber}?`)) return;

  const data = getFormData();
  startNewDocument(true);
  state.docType = 'invoice';
  document.querySelector('input[name="docType"][value="invoice"]').checked = true;
  state.items = data.items.map(i => ({ ...i }));
  state.terms = [...DEFAULT_TERMS_INV];
  $('refQuotation').value = quoNumber;
  $('clientCode').value = data.clientCode;
  $('clientName').value = data.clientName;
  $('clientAttn').value = data.clientAttn;
  $('clientAddress').value = data.clientAddress;
  $('clientPhone').value = data.clientPhone;
  $('clientEmail').value = data.clientEmail;
  $('docSubject').value = DOC_LABELS.invoice.defaultSubject;
  renderTermsEditor();
  renderItemsEditor();
  markDirty();
  updateDocTypeUI();
  updateWorkflowUI();
  renderPreview();
}

function handlePrint() {
  if (!state.finalized && !(state.mode === 'edit' && $('docNumber').dataset.committed)) {
    alert('Sahkan dokumen dahulu sebelum cetak.');
    return;
  }
  renderPreview();
  window.print();
}

function resetCountersOnly() {
  if (!confirm('Reset counter nombor sebutharga & invois ke 0?\n\nDokumen sedia ada TIDAK dipadam.\nNombor seterusnya akan bermula semula (cth: 0001).')) return;
  PSEStorage.resetCounters();
  if (state.mode === 'new' && !state.finalized) updateWorkflowUI();
  alert('Counter nombor telah direset.');
}

function exportBackup() { PSEStorage.downloadBackup(); }

function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      PSEStorage.importBackup(JSON.parse(e.target.result));
      renderDocumentLibrary();
      alert('Backup berjaya diimport.');
    } catch (err) {
      alert('Import gagal: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function saveCurrentClient() {
  const name = prompt('Nama ringkas pelanggan:');
  if (!name?.trim()) return;
  const clients = loadClients();
  const code = sanitizeCode($('clientCode').value || name);
  const existing = clients.find(c => c.code === code);
  const payload = {
    id: existing?.id || `client_${Date.now()}`, name: name.trim(), code,
    clientName: $('clientName').value, clientAttn: $('clientAttn').value,
    clientAddress: $('clientAddress').value, clientPhone: $('clientPhone').value,
    clientEmail: $('clientEmail').value
  };
  if (existing) Object.assign(existing, payload); else clients.push(payload);
  saveClients(clients);
  renderClientTemplates();
  $('clientTemplate').value = payload.id;
}

function bindEvents() {
  document.querySelectorAll('input[name="docType"]').forEach(r => {
    r.addEventListener('change', e => switchDocType(e.target.value));
  });

  $('numberFormat').addEventListener('change', () => {
    PSEStorage.saveSettings({ ...PSEStorage.loadSettings(), numberFormat: $('numberFormat').value });
    if (!state.lockedNumber) updateWorkflowUI();
    renderPreview();
  });

  ['docDate', 'clientCode', 'clientName', 'clientAttn', 'clientAddress',
    'clientPhone', 'clientEmail', 'docSubject', 'dueDate', 'refQuotation'].forEach(id => {
    $(id).addEventListener('input', () => {
      if (id === 'docDate' && state.docType === 'invoice' && !state.lockedNumber) {
        $('dueDate').value = addDays($('docDate').value, 7);
      }
      markDirty();
      renderPreview();
    });
  });

  $('sstEnabled').addEventListener('change', () => { markDirty(); renderPreview(); });
  $('libraryFilter')?.addEventListener('change', renderDocumentLibrary);
  $('clientTemplate').addEventListener('change', e => applyClient(loadClients().find(c => c.id === e.target.value)));
  $('btnSaveClient').addEventListener('click', saveCurrentClient);
  $('btnDeleteClient').addEventListener('click', () => {
    const id = $('clientTemplate').value;
    if (id && confirm('Padam template pelanggan?')) {
      saveClients(loadClients().filter(c => c.id !== id));
      renderClientTemplates();
    }
  });

  $('btnFinalize').addEventListener('click', finalizeDocument);
  $('btnNewDoc').addEventListener('click', () => startNewDocument(false));
  $('btnPrint').addEventListener('click', handlePrint);
  $('btnConvertInvoice').addEventListener('click', convertToInvoice);
  $('btnAddItem').addEventListener('click', () => {
    state.items.push({ desc: '', price: 0, qty: 1 });
    markDirty();
    renderItemsEditor();
    renderPreview();
  });
  $('btnResetCounters').addEventListener('click', resetCountersOnly);
  $('btnExportBackup').addEventListener('click', exportBackup);
  $('btnExportZipAll').addEventListener('click', () => PSESync.exportAllFoldersZip());
  $('btnExportZipFolder').addEventListener('click', () => {
    const doc = $('docNumber').dataset.committed || state.selectedFolder;
    if (!doc) return alert('Pilih atau sahkan dokumen dahulu.');
    PSESync.exportFolderZip(doc);
  });
  $('autoPdfToggle').addEventListener('change', e => {
    PSEConfig.features.autoPdfOnFinalize = e.target.checked;
  });
  $('importBackupFile').addEventListener('change', e => {
    if (e.target.files[0]) importBackupFile(e.target.files[0]);
    e.target.value = '';
  });
}

function init() {
  const settings = PSEStorage.loadSettings();
  if (!settings.migrated_v2) {
    PSEStorage.resetCounters();
    PSEStorage.saveSettings({ ...settings, migrated_v2: true, numberFormat: settings.numberFormat || 'standard' });
  }
  $('numberFormat').value = PSEStorage.loadSettings().numberFormat || 'standard';

  renderClientTemplates();
  const draft = PSEStorage.loadDraft();
  if (draft && !draft.finalized) {
    applyFormData(draft, { locked: draft.lockedNumber, version: draft.editingVersion, finalized: false });
  } else {
    startNewDocument(true);
  }

  bindEvents();
  renderDocumentLibrary();
  PSESync.renderDashboard();

  if (PSEConfig.features.weeklyBackupReminder) {
    const last = PSEStorage.loadSettings().lastBackupReminder;
    const week = 7 * 24 * 60 * 60 * 1000;
    if (!last || Date.now() - new Date(last).getTime() > week) {
      setTimeout(() => {
        if (confirm('Reminder: Sudah seminggu? Export backup ke Google Drive?\n\n(Tekan OK untuk export ZIP sekarang)')) {
          PSESync.exportAllFoldersZip();
          PSEStorage.saveSettings({ ...PSEStorage.loadSettings(), lastBackupReminder: new Date().toISOString() });
        }
      }, 2000);
    }
  }
}

init();
