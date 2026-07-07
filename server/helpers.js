const { readStore } = require('./db');

function getLatestSnapshot(docNumber) {
  const versions = readStore('versions', []).filter(v => v.doc_number === docNumber);
  if (!versions.length) return null;
  const latest = versions.sort((a, b) => b.version - a.version)[0];
  try {
    return JSON.parse(latest.snapshot);
  } catch {
    return null;
  }
}

function getReceiptSnapshots(filterFn = null) {
  const docs = Object.values(readStore('documents', {})).filter(d => d.doc_type === 'receipt');
  return docs.map(d => {
    const snap = getLatestSnapshot(d.doc_number);
    return snap ? { doc: d, snap } : null;
  }).filter(Boolean).filter(row => !filterFn || filterFn(row));
}

function effectiveRentalStatus(doc) {
  if (doc.rental_status === 'returned') return 'returned';
  if (doc.rental_end && doc.rental_status === 'rented') {
    const today = new Date().toISOString().slice(0, 10);
    if (doc.rental_end < today) return 'overdue';
  }
  return doc.rental_status || 'returned';
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

module.exports = { getLatestSnapshot, getReceiptSnapshots, effectiveRentalStatus, calcDiscountAmount };
