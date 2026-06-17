/**
 * PSE System Configuration
 * Tukar syncProvider bila ready untuk cloud (Fasa 3+)
 */
const PSEConfig = {
  appVersion: '2.1.0',
  phase: 2,

  company: {
    id: 'pse-main',
    name: 'Pillar Stride Enterprise'
  },

  // 'local' | 'supabase' | 'google-drive' (Fasa 3–4)
  syncProvider: 'local',

  supabase: {
    url: '',           // Isi bila daftar Supabase
    anonKey: '',       // Public anon key
    enabled: false
  },

  googleDrive: {
    enabled: false,
    folderId: '',      // ID folder PSE-Dokumen dalam Drive
    clientId: ''       // OAuth client ID (Fasa 4)
  },

  features: {
    autoPdfOnFinalize: true,
    autoZipOnFinalize: false,
    weeklyBackupReminder: true,
    dashboard: true,
    versionControl: true
  },

  paths: {
    driveRoot: 'PSE-Dokumen',
    backup: 'PSE-Dokumen/backup',
    quotation: 'PSE-Dokumen/sebutharga',
    invoice: 'PSE-Dokumen/invois'
  },

  phases: [
    { id: 1, name: 'Asas Tempatan', status: 'done', desc: 'App web, nombor, versioning, backup JSON' },
    { id: 2, name: 'Dokument & Backup', status: 'active', desc: 'PDF auto, export ZIP folder, dashboard' },
    { id: 3, name: 'Cloud Sync', status: 'planned', desc: 'Supabase — sync multi-peranti' },
    { id: 4, name: 'Google Drive & Hantar', status: 'planned', desc: 'Auto-upload Drive, WhatsApp/email' },
    { id: 5, name: 'e-Invoice LHDN', status: 'planned', desc: 'MyInvois, SST penuh, laporan akauntan' }
  ]
};
