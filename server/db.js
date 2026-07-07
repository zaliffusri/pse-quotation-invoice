const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const FILES = {
  settings: path.join(dataDir, 'settings.json'),
  users: path.join(dataDir, 'users.json'),
  counters: path.join(dataDir, 'counters.json'),
  clients: path.join(dataDir, 'clients.json'),
  documents: path.join(dataDir, 'documents.json'),
  versions: path.join(dataDir, 'versions.json'),
  activity: path.join(dataDir, 'activity.json')
};

function readStore(name, fallback) {
  try {
    const file = FILES[name];
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeStore(name, data) {
  fs.writeFileSync(FILES[name], JSON.stringify(data, null, 2), 'utf8');
}

function getSetting(key, fallback = null) {
  const settings = readStore('settings', {});
  return settings[key] !== undefined ? settings[key] : fallback;
}

function setSetting(key, value) {
  const settings = readStore('settings', {});
  settings[key] = value;
  writeStore('settings', settings);
}

function logActivity(action, docNumber = null, meta = null) {
  const log = readStore('activity', []);
  log.unshift({ id: Date.now(), action, doc_number: docNumber, meta, created_at: new Date().toISOString() });
  writeStore('activity', log.slice(0, 200));
}

// Seed
(function seed() {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'pse2026';
  if (!readStore('users', []).length) {
    writeStore('users', [{ id: 1, username: adminUser, password_hash: adminPass, name: 'Administrator PSE' }]);
  }
  if (!getSetting('company')) {
    setSetting('company', {
      name: 'PILLAR STRIDE ENTERPRISE', regNo: '(TR0299805-M)', prefix: 'PSE',
      address: ['No. 27 Jalan Pinang Merah 4,', 'Taman Sayong Pinang, Bandar Tenggara', 'Kulai, Johor 81440'],
      email: 'zaliff2258@gmail.com', phone: '+60133663007',
      bank: { payee: 'PILLAR STRIDE ENTERPRISE', bankName: 'Maybank', accountNo: '5515 8407 8633' }
    });
  }
  if (!getSetting('numberFormat')) setSetting('numberFormat', 'standard');
  if (!getSetting('products')) {
    setSetting('products', [
      { id: 'ps5-basic', name: 'PS5 Basic Package (1 hari)', price: 50, category: 'rental' },
      { id: 'controller', name: 'Tambahan Controller', price: 15, category: 'addon' },
      { id: 'hdmi', name: 'Tambahan HDMI Cable', price: 10, category: 'addon' }
    ]);
  }
  if (!getSetting('units')) {
    setSetting('units', [
      { id: 'ps5-1', name: 'PS5 Unit #1', active: true },
      { id: 'ps5-2', name: 'PS5 Unit #2', active: true },
      { id: 'ps5-3', name: 'PS5 Unit #3', active: true }
    ]);
  }
  if (!getSetting('promos')) {
    setSetting('promos', [
      { id: 'promo-wknd', name: 'Promo Weekend -10%', type: 'percent', value: 10 },
      { id: 'promo-member', name: 'Member -RM5', type: 'fixed', value: 5 },
      { id: 'promo-bundle', name: 'Bundle 3 Hari -RM20', type: 'fixed', value: 20 }
    ]);
  }
  if (!readStore('clients', []).length) {
    writeStore('clients', [{
      id: 'kosiswa', code: 'KOSISWA', name: 'KOSISWA UTHM',
      client_name: 'KOSISWA UTHM — Universiti Tun Hussein Onn Malaysia (UTHM)',
      client_attn: 'Pn. Mimi', client_address: '86400 Parit Raja\nBatu Pahat, Johor\nMalaysia',
      client_phone: '60179863173', client_email: 'miminuraleeya94@gmail.com'
    }]);
  }
  if (!readStore('documents', null)) writeStore('documents', {});
  if (!readStore('versions', null)) writeStore('versions', []);
  if (!readStore('counters', null)) writeStore('counters', {});
  if (!readStore('activity', null)) writeStore('activity', []);
})();

module.exports = { readStore, writeStore, getSetting, setSetting, logActivity, FILES };
