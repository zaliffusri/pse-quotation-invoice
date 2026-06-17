const { readStore, writeStore } = require('./db');

const FORMATS = {
  standard: {
    quo: (p, code, d, seq) => `${p}-QUO-${d.yyyy}-${pad(seq, 4)}`,
    inv: (p, code, d, seq) => `${p}-INV-${d.yyyy}-${pad(seq, 4)}`,
    counterKey: (type, d) => `${type}_std_${d.yyyy}`
  },
  classic: {
    quo: (p, code, d, seq) => `${p}/${code}/${d.yymm}-${pad(seq, 3)}`,
    inv: (p, code, d, seq) => `${p}/INV/${d.yymm}-${pad(seq, 3)}`,
    counterKey: (type, d, code) => type === 'quotation' ? `quo_cls_${code}_${d.yymm}` : `inv_cls_${d.yymm}`
  },
  monthly: {
    quo: (p, code, d, seq) => `${p}/QUO/${d.yyyymm}-${pad(seq, 3)}`,
    inv: (p, code, d, seq) => `${p}/INV/${d.yyyymm}-${pad(seq, 3)}`,
    counterKey: (type, d) => `${type}_mth_${d.yyyymm}`
  },
  simple: {
    quo: (p, code, d, seq) => `QUO-${d.yyyymm}-${pad(seq, 3)}`,
    inv: (p, code, d, seq) => `INV-${d.yyyymm}-${pad(seq, 3)}`,
    counterKey: (type, d) => `${type}_simp_${d.yyyymm}`
  }
};

function pad(n, len = 3) { return String(n).padStart(len, '0'); }

function sanitizeCode(code) {
  return (code || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'GEN';
}

function getDateParts(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(2);
  const mm = pad(date.getMonth() + 1, 2);
  return { yyyy, yymm: `${yy}${mm}`, yyyymm: `${yyyy}${mm}` };
}

function peekCounter(format, type, dateStr, clientCode) {
  const fmt = FORMATS[format] || FORMATS.standard;
  const d = getDateParts(dateStr);
  const code = sanitizeCode(clientCode);
  const key = fmt.counterKey(type, d, code);
  const counters = readStore('counters', {});
  return (counters[key] || 0) + 1;
}

function commitCounter(format, type, dateStr, clientCode) {
  const fmt = FORMATS[format] || FORMATS.standard;
  const d = getDateParts(dateStr);
  const code = sanitizeCode(clientCode);
  const key = fmt.counterKey(type, d, code);
  const counters = readStore('counters', {});
  const next = (counters[key] || 0) + 1;
  counters[key] = next;
  writeStore('counters', counters);
  return next;
}

function buildNumber(format, type, dateStr, clientCode, seq, prefix = 'PSE') {
  const fmt = FORMATS[format] || FORMATS.standard;
  const d = getDateParts(dateStr);
  const code = sanitizeCode(clientCode);
  const builder = type === 'quotation' ? fmt.quo : fmt.inv;
  return builder(prefix, code, d, seq);
}

function peekDocNumber(format, type, dateStr, clientCode, prefix = 'PSE') {
  return buildNumber(format, type, dateStr, clientCode, peekCounter(format, type, dateStr, clientCode), prefix);
}

function assignDocNumber(format, type, dateStr, clientCode, prefix = 'PSE') {
  return buildNumber(format, type, dateStr, clientCode, commitCounter(format, type, dateStr, clientCode), prefix);
}

module.exports = { peekDocNumber, assignDocNumber, sanitizeCode, getDateParts };
