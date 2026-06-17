/**
 * PSE Sync Layer — sedia untuk Local → Supabase → Google Drive
 * Semua operasi sync melalui modul ini supaya mudah upgrade Fasa 3–4
 */
const PSESync = (() => {
  let lastSyncAt = null;
  let syncStatus = 'local';

  function getDrivePath(docType, docNumber) {
    const base = docType === 'quotation'
      ? PSEConfig.paths.quotation
      : PSEConfig.paths.invoice;
    return `${base}/${docNumber}`;
  }

  function buildVersionFilename(docNumber, version, ext = 'json') {
    const date = new Date().toISOString().slice(0, 10);
    const safe = docNumber.replace(/[/\\]/g, '-');
    return `${safe}/v${version}-${date}.${ext}`;
  }

  function exportDocumentVersion(docNumber, version, snapshot) {
    const folder = PSEStorage.getDocFolder(docNumber);
    if (!folder) return null;

    const path = getDrivePath(snapshot.docType, docNumber);
    const filename = buildVersionFilename(docNumber, version, 'json');

    return {
      drivePath: path,
      relativePath: `${path}/${filename.split('/').pop()}`,
      filename: filename.split('/').pop(),
      docNumber,
      version,
      exportedAt: new Date().toISOString(),
      data: snapshot
    };
  }

  function downloadJsonFile(relativePath, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = relativePath.replace(/\//g, '_');
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onDocumentFinalized(docNumber, version, snapshot) {
    const exportMeta = exportDocumentVersion(docNumber, version, snapshot);
    const settings = PSEStorage.loadSettings();
    const log = settings.syncLog || [];

    log.unshift({
      action: 'finalize',
      docNumber,
      version,
      drivePath: exportMeta.drivePath,
      at: exportMeta.exportedAt,
      provider: PSEConfig.syncProvider
    });

    PSEStorage.saveSettings({
      ...settings,
      syncLog: log.slice(0, 100),
      lastFinalize: exportMeta.exportedAt
    });

    if (PSEConfig.features.autoZipOnFinalize) {
      await exportFolderZip(docNumber);
    }

    if (PSEConfig.syncProvider === 'supabase' && PSEConfig.supabase.enabled) {
      return syncToSupabase(exportMeta);
    }

    if (PSEConfig.syncProvider === 'google-drive' && PSEConfig.googleDrive.enabled) {
      return syncToGoogleDrive(exportMeta);
    }

    lastSyncAt = exportMeta.exportedAt;
    syncStatus = 'local';
    return { ok: true, provider: 'local', exportMeta };
  }

  async function syncToSupabase(exportMeta) {
    // Fasa 3 — placeholder sehingga API key diisi
    if (!PSEConfig.supabase.url) {
      console.warn('[PSESync] Supabase belum dikonfigurasi. Lihat supabase/schema.sql & PLAN.md');
      return { ok: false, reason: 'supabase_not_configured' };
    }
    /* Implementasi Fasa 3:
    const { data, error } = await supabase.from('document_versions').upsert({...});
    */
    return { ok: false, reason: 'supabase_pending' };
  }

  async function syncToGoogleDrive(exportMeta) {
    // Fasa 4 — placeholder sehingga OAuth setup
    console.warn('[PSESync] Google Drive sync — Fasa 4. Export manual ke Drive dahulu.');
    return { ok: false, reason: 'gdrive_pending' };
  }

  async function exportFolderZip(docNumber) {
    if (typeof JSZip === 'undefined') {
      console.warn('[PSESync] JSZip tidak dimuatkan.');
      return;
    }

    const folder = PSEStorage.getDocFolder(docNumber);
    if (!folder) return;

    const zip = new JSZip();
    const typeFolder = folder.type === 'quotation' ? 'sebutharga' : 'invois';
    const root = zip.folder(`PSE-Dokumen/${typeFolder}/${docNumber.replace(/[/\\]/g, '-')}`);

    folder.versions.forEach(v => {
      const date = (v.savedAt || '').slice(0, 10);
      root.file(`v${v.version}-${date}.json`, JSON.stringify(v, null, 2));
    });

    root.file('_meta.json', JSON.stringify({
      docNumber,
      type: folder.type,
      clientName: folder.clientName,
      latestVersion: folder.latestVersion,
      updatedAt: folder.updatedAt
    }, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${docNumber.replace(/[/\\]/g, '-')}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportAllFoldersZip() {
    if (typeof JSZip === 'undefined') {
      alert('JSZip belum dimuatkan. Refresh halaman.');
      return;
    }

    const docs = PSEStorage.loadDocuments();
    const zip = new JSZip();
    const root = zip.folder('PSE-Dokumen');

    root.file('backup/PSE-full-backup.json', JSON.stringify(PSEStorage.exportBackup(), null, 2));

    Object.entries(docs).forEach(([docNumber, folder]) => {
      const typeFolder = folder.type === 'quotation' ? 'sebutharga' : 'invois';
      const safe = docNumber.replace(/[/\\]/g, '-');
      const docFolder = root.folder(`${typeFolder}/${safe}`);

      folder.versions.forEach(v => {
        const date = (v.savedAt || '').slice(0, 10);
        docFolder.file(`v${v.version}-${date}.json`, JSON.stringify(v, null, 2));
      });
      docFolder.file('_meta.json', JSON.stringify({
        docNumber, type: folder.type, latestVersion: folder.latestVersion
      }, null, 2));
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PSE-Dokumen-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function getSyncLog() {
    return PSEStorage.loadSettings().syncLog || [];
  }

  function getStatus() {
    const settings = PSEStorage.loadSettings();
    return {
      provider: PSEConfig.syncProvider,
      phase: PSEConfig.phase,
      lastFinalize: settings.lastFinalize || null,
      documentCount: Object.keys(PSEStorage.loadDocuments()).length,
      syncLog: (settings.syncLog || []).slice(0, 5)
    };
  }

  function renderDashboard() {
    const el = document.getElementById('systemDashboard');
    if (!el) return;

    const status = getStatus();
    const docs = PSEStorage.listDocuments();
    const quo = docs.filter(d => d.type === 'quotation').length;
    const inv = docs.filter(d => d.type === 'invoice').length;
    const totalValue = docs.reduce((s, d) => s + (d.total || 0), 0);

    const phasesHtml = PSEConfig.phases.map(p => {
      const cls = p.status === 'done' ? 'phase-done' : p.status === 'active' ? 'phase-active' : 'phase-planned';
      const icon = p.status === 'done' ? '✅' : p.status === 'active' ? '🔄' : '⏳';
      return `<div class="phase-item ${cls}"><span>${icon} Fasa ${p.id}</span><strong>${p.name}</strong><small>${p.desc}</small></div>`;
    }).join('');

    el.innerHTML = `
      <div class="dash-stats">
        <div class="dash-stat"><span>${docs.length}</span><label>Jumlah Dokumen</label></div>
        <div class="dash-stat"><span>${quo}</span><label>Sebutharga</label></div>
        <div class="dash-stat"><span>${inv}</span><label>Invois</label></div>
        <div class="dash-stat"><span>RM ${totalValue.toLocaleString('ms-MY', { minimumFractionDigits: 0 })}</span><label>Nilai Dokumen</label></div>
      </div>
      <div class="dash-sync">
        <p><strong>Sync:</strong> ${status.provider} · Fasa ${status.phase} · ${status.documentCount} folder</p>
        ${status.lastFinalize ? `<p class="hint">Terakhir disahkan: ${new Date(status.lastFinalize).toLocaleString('ms-MY')}</p>` : ''}
      </div>
      <div class="phase-roadmap">${phasesHtml}</div>
      <p class="hint dash-tip">💡 Upload ZIP ke Google Drive folder <code>PSE-Dokumen/</code> — rujuk PLAN.md</p>`;
  }

  function triggerAutoPrint() {
    if (!PSEConfig.features.autoPdfOnFinalize) return;
    setTimeout(() => window.print(), 400);
  }

  return {
    onDocumentFinalized,
    exportFolderZip,
    exportAllFoldersZip,
    exportDocumentVersion,
    downloadJsonFile,
    getDrivePath,
    getSyncLog,
    getStatus,
    renderDashboard,
    triggerAutoPrint
  };
})();
