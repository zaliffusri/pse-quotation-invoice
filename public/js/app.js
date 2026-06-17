const DEFAULT_ITEMS = [
  { desc: 'Pakej Lengkap Mesin Slushy', price: 3200, qty: 1 },
  { desc: 'Pemegang Cawan', price: 30, qty: 1 },
  { desc: 'Sokongan Teknikal (6 Bulan)', price: 0, qty: 1 }
];

const TERMS_QUO = [
  'Hak Milik Sementara: Mesin kekal Hak Milik Pembekal sehingga pembayaran penuh.',
  'Bayaran dalam tempoh 7 hari pada awal setiap bulan.',
  'Tempoh maksimum bayaran bulanan 12 bulan.',
  'Kegagalan bayaran melebihi 30 hari — pembekal berhak ambil semula mesin.',
  'Bayaran ke Maybank 551584078633 atas nama Pillar Stride Enterprise.'
];

const TERMS_INV = [
  'Bayaran sebelum tarikh akhir bayar.',
  'Sertakan nombor invois sebagai rujukan bayaran.',
  'Invois sah tanpa tandatangan (sistem digital).'
];

const App = {
  company: null,
  clients: [],
  state: {
    docType: 'quotation',
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    terms: [...TERMS_QUO],
    mode: 'new',
    finalized: false,
    lockedNumber: null,
    editingVersion: null
  },

  async init() {
    const auth = await fetch('/api/auth/check', { credentials: 'include' }).then(r => r.json());
    if (!auth.authenticated) return location.href = '/login.html';

    document.getElementById('userName').textContent = auth.user.name;
    const me = await API.get('/me');
    this.company = me.company;
    document.getElementById('numberFormat').value = me.numberFormat || 'standard';

    this.bindNav();
    this.bindEditor();
    this.bindSettings();
    document.getElementById('btnLogout').onclick = async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      location.href = '/login.html';
    };

    await this.loadClients();
    this.goEditor(true);
    await this.loadDashboard();
  },

  bindNav() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + btn.dataset.view).classList.add('active');
        if (btn.dataset.view === 'dashboard') this.loadDashboard();
        if (btn.dataset.view === 'archive') this.loadArchive();
        if (btn.dataset.view === 'clients') this.renderClients();
      };
    });
  },

  goEditor(fresh = false) {
    document.querySelector('[data-view="editor"]').click();
    if (fresh) this.resetEditor();
  },

  bindEditor() {
    document.querySelectorAll('input[name="docType"]').forEach(r => {
      r.onchange = () => {
        if (this.state.lockedNumber) { r.checked = this.state.docType === r.value; return alert('Nombor dikunci semasa edit.'); }
        this.state.docType = r.value;
        this.state.terms = r.value === 'quotation' ? [...TERMS_QUO] : [...TERMS_INV];
        $('docSubject').value = r.value === 'quotation'
          ? 'SEBUTHARGA PEMBEKALAN PAKEJ LENGKAP MESIN SLUSHY'
          : 'INVOIS PEMBEKALAN PAKEJ LENGKAP MESIN SLUSHY';
        $('refQuoWrap').hidden = r.value !== 'invoice';
        $('dueWrap').hidden = r.value !== 'invoice';
        $('btnConvertInv').style.display = r.value === 'quotation' ? 'inline-block' : 'none';
        this.renderTerms();
        this.refreshPeek();
        this.renderPreview();
      };
    });

    ['docDate', 'clientCode', 'clientName', 'clientAttn', 'clientAddress', 'clientPhone', 'clientEmail', 'docSubject', 'dueDate', 'refQuotation'].forEach(id => {
      $(id).oninput = () => { this.state.finalized = false; this.updateButtons(); this.renderPreview(); if (id === 'docDate' || id === 'clientCode') this.refreshPeek(); };
    });
    $('sstEnabled').onchange = () => this.renderPreview();
    $('clientPick').onchange = () => this.applyClient($('clientPick').value);
    $('btnAddItem').onclick = () => { this.state.items.push({ desc: '', price: 0, qty: 1 }); this.renderItems(); this.renderPreview(); };
    $('btnFinalize').onclick = () => this.finalize();
    $('btnNewDoc').onclick = () => this.resetEditor();
    $('btnPrint').onclick = () => window.print();
    $('btnConvertInv').onclick = () => this.convertInvoice();
    $('archiveFilter').onchange = () => this.loadArchive();
  },

  bindSettings() {
    $('numberFormat').onchange = async () => {
      await API.put('/settings', { numberFormat: $('numberFormat').value });
      this.refreshPeek();
    };
    $('btnExport').onclick = () => window.open('/api/backup/export', '_blank');
    $('importFile').onchange = async e => {
      const text = await e.target.files[0].text();
      await API.post('/backup/import', JSON.parse(text));
      alert('Backup diimport.');
      this.loadDashboard();
    };
    $('btnResetCounter').onclick = async () => {
      if (!confirm('Reset counter nombor ke 0? Dokumen sedia ada kekal.')) return;
      await API.post('/counters/reset', { confirm: true });
      alert('Counter direset.');
    };
    $('btnAddClient').onclick = () => this.promptClient();
  },

  async loadClients() {
    this.clients = await API.get('/clients');
    const sel = $('clientPick');
    sel.innerHTML = '<option value="">— Pilih —</option>';
    this.clients.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.name} (${c.code})`;
      sel.appendChild(o);
    });
  },

  applyClient(id) {
    const c = this.clients.find(x => x.id === id);
    if (!c) return;
    $('clientCode').value = c.code;
    $('clientName').value = c.client_name || '';
    $('clientAttn').value = c.client_attn || '';
    $('clientAddress').value = c.client_address || '';
    $('clientPhone').value = c.client_phone || '';
    $('clientEmail').value = c.client_email || '';
    this.refreshPeek();
    this.renderPreview();
  },

  resetEditor() {
    if (!this.state.finalized && $('clientName').value.trim()) {
      if (!confirm('Draf belum disahkan. Buang dan mula baru?')) return;
    }
    this.state = { docType: 'quotation', items: DEFAULT_ITEMS.map(i => ({ ...i })), terms: [...TERMS_QUO], mode: 'new', finalized: false, lockedNumber: null, editingVersion: null };
    document.querySelector('input[name="docType"][value="quotation"]').checked = true;
    $('docSubject').value = 'SEBUTHARGA PEMBEKALAN PAKEJ LENGKAP MESIN SLUSHY';
    $('refQuotation').value = '';
    $('sstEnabled').checked = false;
    $('clientName').value = $('clientAttn').value = $('clientAddress').value = '';
    $('clientPhone').value = $('clientEmail').value = $('clientCode').value = '';
    $('docDate').value = today();
    $('dueDate').value = addDays(today(), 7);
    $('refQuoWrap').hidden = true;
    $('dueWrap').hidden = true;
    $('editorTitle').textContent = 'Dokumen Baru';
    this.renderItems();
    this.renderTerms();
    this.refreshPeek();
    this.updateButtons();
    this.renderPreview();
  },

  async refreshPeek() {
    if (this.state.lockedNumber) return;
    const data = await API.get(`/number/peek?type=${this.state.docType}&date=${$('docDate').value}&clientCode=${$('clientCode').value || 'GEN'}`);
    $('docNumber').value = `[DRAF] ${data.number}`;
    $('docNumber').dataset.peek = data.number;
  },

  getSnapshot() {
    const items = this.state.items;
    const sub = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    const sstOn = $('sstEnabled').checked;
    const sst = sstOn ? sub * 0.08 : 0;
    return {
      docType: this.state.docType,
      mode: this.state.mode,
      docNumber: this.state.lockedNumber || $('docNumber').dataset.peek || $('docNumber').value.replace('[DRAF] ', ''),
      docDate: $('docDate').value,
      dueDate: $('dueDate').value,
      sstEnabled: sstOn,
      refQuotation: $('refQuotation').value,
      clientCode: $('clientCode').value,
      clientName: $('clientName').value.trim(),
      clientAttn: $('clientAttn').value,
      clientAddress: $('clientAddress').value,
      clientPhone: $('clientPhone').value,
      clientEmail: $('clientEmail').value,
      docSubject: $('docSubject').value.trim(),
      items, terms: this.state.terms, subtotal: sub, sst, total: sub + sst
    };
  },

  async finalize() {
    const snap = this.getSnapshot();
    if (!snap.clientName || !snap.docSubject || !snap.items.some(i => i.desc?.trim())) {
      return alert('Lengkapkan: nama pelanggan, tajuk, dan sekurang-kurangnya satu item.');
    }
    if (this.state.lockedNumber) snap.docNumber = this.state.lockedNumber;

    try {
      const res = await API.post('/documents/finalize', snap);
      this.state.finalized = true;
      this.state.lockedNumber = res.docNumber;
      this.state.mode = 'edit';
      this.state.editingVersion = res.version;
      $('docNumber').value = res.docNumber;
      $('editorTitle').textContent = res.docNumber;
      this.updateButtons();
      this.renderPreview();
      alert(`✅ Disahkan!\n\n${res.docNumber} — v${res.version}\nJumlah: RM ${fmt(res.total)}\n\nFolder: PSE-Dokumen/${res.drivePath}/`);
      if (confirm('Cetak PDF sekarang?')) window.print();
    } catch (e) { alert(e.message); }
  },

  convertInvoice() {
    const num = this.state.lockedNumber || $('docNumber').value;
    if (!this.state.finalized && !num.startsWith('PSE')) return alert('Sahkan sebutharga dahulu.');
    const snap = this.getSnapshot();
    this.resetEditor();
    this.state.docType = 'invoice';
    document.querySelector('input[name="docType"][value="invoice"]').checked = true;
    this.state.items = snap.items.map(i => ({ ...i }));
    this.state.terms = [...TERMS_INV];
    $('refQuotation').value = num.replace('[DRAF] ', '');
    $('clientCode').value = snap.clientCode;
    $('clientName').value = snap.clientName;
    $('clientAttn').value = snap.clientAttn;
    $('clientAddress').value = snap.clientAddress;
    $('clientPhone').value = snap.clientPhone;
    $('clientEmail').value = snap.clientEmail;
    $('docSubject').value = 'INVOIS PEMBEKALAN PAKEJ LENGKAP MESIN SLUSHY';
    $('refQuoWrap').hidden = false;
    $('dueWrap').hidden = false;
    this.renderItems();
    this.renderTerms();
    this.refreshPeek();
    this.renderPreview();
  },

  updateButtons() {
    const valid = $('clientName').value.trim() && $('docSubject').value.trim() && this.state.items.some(i => i.desc?.trim());
    $('btnFinalize').disabled = !valid;
    $('btnNewDoc').disabled = !this.state.finalized;
    $('btnPrint').disabled = !this.state.finalized && !this.state.lockedNumber;
    const badge = $('docStatusBadge');
    if (this.state.finalized) { badge.textContent = 'DISAHKAN'; badge.className = 'badge badge-done'; }
    else if (this.state.lockedNumber) { badge.textContent = 'EDIT'; badge.className = 'badge badge-edit'; }
    else { badge.textContent = 'DRAF'; badge.className = 'badge badge-draft'; }
  },

  renderItems() {
    $('itemsList').innerHTML = this.state.items.map((item, i) => `
      <div class="item-row">
        <input value="${esc(item.desc)}" data-i="${i}" data-f="desc" placeholder="Item">
        <input type="number" value="${item.price}" data-i="${i}" data-f="price" style="width:70px">
        <input type="number" value="${item.qty}" data-i="${i}" data-f="qty" style="width:50px">
        <button data-rm="${i}">×</button>
      </div>`).join('');
    $('itemsList').querySelectorAll('input').forEach(inp => {
      inp.oninput = () => {
        const i = +inp.dataset.i;
        this.state.items[i][inp.dataset.f] = inp.dataset.f === 'desc' ? inp.value : +inp.value;
        this.state.finalized = false;
        this.updateButtons();
        this.renderPreview();
      };
    });
    $('itemsList').querySelectorAll('[data-rm]').forEach(btn => {
      btn.onclick = () => { if (this.state.items.length > 1) { this.state.items.splice(+btn.dataset.rm, 1); this.renderItems(); this.renderPreview(); } };
    });
  },

  renderTerms() {
    $('termsList').innerHTML = this.state.terms.map((t, i) =>
      `<textarea data-ti="${i}" rows="2">${esc(t)}</textarea>`).join('');
    $('termsList').querySelectorAll('textarea').forEach(ta => {
      ta.oninput = () => { this.state.terms[+ta.dataset.ti] = ta.value; this.renderPreview(); };
    });
  },

  renderPreview() {
    const s = this.getSnapshot();
    const L = s.docType === 'quotation';
    const num = this.state.finalized || this.state.lockedNumber ? (this.state.lockedNumber || s.docNumber) : ($('docNumber').dataset.peek || s.docNumber);
    const co = this.company || {};
    const rows = s.items.map((it, i) => `<tr><td>${i+1}</td><td>${esc(it.desc)}</td><td class="r">${fmt(it.price)}</td><td class="c">${it.qty}</td><td class="r">${fmt(it.price*it.qty)}</td></tr>`).join('');
    const totals = s.sstEnabled
      ? `<tr><td colspan="4" class="r"><b>Subjumlah</b></td><td class="r">${fmt(s.subtotal)}</td></tr>
         <tr><td colspan="4" class="r">SST 8%</td><td class="r">${fmt(s.sst)}</td></tr>
         <tr><td colspan="4" class="r"><b>Jumlah</b></td><td class="r">${fmt(s.total)}</td></tr>`
      : `<tr><td colspan="4" class="r"><b>Jumlah (RM)</b></td><td class="r">${fmt(s.total)}</td></tr>`;

    $('docPreview').innerHTML = `
      <div class="pv-header">
        <div><img src="/assets/logo.png" height="40" onerror="this.remove()"><br>
          <strong>${co.name||''}</strong> ${co.regNo||''}<br>
          ${(co.address||[]).join('<br>')}<br>${co.email} | ${co.phone}</div>
        <div class="pv-right">
          <div class="pv-type">${L?'SEBUTHARGA':'INVOIS'}</div>
          <div><b>${L?'Ruj.':'No.'}</b> ${esc(num)}</div>
          ${!L && s.refQuotation ? `<div><b>Ruj. SQ:</b> ${esc(s.refQuotation)}</div>` : ''}
          <div><b>Tarikh:</b> ${fd(s.docDate)}</div>
          ${!L && s.dueDate ? `<div><b>Akhir Bayar:</b> ${fd(s.dueDate)}</div>` : ''}
        </div>
      </div>
      <p>Tuan/Puan,</p>
      <p class="pv-subject">${esc(s.docSubject)}</p>
      <table class="pv-table"><thead><tr><th>No</th><th>Item</th><th>Harga</th><th>Qty</th><th>Jumlah</th></tr></thead>
      <tbody>${rows}</tbody><tfoot>${totals}</tfoot></table>
      <div class="pv-terms"><b>Terma & Syarat</b><ol>${s.terms.map(t=>`<li>${esc(t)}</li>`).join('')}</ol></div>
      <div class="pv-bank"><b>Maklumat Pembayaran</b><br>
        ${co.bank?.payee} | ${co.bank?.bankName} | ${co.bank?.accountNo}<br>
        <em>Rujukan: ${esc(num)}</em></div>`;
    this.updateButtons();
  },

  async loadDashboard() {
    const d = await API.get('/dashboard');
    $('statsGrid').innerHTML = `
      <div class="stat-card"><span>${d.total}</span><label>Jumlah Dokumen</label></div>
      <div class="stat-card"><span>${d.quotations}</span><label>Sebutharga</label></div>
      <div class="stat-card"><span>${d.invoices}</span><label>Invois</label></div>
      <div class="stat-card"><span>RM ${fmt(d.totalValue)}</span><label>Nilai Keseluruhan</label></div>`;
    $('recentDocs').innerHTML = d.recent.length ? d.recent.map(doc => `
      <div class="list-row clickable" onclick="App.openDoc('${esc(doc.doc_number)}')">
        <strong>${esc(doc.doc_number)}</strong>
        <span>${doc.doc_type==='quotation'?'SQ':'INV'} · ${esc(doc.client_name||'—')} · RM ${fmt(doc.total)}</span>
      </div>`).join('') : '<p class="hint">Tiada dokumen lagi.</p>';
    $('activityLog').innerHTML = d.activity.map(a => `
      <div class="list-row"><span>${a.action}</span><small>${a.doc_number||''} · ${new Date(a.created_at).toLocaleString('ms-MY')}</small></div>`).join('') || '<p class="hint">Tiada aktiviti.</p>';
  },

  async loadArchive() {
    const type = $('archiveFilter').value;
    const docs = await API.get('/documents' + (type !== 'all' ? '?type=' + type : ''));
    $('archiveList').innerHTML = docs.length ? docs.map(d => `
      <div class="folder-row" onclick="App.showVersions('${esc(d.doc_number)}')">
        📁 <strong>${esc(d.doc_number)}</strong>
        <small>${d.doc_type==='quotation'?'Sebutharga':'Invois'} · v${d.latest_version} · RM ${fmt(d.total)} · ${esc(d.client_name||'')}</small>
      </div>`).join('') : '<p class="hint">Tiada dokumen.</p>';
  },

  async showVersions(docNumber) {
    const doc = await API.get('/documents/' + encodeURIComponent(docNumber));
    $('archiveVersions').innerHTML = `
      <h3>📁 ${esc(docNumber)}</h3>
      ${doc.versions.map(v => `
        <div class="version-row" onclick="App.openDoc('${esc(docNumber)}', ${v.version})">
          <strong>v${v.version}</strong> · ${fd(v.doc_date)} · RM ${fmt(v.total)} · ${new Date(v.saved_at).toLocaleString('ms-MY')}
        </div>`).join('')}
      <p class="hint">Klik versi untuk buka & edit (simpan = versi baru)</p>`;
  },

  async openDoc(docNumber, version = null) {
    const path = version
      ? `/documents/${encodeURIComponent(docNumber)}/versions/${version}`
      : null;
    let snap;
    if (path) snap = await API.get(path);
    else {
      const doc = await API.get('/documents/' + encodeURIComponent(docNumber));
      snap = await API.get(`/documents/${encodeURIComponent(docNumber)}/versions/${doc.latest_version}`);
    }
    this.goEditor(false);
    this.state.docType = snap.docType;
    this.state.items = snap.items.map(i => ({ ...i }));
    this.state.terms = [...snap.terms];
    this.state.mode = 'edit';
    this.state.lockedNumber = snap.docNumber;
    this.state.editingVersion = snap.version;
    this.state.finalized = false;
    document.querySelector(`input[name="docType"][value="${snap.docType}"]`).checked = true;
    $('docNumber').value = snap.docNumber;
    $('editorTitle').textContent = snap.docNumber + ' (v' + snap.version + ')';
    $('docDate').value = snap.docDate?.split('T')[0] || snap.docDate;
    $('dueDate').value = snap.dueDate?.split('T')[0] || '';
    $('sstEnabled').checked = !!snap.sstEnabled;
    $('refQuotation').value = snap.refQuotation || '';
    $('clientCode').value = snap.clientCode || '';
    $('clientName').value = snap.clientName || '';
    $('clientAttn').value = snap.clientAttn || '';
    $('clientAddress').value = snap.clientAddress || '';
    $('clientPhone').value = snap.clientPhone || '';
    $('clientEmail').value = snap.clientEmail || '';
    $('docSubject').value = snap.docSubject || '';
    $('refQuoWrap').hidden = snap.docType !== 'invoice';
    $('dueWrap').hidden = snap.docType !== 'invoice';
    this.renderItems();
    this.renderTerms();
    this.updateButtons();
    this.renderPreview();
  },

  renderClients() {
    $('clientsList').innerHTML = this.clients.map(c => `
      <div class="list-row">
        <strong>${esc(c.name)} (${esc(c.code)})</strong>
        <span>${esc(c.client_email||'')} · ${esc(c.client_phone||'')}</span>
        <button class="btn btn-small" onclick="App.editClient('${c.id}')">Edit</button>
        <button class="btn btn-small btn-danger" onclick="App.deleteClient('${c.id}')">Padam</button>
      </div>`).join('') || '<p class="hint">Tiada pelanggan.</p>';
  },

  promptClient(existing = null) {
    const c = existing || {};
    const name = prompt('Nama ringkas:', c.name || '');
    if (!name) return;
    const code = prompt('Kod:', c.code || name.slice(0, 8).toUpperCase());
    API.post('/clients', {
      id: c.id, code, name,
      client_name: prompt('Nama penuh:', c.client_name || name),
      client_attn: prompt('Perhatian:', c.client_attn || ''),
      client_address: prompt('Alamat:', c.client_address || ''),
      client_phone: prompt('Telefon:', c.client_phone || ''),
      client_email: prompt('E-mel:', c.client_email || '')
    }).then(() => { this.loadClients(); this.renderClients(); });
  },

  editClient(id) { this.promptClient(this.clients.find(c => c.id === id)); },
  async deleteClient(id) {
    if (!confirm('Padam pelanggan?')) return;
    await API.delete('/clients/' + id);
    await this.loadClients();
    this.renderClients();
  }
};

function $(id) { return document.getElementById(id); }
function fmt(n) { return Number(n||0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fd(d) { return d ? new Date(d+'T00:00:00').toLocaleDateString('ms-MY', { day:'numeric', month:'short', year:'numeric' }) : '—'; }
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d+'T00:00:00'); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

App.init();
