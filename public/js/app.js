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

const TERMS_RECEIPT = [
  'Resit ini sah sebagai bukti bayaran.',
  'Sila pulangkan peralatan mengikut tarikh sewa yang dinyatakan.',
  'Resit rasmi dikunci selepas bayar — amaun tidak boleh diubah.'
];

function docTypeLabel(type) {
  if (type === 'quotation') return 'Sebutharga';
  if (type === 'receipt') return 'Resit';
  return 'Invois';
}

function docTypeShort(type) {
  if (type === 'quotation') return 'SQ';
  if (type === 'receipt') return 'RCP';
  return 'INV';
}

function calcDiscount(subtotal, type = 'none', value = 0) {
  const sub = Number(subtotal) || 0;
  const val = Number(value) || 0;
  if (type === 'percent') {
    const pct = Math.min(100, Math.max(0, val));
    return Math.round(sub * pct / 100 * 100) / 100;
  }
  if (type === 'fixed') return Math.min(sub, Math.max(0, val));
  return 0;
}

function calcCashierTotals(items, discountType = 'none', discountValue = 0) {
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  const discountAmount = calcDiscount(subtotal, discountType, discountValue);
  const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  return { subtotal, discountAmount, total };
}

function printDoc(thermal = false) {
  const oldTitle = document.title;
  document.title = ' ';
  if (thermal) document.body.classList.add('thermal-print');
  const restore = () => {
    document.title = oldTitle;
    document.body.classList.remove('thermal-print');
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

function paymentLabel(m) {
  return { cash: 'Tunai', transfer: 'Transfer Bank', duitnow: 'DuitNow QR' }[m] || m;
}

function waPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('60')) return d;
  if (d.startsWith('0')) return '60' + d.slice(1);
  return '60' + d;
}

