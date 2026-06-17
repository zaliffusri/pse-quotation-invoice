/**
 * PSE Document Store — simpanan tempatan + versioning ikut no. rujukan
 * Struktur: setiap no. rujukan = "folder" dengan versi v1, v2, v3...
 */
const PSEStorage = (() => {
  const KEYS = {
    counters: 'pse_doc_counters',
    documents: 'pse_documents',
    clients: 'pse_clients',
    settings: 'pse_settings',
    draft: 'pse_working_draft'
  };

  function read(key, fallback = null) {
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

  function loadDocuments() {
    return read(KEYS.documents, {});
  }

  function saveDocuments(docs) {
    write(KEYS.documents, docs);
  }

  function loadCounters() {
    return read(KEYS.counters, {});
  }

  function saveCounters(counters) {
    write(KEYS.counters, counters);
  }

  function loadSettings() {
    return read(KEYS.settings, { numberFormat: 'standard' });
  }

  function saveSettings(settings) {
    write(KEYS.settings, settings);
  }

  function loadDraft() {
    return read(KEYS.draft, null);
  }

  function saveDraft(draft) {
    write(KEYS.draft, draft);
  }

  function clearDraft() {
    localStorage.removeItem(KEYS.draft);
  }

  function getDocFolder(docNumber) {
    const docs = loadDocuments();
    return docs[docNumber] || null;
  }

  function listDocuments(type = null) {
    const docs = loadDocuments();
    return Object.entries(docs)
      .map(([docNumber, folder]) => ({
        docNumber,
        type: folder.type,
        clientName: folder.clientName,
        latestVersion: folder.latestVersion,
        updatedAt: folder.updatedAt,
        total: folder.versions[folder.latestVersion - 1]?.total || 0
      }))
      .filter(d => !type || d.type === type)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function saveVersion(docNumber, snapshot) {
    const docs = loadDocuments();
    const now = new Date().toISOString();

    if (!docs[docNumber]) {
      docs[docNumber] = {
        type: snapshot.docType,
        clientName: snapshot.clientName || '',
        createdAt: now,
        updatedAt: now,
        latestVersion: 0,
        versions: []
      };
    }

    const folder = docs[docNumber];
    const version = folder.latestVersion + 1;
    folder.latestVersion = version;
    folder.updatedAt = now;
    folder.clientName = snapshot.clientName || folder.clientName;
    folder.type = snapshot.docType;
    folder.versions.push({
      version,
      savedAt: now,
      label: `v${version}`,
      ...snapshot
    });

    saveDocuments(docs);
    return version;
  }

  function getVersion(docNumber, version = null) {
    const folder = getDocFolder(docNumber);
    if (!folder) return null;
    const v = version ?? folder.latestVersion;
    return folder.versions.find(x => x.version === v) || null;
  }

  function getVersionList(docNumber) {
    const folder = getDocFolder(docNumber);
    if (!folder) return [];
    return folder.versions.map(v => ({
      version: v.version,
      savedAt: v.savedAt,
      total: v.total,
      clientName: v.clientName,
      docDate: v.docDate
    }));
  }

  function resetCounters() {
    saveCounters({});
  }

  function resetAllData(keepClients = true) {
    resetCounters();
    saveDocuments({});
    clearDraft();
    if (!keepClients) {
      localStorage.removeItem(KEYS.clients);
    }
  }

  function exportBackup() {
    return {
      exportedAt: new Date().toISOString(),
      app: 'PSE Quotation Invoice',
      version: '2.0',
      counters: loadCounters(),
      documents: loadDocuments(),
      clients: read(KEYS.clients, []),
      settings: loadSettings()
    };
  }

  function importBackup(data) {
    if (!data || !data.documents) throw new Error('Fail backup tidak sah.');
    if (data.counters) saveCounters(data.counters);
    saveDocuments(data.documents);
    if (data.clients) write(KEYS.clients, data.clients);
    if (data.settings) saveSettings(data.settings);
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PSE-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return {
    KEYS,
    read,
    write,
    loadDocuments,
    loadCounters,
    saveCounters,
    loadSettings,
    saveSettings,
    loadDraft,
    saveDraft,
    clearDraft,
    getDocFolder,
    listDocuments,
    saveVersion,
    getVersion,
    getVersionList,
    resetCounters,
    resetAllData,
    exportBackup,
    importBackup,
    downloadBackup
  };
})();