const App = {
  company: null,
  clients: [],
  products: [],
  units: [],
  promos: [],
  searchTimer: null,
  customerCache: {},
  lastReceiptSnap: null,
  cashier: {
    cart: [],
    finalized: false,
    lockedNumber: null,
    lastTotal: 0
  },
  state: {
    docType: 'quotation',
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    terms: [...TERMS_QUO],
    mode: 'new',
    finalized: false,
    lockedNumber: null,
    editingVersion: null,
    discount: { type: 'none', value: 0, label: '' }
  },

  async init() {
    const auth = await fetch('/api/auth/check', { credentials: 'include' }).then(r => r.json());
    if (!auth.authenticated) return location.href = '/login.html';

    document.getElementById('userName').textContent = auth.user.name;
    const me = await API.get('/me');
    this.company = me.company;
    this.products = me.products || [];
    this.units = me.units || [];
    this.promos = me.promos || [];
    document.getElementById('numberFormat').value = me.numberFormat || 'standard';

    this.bindNav();
    this.bindEditor();
    this.bindCashier();
    this.bindRentals();
    this.bindReports();
    this.bindSettings();
    document.getElementById('btnLogout').onclick = async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      location.href = '/login.html';
    };

    await this.loadClients();
    $('reportDate').value = today();
    this.checkBackupReminder();
    this.goEditor(true);
    await this.loadDashboard();
  },

  checkBackupReminder() {
    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;
    const isFriday = new Date().getDay() === 5;
    const lastBackup = localStorage.getItem('pse_last_backup');
    const lastRemind = localStorage.getItem('pse_backup_remind');
    if (!isFriday) return;
    if (lastRemind && now - Number(lastRemind) < week) return;
    if (lastBackup && now - Number(lastBackup) < week) return;
    setTimeout(() => {
      if (confirm('📦 Reminder Backup\n\nDisyorkan export backup setiap Jumaat ke Google Drive.\n\nExport sekarang?')) {
        window.open('/api/backup/export', '_blank');
        localStorage.setItem('pse_last_backup', String(Date.now()));
      }
      localStorage.setItem('pse_backup_remind', String(Date.now()));
    }, 2500);
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
        if (btn.dataset.view === 'cashier') this.initCashier();
        if (btn.dataset.view === 'rentals') this.loadRentals();
        if (btn.dataset.view === 'reports') this.loadReports();
      };
    });
  },

  goCashier() {
    document.querySelector('[data-view="cashier"]').click();
  },

  goEditor(fresh = false) {
    document.querySelector('[data-view="editor"]').click();
    if (fresh) this.resetEditor();
  },

  bindCashier() {
    $('btnCashierClear').onclick = () => this.resetCashier(true);
    $('btnCashierPay').onclick = () => this.finalizeReceipt();
    $('btnCashierPrint').onclick = () => printDoc(true);
    $('btnCashierWhatsApp').onclick = () => this.sendWhatsAppReceipt();
    $('btnCashierInvoice').onclick = () => this.cashierToInvoice();
    $('btnCashierAddItem').onclick = () => this.addCustomItem();
    $('cashierItemDesc').onkeydown = e => { if (e.key === 'Enter') this.addCustomItem(); };
    $('cashierDiscountType').onchange = () => {
      const on = $('cashierDiscountType').value !== 'none';
      $('cashierDiscountValue').disabled = !on || this.cashier.finalized;
      if (!on) $('cashierDiscountValue').value = '';
      this.renderCart();
      this.renderCashierPreview();
    };
    ['cashierDiscountValue', 'cashierDiscountLabel'].forEach(id => {
      $(id).oninput = () => { this.renderCart(); this.renderCashierPreview(); };
    });
    $('cashierName').oninput = () => {
      this.renderCashierPreview();
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.searchCustomers($('cashierName').value), 300);
    };
    $('cashierName').onchange = () => this.applyCustomerSuggestion();
    $('cashierUnit').onchange = () => this.renderCashierPreview();
    document.querySelectorAll('input[name="paymentMethod"]').forEach(r => {
      r.onchange = () => this.renderCashierPreview();
    });
    ['cashierPhone', 'cashierStart', 'cashierEnd'].forEach(id => {
      $(id).oninput = () => { this.renderCashierPreview(); if (id === 'cashierStart') this.refreshCashierPeek(); };
    });
  },

  async searchCustomers(q) {
    const list = $('customerSuggestions');
    if (!q || q.trim().length < 2) { list.innerHTML = ''; this.customerCache = {}; return; }
    try {
      const results = await API.get('/customers/search?q=' + encodeURIComponent(q.trim()));
      this.customerCache = {};
      results.forEach(r => { this.customerCache[r.name] = r.phone; });
      list.innerHTML = results.map(r =>
        `<option value="${esc(r.name)}">${esc(r.phone ? r.name + ' · ' + r.phone : r.name)}</option>`
      ).join('');
    } catch { list.innerHTML = ''; this.customerCache = {}; }
  },

  applyCustomerSuggestion() {
    const name = $('cashierName').value.trim();
    if (this.customerCache[name]) $('cashierPhone').value = this.customerCache[name];
  },

  applyPromo(promo) {
    if (this.cashier.finalized) return;
    $('cashierDiscountType').value = promo.type;
    $('cashierDiscountValue').disabled = false;
    $('cashierDiscountValue').value = promo.value;
    $('cashierDiscountLabel').value = promo.name;
    this.renderCart();
    this.renderCashierPreview();
  },

  renderUnitSelect(selectedId = '') {
    const sel = $('cashierUnit');
    const active = this.units.filter(u => u.active !== false);
    sel.innerHTML = '<option value="">— Pilih unit —</option>' +
      active.map(u => `<option value="${esc(u.id)}" ${u.id === selectedId ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
    sel.disabled = this.cashier.finalized;
  },

  renderPromoPresets() {
    const el = $('promoPresetButtons');
    if (!el) return;
    el.innerHTML = this.promos.length
      ? this.promos.map(p => `
        <button type="button" class="promo-preset-btn" data-promo-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')
      : '';
    el.querySelectorAll('.promo-preset-btn').forEach(btn => {
      btn.onclick = () => {
        const p = this.promos.find(x => x.id === btn.dataset.promoId);
        if (p) this.applyPromo(p);
      };
    });
  },

  getSelectedUnit() {
    const id = $('cashierUnit')?.value;
    const unit = this.units.find(u => u.id === id);
    return unit ? { unitId: unit.id, unitName: unit.name } : { unitId: '', unitName: '' };
  },

  getPaymentMethod() {
    return document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash';
  },

  sendWhatsAppReceipt() {
    const snap = this.lastReceiptSnap || this.getCashierSnapshot();
    const phone = waPhone(snap.clientPhone);
    if (!phone) return alert('Tiada nombor telefon pelanggan.');
    const num = this.cashier.lockedNumber || snap.docNumber;
    const msg = [
      `Terima kasih ${snap.clientName}!`,
      '',
      `Resit: ${num}`,
      `Unit: ${snap.unitName || '—'}`,
      `Sewa: ${fd(snap.docDate)} — ${fd(snap.rentalEnd)}`,
      `Jumlah: RM ${fmt(snap.total)}`,
      `Bayaran: ${paymentLabel(snap.paymentMethod)}`,
      '',
      `${this.company?.name || 'PSE'}`
    ].join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  initCashier() {
    if (!this.cashier.finalized && !this.cashier.cart.length) {
      $('cashierStart').value = today();
      $('cashierEnd').value = addDays(today(), 1);
    }
    this.renderProductButtons();
    this.renderPromoPresets();
    this.renderUnitSelect($('cashierUnit')?.value || '');
    this.refreshCashierPeek();
    this.renderCart();
    this.renderCashierPreview();
    this.updateCashierButtons();
  },

  async refreshCashierPeek() {
    if (this.cashier.lockedNumber) return;
    const data = await API.get(`/number/peek?type=receipt&date=${$('cashierStart').value || today()}&clientCode=WALKIN`);
    $('cashierReceiptNo').value = `[DRAF] ${data.number}`;
    $('cashierReceiptNo').dataset.peek = data.number;
  },

  renderProductButtons() {
    $('productButtons').innerHTML = this.products.length
      ? this.products.map(p => `
        <button type="button" class="product-btn" data-pid="${esc(p.id)}">
          <strong>${esc(p.name)}</strong>
          <span>RM ${fmt(p.price)}</span>
        </button>`).join('')
      : '<p class="hint">Tiada produk. Tambah dalam Tetapan → Katalog Kaunter.</p>';
    $('productButtons').querySelectorAll('.product-btn').forEach(btn => {
      btn.onclick = () => {
        const p = this.products.find(x => x.id === btn.dataset.pid);
        if (p) this.addToCart(p);
      };
    });
  },

  addToCart(product) {
    if (this.cashier.finalized) return;
    const existing = this.cashier.cart.find(i => i.productId === product.id);
    if (existing) existing.qty += 1;
    else this.cashier.cart.push({ productId: product.id, desc: product.name, price: product.price, qty: 1 });
    this.renderCart();
    this.renderCashierPreview();
  },

  addCustomItem() {
    if (this.cashier.finalized) return;
    const desc = $('cashierItemDesc').value.trim();
    const price = Number($('cashierItemPrice').value) || 0;
    const qty = Math.max(1, Number($('cashierItemQty').value) || 1);
    if (!desc) return alert('Masukkan nama item.');
    if (price <= 0) return alert('Masukkan harga item.');
    this.cashier.cart.push({ productId: null, desc, price, qty });
    $('cashierItemDesc').value = '';
    $('cashierItemPrice').value = '';
    $('cashierItemQty').value = '1';
    $('cashierItemDesc').focus();
    this.renderCart();
    this.renderCashierPreview();
  },

  removeCartItem(idx) {
    if (this.cashier.finalized) return;
    this.cashier.cart.splice(idx, 1);
    this.renderCart();
    this.renderCashierPreview();
  },

  getCashierDiscount() {
    const type = $('cashierDiscountType')?.value || 'none';
    const value = Number($('cashierDiscountValue')?.value) || 0;
    const label = ($('cashierDiscountLabel')?.value || '').trim();
    return { type, value, label };
  },

  updateCashierTotalsDisplay(items) {
    const { type, value, label } = this.getCashierDiscount();
    const { subtotal, discountAmount, total } = calcCashierTotals(items, type, value);
    $('cashierSubtotal').textContent = 'RM ' + fmt(subtotal);
    $('cashierTotal').textContent = 'RM ' + fmt(total);
    const discRow = $('cashierDiscountRow');
    if (discountAmount > 0) {
      discRow.hidden = false;
      const discLabel = label || (type === 'percent' ? `Diskaun ${value}%` : 'Diskaun');
      $('cashierDiscountLabelText').textContent = discLabel;
      $('cashierDiscountAmount').textContent = '-RM ' + fmt(discountAmount);
    } else {
      discRow.hidden = true;
    }
    this.cashier.lastTotal = total;
    return { subtotal, discountAmount, total, discountType: type, discountValue: value, discountLabel: label };
  },

  renderCart() {
    const cart = this.cashier.cart;
    const addForm = $('cashierAddItem');
    const discForm = $('cashierDiscount');
    if (addForm) addForm.hidden = this.cashier.finalized;
    if (discForm) discForm.hidden = this.cashier.finalized;

    if (!cart.length) {
      $('cashierCart').innerHTML = '<p class="cart-empty">Klik pakej atau tambah item manual di bawah.</p>';
      this.updateCashierTotalsDisplay([]);
      this.updateCashierButtons();
      return;
    }

    if (this.cashier.finalized) {
      $('cashierCart').innerHTML = cart.map(item => `
        <div class="cart-row cart-row-readonly">
          <div>
            <div class="cart-desc-text">${esc(item.desc)}</div>
            <div class="cart-unit">RM ${fmt(item.price)} × ${item.qty}</div>
          </div>
          <span class="cart-line-total">${fmt(item.price * item.qty)}</span>
        </div>`).join('');
    } else {
      $('cashierCart').innerHTML = cart.map((item, idx) => `
        <div class="cart-row">
          <input value="${esc(item.desc)}" data-ci="${idx}" data-cf="desc" placeholder="Item">
          <input type="number" min="0" step="0.01" value="${item.price}" data-ci="${idx}" data-cf="price">
          <input type="number" min="1" value="${item.qty}" data-ci="${idx}" data-cf="qty">
          <span class="cart-line-total">${fmt(item.price * item.qty)}</span>
          <button type="button" class="btn-buang" data-cr="${idx}">Buang</button>
        </div>`).join('');

      $('cashierCart').querySelectorAll('input[data-ci]').forEach(inp => {
        inp.oninput = () => {
          const i = +inp.dataset.ci;
          const field = inp.dataset.cf;
          if (field === 'desc') this.cashier.cart[i].desc = inp.value;
          else if (field === 'price') this.cashier.cart[i].price = Math.max(0, Number(inp.value) || 0);
          else this.cashier.cart[i].qty = Math.max(1, Number(inp.value) || 1);
          this.renderCart();
          this.renderCashierPreview();
        };
      });
      $('cashierCart').querySelectorAll('[data-cr]').forEach(btn => {
        btn.onclick = () => this.removeCartItem(+btn.dataset.cr);
      });
    }

    this.updateCashierTotalsDisplay(cart);
    this.updateCashierButtons();
  },

  getCashierSnapshot() {
    const items = this.cashier.cart.map(i => ({ desc: i.desc, price: i.price, qty: i.qty }));
    const totals = this.updateCashierTotalsDisplay(items);
    const { type, value, label } = this.getCashierDiscount();
    const { unitId, unitName } = this.getSelectedUnit();
    const paymentMethod = this.getPaymentMethod();
    return {
      docType: 'receipt',
      mode: 'new',
      docNumber: this.cashier.lockedNumber || $('cashierReceiptNo').dataset.peek || '',
      docDate: $('cashierStart').value || today(),
      rentalEnd: $('cashierEnd').value || '',
      dueDate: '',
      sstEnabled: false,
      refQuotation: '',
      clientCode: 'WALKIN',
      clientName: $('cashierName').value.trim(),
      clientAttn: '',
      clientAddress: '',
      clientPhone: $('cashierPhone').value.trim(),
      clientEmail: '',
      unitId,
      unitName,
      paymentMethod,
      docSubject: 'RESIT SEWA PS5',
      items,
      terms: [...TERMS_RECEIPT],
      discountType: type,
      discountValue: value,
      discountLabel: label,
      discountAmount: totals.discountAmount,
      subtotal: totals.subtotal,
      sst: 0,
      total: totals.total
    };
  },

  renderCashierPreview() {
    const s = this.getCashierSnapshot();
    const num = this.cashier.lockedNumber || $('cashierReceiptNo').dataset.peek || '[DRAF]';
    const co = this.company || {};
    const rows = s.items.map((it, i) => `
      <tr><td>${i + 1}</td><td>${esc(it.desc)}</td><td class="c">${it.qty}</td><td class="r">${fmt(it.price * it.qty)}</td></tr>`).join('');
    const discFoot = s.discountAmount > 0
      ? `<tr><td colspan="3" class="r">Subjumlah</td><td class="r">${fmt(s.subtotal)}</td></tr>
         <tr><td colspan="3" class="r" style="color:#059669">${esc(s.discountLabel || (s.discountType === 'percent' ? `Diskaun ${s.discountValue}%` : 'Diskaun'))}</td>
         <td class="r" style="color:#059669">-${fmt(s.discountAmount)}</td></tr>`
      : '';
    const totalFoot = `<tr><td colspan="3" class="r"><b>JUMLAH (RM)</b></td><td class="r"><b>${fmt(s.total)}</b></td></tr>`;

    $('cashierPreview').innerHTML = `
      <div class="pv-header">
        <div><strong>${co.name || ''}</strong><br>${co.regNo || ''}<br>${co.phone || ''}</div>
        <div class="pv-right"><div class="pv-type">RESIT</div><div><b>No.</b> ${esc(num)}</div></div>
      </div>
      <div class="pv-client">
        <b>Penyewa:</b> ${esc(s.clientName || '—')}<br>
        ${s.clientPhone ? `<b>Tel:</b> ${esc(s.clientPhone)}<br>` : ''}
        ${s.unitName ? `<b>Unit:</b> ${esc(s.unitName)}<br>` : ''}
        <b>Sewa:</b> ${fd(s.docDate)} — ${fd(s.rentalEnd)}<br>
        <b>Bayaran:</b> ${paymentLabel(s.paymentMethod)}
      </div>
      <table class="pv-table"><thead><tr><th>No</th><th>Item</th><th>Qty</th><th>Jumlah</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="hint">Tiada item</td></tr>'}</tbody>
      <tfoot>${discFoot}${totalFoot}</tfoot></table>
      <div class="pv-terms"><ol>${s.terms.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
      ${this.cashier.finalized ? '<div class="pv-lock-note">🔒 RESIT MUKTAMAD — DIKUNCI SELEPAS BAYAR</div>' : ''}`;
    this.updateCashierButtons();
  },

  updateCashierButtons() {
    const hasItems = this.cashier.cart.length > 0;
    const hasName = $('cashierName').value.trim().length > 0;
    $('btnCashierPay').disabled = this.cashier.finalized || !hasItems || !hasName || !$('cashierUnit').value;
    $('btnCashierClear').disabled = false;
    $('btnCashierInvoice').disabled = !hasItems || this.cashier.finalized;
    $('btnCashierPrint').disabled = !this.cashier.finalized;
    $('btnCashierWhatsApp').disabled = !this.cashier.finalized || !$('cashierPhone').value.trim();
    const badge = $('cashierStatusBadge');
    if (this.cashier.finalized) {
      badge.textContent = 'DIKUNCI';
      badge.className = 'badge badge-locked';
    } else {
      badge.textContent = 'DRAF';
      badge.className = 'badge badge-draft';
    }
    ['cashierName', 'cashierPhone', 'cashierStart', 'cashierEnd'].forEach(id => {
      if ($(id)) $(id).disabled = this.cashier.finalized;
    });
    document.querySelectorAll('input[name="paymentMethod"]').forEach(r => { r.disabled = this.cashier.finalized; });
    if ($('cashierAddItem')) {
      ['cashierItemDesc', 'cashierItemPrice', 'cashierItemQty', 'btnCashierAddItem'].forEach(id => {
        if ($(id)) $(id).disabled = this.cashier.finalized;
      });
    }
    if ($('cashierDiscount')) {
      const discOn = $('cashierDiscountType').value !== 'none';
      $('cashierDiscountType').disabled = this.cashier.finalized;
      $('cashierDiscountValue').disabled = this.cashier.finalized || !discOn;
      $('cashierDiscountLabel').disabled = this.cashier.finalized;
    }
  },

  async finalizeReceipt() {
    const snap = this.getCashierSnapshot();
    if (!snap.clientName) return alert('Sila masukkan nama penyewa.');
    if (!$('cashierUnit').value) return alert('Sila pilih unit PS5.');
    if (!snap.items.length) return alert('Tambah sekurang-kurangnya satu item.');
    if (snap.items.some(i => !i.desc?.trim())) return alert('Semua item mesti ada nama.');
    if (snap.items.some(i => (Number(i.price) || 0) <= 0)) return alert('Semua item mesti ada harga.');
    const discMsg = snap.discountAmount > 0
      ? `\nSubjumlah: RM ${fmt(snap.subtotal)}\nDiskaun: -RM ${fmt(snap.discountAmount)}\nBayar: RM ${fmt(snap.total)}`
      : `\nJumlah: RM ${fmt(snap.total)}`;
    if (!confirm(`Sahkan bayaran?${discMsg}\n\nResit akan dikunci selepas ini.`)) return;

    try {
      const res = await API.post('/documents/finalize', snap);
      this.cashier.finalized = true;
      this.cashier.lockedNumber = res.docNumber;
      this.lastReceiptSnap = snap;
      $('cashierReceiptNo').value = res.docNumber;
      this.renderCart();
      this.renderCashierPreview();
      alert(`✅ Resit disahkan!\n\n${res.docNumber}\nJumlah: RM ${fmt(res.total)}\n\nResit dikunci — tidak boleh diubah.`);
      printDoc(true);
      this.loadDashboard();
    } catch (e) { alert(e.message); }
  },

  resetCashier(force = false) {
    if (!force && (this.cashier.cart.length || $('cashierName').value.trim())) {
      if (!confirm('Mulakan transaksi baru?')) return;
    }
    this.cashier = { cart: [], finalized: false, lockedNumber: null, lastTotal: 0 };
    this.lastReceiptSnap = null;
    $('cashierName').value = '';
    $('cashierPhone').value = '';
    $('cashierUnit').value = '';
    document.querySelector('input[name="paymentMethod"][value="cash"]').checked = true;
    $('cashierStart').value = today();
    $('cashierEnd').value = addDays(today(), 1);
    $('cashierReceiptNo').value = '';
    delete $('cashierReceiptNo').dataset.peek;
    $('cashierDiscountType').value = 'none';
    $('cashierDiscountValue').value = '';
    $('cashierDiscountLabel').value = '';
    $('cashierDiscountValue').disabled = true;
    this.initCashier();
  },

  cashierToInvoice() {
    if (!this.cashier.cart.length) return alert('Tambah item dahulu.');
    const snap = this.getCashierSnapshot();
    this.goEditor(false);
    this.state.docType = 'invoice';
    this.state.items = snap.items.map(i => ({ ...i }));
    this.state.terms = [...TERMS_INV];
    this.state.mode = 'new';
    this.state.finalized = false;
    this.state.lockedNumber = null;
    this.state.discount = {
      type: snap.discountType || 'none',
      value: snap.discountValue || 0,
      label: snap.discountLabel || ''
    };
    document.querySelector('input[name="docType"][value="invoice"]').checked = true;
    $('clientCode').value = 'WALKIN';
    $('clientName').value = snap.clientName;
    $('clientPhone').value = snap.clientPhone;
    $('docSubject').value = 'INVOIS SEWA PS5';
    $('docDate').value = snap.docDate;
    $('dueDate').value = addDays(snap.docDate, 7);
    $('refQuoWrap').hidden = false;
    $('dueWrap').hidden = false;
    $('btnConvertInv').style.display = 'none';
    this.renderItems();
    this.renderTerms();
    this.refreshPeek();
    this.renderPreview();
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
    $('btnAddTerm').onclick = () => { this.state.terms.push(''); this.renderTerms(); this.renderPreview(); };
    $('btnFinalize').onclick = () => this.finalize();
    $('btnNewDoc').onclick = () => this.resetEditor();
    $('btnPrint').onclick = () => printDoc();
    $('btnConvertInv').onclick = () => this.convertInvoice();
    $('archiveFilter').onchange = () => this.loadArchive();
  },

  bindSettings() {
    $('numberFormat').onchange = async () => {
      await API.put('/settings', { numberFormat: $('numberFormat').value });
      this.refreshPeek();
    };
    $('btnExport').onclick = () => {
      window.open('/api/backup/export', '_blank');
      localStorage.setItem('pse_last_backup', String(Date.now()));
    };
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
    $('btnAddProduct').onclick = () => { this.products.push({ id: `prod_${Date.now()}`, name: '', price: 0, category: 'general' }); this.renderProductsEditor(); };
    $('btnSaveProducts').onclick = () => this.saveProducts();
    $('btnAddUnit').onclick = () => { this.units.push({ id: `unit_${Date.now()}`, name: '', active: true }); this.renderUnitsEditor(); };
    $('btnSaveUnits').onclick = () => this.saveUnits();
    $('btnAddPromo').onclick = () => { this.promos.push({ id: `promo_${Date.now()}`, name: '', type: 'percent', value: 0 }); this.renderPromosEditor(); };
    $('btnSavePromos').onclick = () => this.savePromos();
    $('btnChangePassword').onclick = () => this.changePassword();
    this.renderProductsEditor();
    this.renderUnitsEditor();
    this.renderPromosEditor();
  },

  renderUnitsEditor() {
    $('unitsEditor').innerHTML = this.units.map((u, i) => `
      <div class="product-editor-row">
        <input value="${esc(u.name)}" data-ui="${i}" data-uf="name" placeholder="Nama unit">
        <label style="font-size:.75rem"><input type="checkbox" data-ui="${i}" data-uf="active" ${u.active !== false ? 'checked' : ''}> Aktif</label>
        <span></span>
        <button type="button" data-ud="${i}">×</button>
      </div>`).join('') || '<p class="hint">Tiada unit. Klik + Unit.</p>';
    $('unitsEditor').querySelectorAll('input[data-ui]').forEach(inp => {
      inp.oninput = inp.onchange = () => {
        const i = +inp.dataset.ui;
        if (inp.dataset.uf === 'active') this.units[i].active = inp.checked;
        else this.units[i].name = inp.value;
      };
    });
    $('unitsEditor').querySelectorAll('[data-ud]').forEach(btn => {
      btn.onclick = () => { this.units.splice(+btn.dataset.ud, 1); this.renderUnitsEditor(); };
    });
  },

  async saveUnits() {
    const res = await API.put('/units', { units: this.units.filter(u => u.name?.trim()) });
    this.units = res.units;
    this.renderUnitsEditor();
    this.renderUnitSelect();
    alert('Unit disimpan.');
  },

  renderPromosEditor() {
    $('promosEditor').innerHTML = this.promos.map((p, i) => `
      <div class="promo-editor-row">
        <input value="${esc(p.name)}" data-pri="${i}" data-prf="name" placeholder="Nama promo">
        <select data-pri="${i}" data-prf="type">
          <option value="percent" ${p.type === 'percent' ? 'selected' : ''}>%</option>
          <option value="fixed" ${p.type === 'fixed' ? 'selected' : ''}>RM</option>
        </select>
        <input type="number" step="0.01" value="${p.value}" data-pri="${i}" data-prf="value" placeholder="Nilai">
        <button type="button" data-prd="${i}">×</button>
      </div>`).join('') || '<p class="hint">Tiada promo. Klik + Promo.</p>';
    $('promosEditor').querySelectorAll('input, select').forEach(el => {
      el.oninput = el.onchange = () => {
        const i = +el.dataset.pri;
        this.promos[i][el.dataset.prf] = el.dataset.prf === 'value' ? +el.value : el.value;
      };
    });
    $('promosEditor').querySelectorAll('[data-prd]').forEach(btn => {
      btn.onclick = () => { this.promos.splice(+btn.dataset.prd, 1); this.renderPromosEditor(); };
    });
  },

  async savePromos() {
    const res = await API.put('/promos', { promos: this.promos.filter(p => p.name?.trim()) });
    this.promos = res.promos;
    this.renderPromosEditor();
    this.renderPromoPresets();
    alert('Promo disimpan.');
  },

  async changePassword() {
    const currentPassword = $('currentPassword').value;
    const newPassword = $('newPassword').value;
    const confirmPassword = $('confirmPassword').value;
    if (!currentPassword || !newPassword) return alert('Isi semua medan kata laluan.');
    if (newPassword !== confirmPassword) return alert('Kata laluan baru tidak sepadan.');
    if (newPassword.length < 6) return alert('Minimum 6 aksara.');
    try {
      await API.post('/auth/change-password', { currentPassword, newPassword });
      $('currentPassword').value = $('newPassword').value = $('confirmPassword').value = '';
      alert('✅ Kata laluan berjaya ditukar.');
    } catch (e) { alert(e.message); }
  },

  bindRentals() {
    $('rentalFilter').onchange = () => this.loadRentals();
  },

  rentalStatusLabel(s) {
    return { rented: 'Disewa', returned: 'Sudah Pulang', overdue: 'Lewat Pulang' }[s] || s;
  },

  rentalStatusClass(s) {
    return { rented: 'badge-rented', returned: 'badge-returned', overdue: 'badge-overdue' }[s] || '';
  },

  async loadRentals() {
    const status = $('rentalFilter').value;
    const rentals = await API.get('/rentals?status=' + status);
    const all = await API.get('/rentals?status=all');
    const active = all.filter(r => r.rental_status === 'rented').length;
    const overdue = all.filter(r => r.rental_status === 'overdue').length;
    $('rentalStats').innerHTML = `
      <div class="stat-card"><span>${active}</span><label>Sedang Disewa</label></div>
      <div class="stat-card stat-danger"><span>${overdue}</span><label>Lewat Pulang</label></div>
      <div class="stat-card"><span>${all.filter(r => r.rental_status === 'returned').length}</span><label>Sudah Pulang</label></div>`;
    $('rentalsList').innerHTML = rentals.length ? rentals.map(r => `
      <div class="rental-row">
        <div class="rental-main">
          <strong>${esc(r.doc_number)}</strong>
          <span class="badge ${this.rentalStatusClass(r.rental_status)}">${this.rentalStatusLabel(r.rental_status)}</span>
          <div class="rental-meta">
            ${esc(r.client_name)} · ${esc(r.unit_name || '—')} · ${fd(r.rental_start)} → ${fd(r.rental_end)}
            · RM ${fmt(r.total)} · ${paymentLabel(r.payment_method)}
            ${r.client_phone ? ` · ${esc(r.client_phone)}` : ''}
          </div>
        </div>
        <div class="rental-actions">
          ${r.rental_status !== 'returned' ? `<button class="btn btn-small btn-success" onclick="App.markReturned('${esc(r.doc_number)}')">✓ Pulang</button>` : ''}
          <button class="btn btn-small" onclick="App.openDoc('${esc(r.doc_number)}')">Resit</button>
        </div>
      </div>`).join('') : '<p class="hint">Tiada rekod sewa.</p>';
  },

  async markReturned(docNumber) {
    if (!confirm('Tandakan unit sudah dipulang?')) return;
    await API.patch('/rentals/' + encodeURIComponent(docNumber), { status: 'returned' });
    this.loadRentals();
    this.loadDashboard();
  },

  bindReports() {
    $('btnReportRefresh').onclick = () => this.loadReports();
    $('reportDate').onchange = () => this.loadReports();
    $('btnReportExport').onclick = () => {
      const date = $('reportDate').value || today();
      window.open('/api/reports/daily/export?date=' + date, '_blank');
    };
  },

  async loadReports() {
    const date = $('reportDate').value || today();
    const r = await API.get('/reports/daily?date=' + date);
    $('reportStats').innerHTML = `
      <div class="stat-card"><span>${r.transactionCount}</span><label>Transaksi</label></div>
      <div class="stat-card"><span>RM ${fmt(r.totalSales)}</span><label>Jumlah Jualan</label></div>
      <div class="stat-card"><span>RM ${fmt(r.discountTotal)}</span><label>Jumlah Diskaun</label></div>`;
    const pays = r.paymentBreakdown || {};
    $('reportPayments').innerHTML = ['cash', 'transfer', 'duitnow', 'other'].map(k => `
      <div class="list-row"><span>${paymentLabel(k)}</span><strong>RM ${fmt(pays[k] || 0)}</strong></div>`).join('');
    $('reportTopItems').innerHTML = r.topItems.length
      ? r.topItems.map(i => `<div class="list-row"><span>${esc(i.name)}</span><strong>${i.qty}×</strong></div>`).join('')
      : '<p class="hint">Tiada data.</p>';
    $('reportTransactions').innerHTML = r.transactions.length
      ? r.transactions.map(t => `
        <div class="list-row">
          <strong>${esc(t.doc_number)}</strong>
          <span>${esc(t.client_name)} · ${esc(t.unit_name || '—')} · RM ${fmt(t.total)} · ${paymentLabel(t.payment_method)}</span>
        </div>`).join('')
      : '<p class="hint">Tiada transaksi pada tarikh ini.</p>';
  },

  renderProductsEditor() {
    $('productsEditor').innerHTML = this.products.map((p, i) => `
      <div class="product-editor-row">
        <input value="${esc(p.name)}" data-pi="${i}" data-pf="name" placeholder="Nama produk">
        <input type="number" step="0.01" value="${p.price}" data-pi="${i}" data-pf="price" placeholder="Harga">
        <input value="${esc(p.category || '')}" data-pi="${i}" data-pf="category" placeholder="Kategori">
        <button type="button" data-pd="${i}">×</button>
      </div>`).join('') || '<p class="hint">Tiada produk. Klik + Produk.</p>';
    $('productsEditor').querySelectorAll('input').forEach(inp => {
      inp.oninput = () => {
        const i = +inp.dataset.pi;
        this.products[i][inp.dataset.pf] = inp.dataset.pf === 'price' ? +inp.value : inp.value;
      };
    });
    $('productsEditor').querySelectorAll('[data-pd]').forEach(btn => {
      btn.onclick = () => { this.products.splice(+btn.dataset.pd, 1); this.renderProductsEditor(); };
    });
  },

  async saveProducts() {
    const res = await API.put('/products', { products: this.products.filter(p => p.name?.trim()) });
    this.products = res.products;
    this.renderProductsEditor();
    this.renderProductButtons();
    alert('Katalog disimpan.');
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
    this.state = { docType: 'quotation', items: DEFAULT_ITEMS.map(i => ({ ...i })), terms: [...TERMS_QUO], mode: 'new', finalized: false, lockedNumber: null, editingVersion: null, discount: { type: 'none', value: 0, label: '' } };
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
    const disc = this.state.discount || { type: 'none', value: 0, label: '' };
    const discountAmount = calcDiscount(sub, disc.type, disc.value);
    const afterDiscount = Math.max(0, Math.round((sub - discountAmount) * 100) / 100);
    const sstOn = $('sstEnabled').checked;
    const sst = sstOn ? afterDiscount * 0.08 : 0;
    const total = Math.round((afterDiscount + sst) * 100) / 100;
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
      items,
      terms: this.state.terms,
      discountType: disc.type,
      discountValue: disc.value,
      discountLabel: disc.label,
      discountAmount,
      subtotal: sub,
      sst,
      total
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
      if (confirm('Cetak PDF sekarang?')) printDoc();
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
    $('termsList').innerHTML = this.state.terms.map((t, i) => `
      <div class="term-row">
        <textarea data-ti="${i}" rows="2" placeholder="Terma ${i + 1}">${esc(t)}</textarea>
        <button type="button" data-rm-term="${i}" title="Padam terma">×</button>
      </div>`).join('');
    $('termsList').querySelectorAll('textarea').forEach(ta => {
      ta.oninput = () => {
        this.state.terms[+ta.dataset.ti] = ta.value;
        this.state.finalized = false;
        this.updateButtons();
        this.renderPreview();
      };
    });
    $('termsList').querySelectorAll('[data-rm-term]').forEach(btn => {
      btn.onclick = () => {
        this.state.terms.splice(+btn.dataset.rmTerm, 1);
        this.state.finalized = false;
        this.updateButtons();
        this.renderTerms();
        this.renderPreview();
      };
    });
  },

  renderPreview() {
    const s = this.getSnapshot();
    const isQuo = s.docType === 'quotation';
    const isReceipt = s.docType === 'receipt';
    const num = this.state.finalized || this.state.lockedNumber ? (this.state.lockedNumber || s.docNumber) : ($('docNumber').dataset.peek || s.docNumber);
    const co = this.company || {};
    const clientContact = [s.clientPhone, s.clientEmail].filter(Boolean).join(' | ');
    const clientNameLine = [s.clientName, s.clientAttn ? `(Attn: ${s.clientAttn})` : ''].filter(Boolean).join(' ');
    const rows = s.items.map((it, i) => `<tr><td>${i+1}</td><td>${esc(it.desc)}</td><td class="r">${fmt(it.price)}</td><td class="c">${it.qty}</td><td class="r">${fmt(it.price*it.qty)}</td></tr>`).join('');
    const totals = s.sstEnabled
      ? `<tr><td colspan="4" class="r"><b>Subjumlah</b></td><td class="r">${fmt(s.subtotal)}</td></tr>
         ${s.discountAmount > 0 ? `<tr><td colspan="4" class="r" style="color:#059669">${esc(s.discountLabel || (s.discountType === 'percent' ? `Diskaun ${s.discountValue}%` : 'Diskaun'))}</td><td class="r" style="color:#059669">-${fmt(s.discountAmount)}</td></tr>` : ''}
         <tr><td colspan="4" class="r">SST 8%</td><td class="r">${fmt(s.sst)}</td></tr>
         <tr><td colspan="4" class="r"><b>Jumlah</b></td><td class="r">${fmt(s.total)}</td></tr>`
      : `<tr><td colspan="4" class="r"><b>Subjumlah</b></td><td class="r">${fmt(s.subtotal)}</td></tr>
         ${s.discountAmount > 0 ? `<tr><td colspan="4" class="r" style="color:#059669">${esc(s.discountLabel || (s.discountType === 'percent' ? `Diskaun ${s.discountValue}%` : 'Diskaun'))}</td><td class="r" style="color:#059669">-${fmt(s.discountAmount)}</td></tr>` : ''}
         <tr><td colspan="4" class="r"><b>Jumlah (RM)</b></td><td class="r">${fmt(s.total)}</td></tr>`;
    const docTitle = isQuo ? 'SEBUTHARGA' : isReceipt ? 'RESIT' : 'INVOIS';

    $('docPreview').innerHTML = `
      <div class="pv-header">
        <div><img src="/assets/logo.png" height="40" onerror="this.remove()"><br>
          <strong>${co.name||''}</strong> ${co.regNo||''}<br>
          ${(co.address||[]).join('<br>')}<br>${co.email} | ${co.phone}</div>
        <div class="pv-right">
          <div class="pv-type">${docTitle}</div>
          <div><b>${isQuo?'Ruj.':'No.'}</b> ${esc(num)}</div>
          ${!isQuo && !isReceipt && s.refQuotation ? `<div><b>Ruj. SQ:</b> ${esc(s.refQuotation)}</div>` : ''}
          <div><b>Tarikh:</b> ${fd(s.docDate)}</div>
          ${!isQuo && !isReceipt && s.dueDate ? `<div><b>Akhir Bayar:</b> ${fd(s.dueDate)}</div>` : ''}
        </div>
      </div>
      <div class="pv-client">
        <b>${isReceipt ? 'Penyewa' : 'Kepada'}:</b><br>
        ${esc(clientNameLine || '-') }<br>
        ${esc(s.clientAddress || '-').replace(/\n/g, '<br>')}
        ${clientContact ? `<br>${esc(clientContact)}` : ''}
      </div>
      ${isReceipt ? '' : '<p>Tuan/Puan,</p>'}
      <p class="pv-subject">${esc(s.docSubject)}</p>
      <table class="pv-table"><thead><tr><th>No</th><th>Item</th><th>Harga</th><th>Qty</th><th>Jumlah</th></tr></thead>
      <tbody>${rows}</tbody><tfoot>${totals}</tfoot></table>
      <div class="pv-terms"><b>Terma & Syarat</b><ol>${s.terms.filter(t => t?.trim()).map(t=>`<li>${esc(t)}</li>`).join('')}</ol></div>
      ${isReceipt ? '' : `<div class="pv-bank"><b>Maklumat Pembayaran</b><br>
        ${co.bank?.payee} | ${co.bank?.bankName} | ${co.bank?.accountNo}<br>
        <em>Rujukan: ${esc(num)}</em></div>`}`;
    this.updateButtons();
  },

  async loadDashboard() {
    const d = await API.get('/dashboard');
    $('statsGrid').innerHTML = `
      <div class="stat-card"><span>RM ${fmt(d.todaySales || 0)}</span><label>Jualan Hari Ini</label></div>
      <div class="stat-card"><span>${d.todayReceiptCount || 0}</span><label>Resit Hari Ini</label></div>
      <div class="stat-card stat-danger"><span>${d.overdueRentals || 0}</span><label>Lewat Pulang</label></div>
      <div class="stat-card"><span>${d.activeRentals || 0}</span><label>Sedang Disewa</label></div>
      <div class="stat-card"><span>${d.receipts || 0}</span><label>Jumlah Resit</label></div>
      <div class="stat-card"><span>RM ${fmt(d.totalValue)}</span><label>Nilai Keseluruhan</label></div>`;
    $('recentDocs').innerHTML = d.recent.length ? d.recent.map(doc => `
      <div class="list-row clickable" onclick="App.openDoc('${esc(doc.doc_number)}')">
        <strong>${esc(doc.doc_number)}</strong>
        <span>${docTypeShort(doc.doc_type)} · ${esc(doc.client_name||'—')} · RM ${fmt(doc.total)}${doc.locked ? ' 🔒' : ''}</span>
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
        <small>${docTypeLabel(d.doc_type)} · v${d.latest_version} · RM ${fmt(d.total)} · ${esc(d.client_name||'')}${d.locked ? ' 🔒' : ''}</small>
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
      <p class="hint">${doc.locked ? '🔒 Resit dikunci — hanya boleh cetak semula.' : 'Klik versi untuk buka & edit (simpan = versi baru)'}</p>`;
  },

  async openDoc(docNumber, version = null) {
    const docMeta = await API.get('/documents/' + encodeURIComponent(docNumber));

    if (docMeta.doc_type === 'receipt') {
      const snap = version
        ? await API.get(`/documents/${encodeURIComponent(docNumber)}/versions/${version}`)
        : await API.get(`/documents/${encodeURIComponent(docNumber)}/versions/${docMeta.latest_version}`);
      this.goCashier();
      this.cashier = {
        cart: snap.items.map(i => ({ productId: null, desc: i.desc, price: i.price, qty: i.qty })),
        finalized: true,
        lockedNumber: snap.docNumber,
        lastTotal: snap.total
      };
      $('cashierName').value = snap.clientName || '';
      $('cashierPhone').value = snap.clientPhone || '';
      $('cashierStart').value = snap.docDate?.split('T')[0] || snap.docDate;
      $('cashierEnd').value = snap.rentalEnd?.split('T')[0] || snap.rentalEnd || '';
      $('cashierReceiptNo').value = snap.docNumber;
      $('cashierDiscountType').value = snap.discountType || 'none';
      $('cashierDiscountValue').value = snap.discountValue || '';
      $('cashierDiscountLabel').value = snap.discountLabel || '';
      this.renderUnitSelect(snap.unitId || '');
      if (snap.paymentMethod) {
        const pm = document.querySelector(`input[name="paymentMethod"][value="${snap.paymentMethod}"]`);
        if (pm) pm.checked = true;
      }
      this.lastReceiptSnap = snap;
      this.renderCart();
      this.renderCashierPreview();
      return;
    }

    if (docMeta.locked) return alert('Resit ini dikunci dan tidak boleh diubah.');

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
    this.state.discount = {
      type: snap.discountType || 'none',
      value: snap.discountValue || 0,
      label: snap.discountLabel || ''
    };
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
