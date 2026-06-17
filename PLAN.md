# Pelan Jangka Panjang — PSE Sebutharga & Invois

> **Visi:** Satu sistem terpusat untuk Pillar Stride Enterprise — buat, edit, version, backup, dan hantar sebutharga/invois dari mana-mana peranti, sedia untuk audit LHDN & e-Invoice.

---

## Ringkasan Fasa

| Fasa | Tempoh | Fokus | Kos anggaran |
|------|--------|-------|--------------|
| **Fasa 1** ✅ | Selesai | App web tempatan, auto nombor, versioning, backup JSON | Percuma |
| **Fasa 2** | 1–2 bulan | PDF auto, export folder, dashboard ringkas | Percuma |
| **Fasa 3** | 2–4 bulan | Cloud sync (Supabase), login, multi-peranti | ~RM0–50/bulan |
| **Fasa 4** | 4–6 bulan | Google Drive auto-sync, WhatsApp/email hantar | ~RM0–30/bulan |
| **Fasa 5** | 6–12 bulan | e-Invoice LHDN (MyInvois), SST penuh, laporan akaun | Ikut LHDN |

---

## Fasa 1 — Asas Tempatan ✅ (SIAP)

**Yang dah ada:**
- Generator sebutharga & invois (BM)
- Auto nombor dengan kawalan (sahkan dulu, baru counter)
- Versioning ikut no. rujukan (v1, v2, v3…)
- Template pelanggan
- Export / import backup JSON
- Reset counter

**Had semasa:**
- Data hanya dalam browser PC ini
- Tiada sync antara laptop/telefon
- PDF manual (cetak → Save as PDF)

---

## Fasa 2 — Dokument & Backup Pintar (SEKARANG)

**Objektif:** Setiap dokumen disahkan = fail tersusun automatik, senang upload ke Google Drive.

### Struktur folder (mirror Google Drive)

```
PSE-Dokumen/
├── backup/
│   └── PSE-backup-2026-06-17.json
├── sebutharga/
│   └── PSE-QUO-2026-0003/
│       ├── v1-2026-06-14.json
│       ├── v2-2026-06-15.json
│       └── v2-2026-06-15.pdf
└── invois/
    └── PSE-INV-2026-0007/
        ├── v1-2026-06-17.json
        └── v1-2026-06-17.pdf
```

### Ciri yang dibina:
- [x] Export backup JSON penuh
- [x] Export folder ZIP ikut no. rujukan (Fasa 2)
- [x] Auto cetak PDF selepas sahkan (pilihan)
- [x] Dashboard status dokumen & tunggakan
- [ ] Reminder tarikh akhir bayar (notifikasi browser)

### Cara guna Google Drive (manual, percuma):
1. Cipta folder `PSE-Dokumen` dalam Google Drive
2. Selepas sahkan dokumen → tekan **Export Folder ZIP**
3. Upload ZIP ke folder Drive yang sepadan
4. Setiap Jumaat → **Export Backup** ke `PSE-Dokumen/backup/`

---

## Fasa 3 — Cloud Database (Supabase)

**Objektif:** Data sync automatik antara PC, laptop, telefon.

### Kenapa Supabase?
| | Supabase | Firebase | Google Sheets |
|--|----------|----------|---------------|
| Kos percuma | 500MB DB | 1GB | Percuma |
| SQL / audit | ✅ | ❌ | Sukar |
| Real-time sync | ✅ | ✅ | ❌ |
| Sesuai invois | ✅ | ✅ | ❌ |

### Schema database (rujuk `supabase/schema.sql`)

```
companies        → profil PSE
clients          → pelanggan
documents        → folder ikut doc_number
document_versions → v1, v2, v3…
counters         → nombor berterusan (server-side!)
payments         → status bayaran invois
users            → login pekerja (masa depan)
```

### Aliran sync:
```
Browser App  ←→  Supabase API  ←→  Browser App (PC lain)
                      ↓
                 Backup harian
```

### Langkah setup (bila ready):
1. Daftar [supabase.com](https://supabase.com) (percuma)
2. Import `supabase/schema.sql`
3. Isi API key dalam `js/config.js`
4. Tukar `syncProvider: 'supabase'` dalam config
5. Login dengan email PSE

**Kos:** Percuma sehingga ~500 dokumen/bulan. Pro ~$25/bulan jika perniagaan besar.

---

## Fasa 4 — Integrasi Google Drive & Hantar Dokumen

**Objektif:** Backup automatik + hantar terus ke pelanggan.

### 4a. Google Drive API (auto-sync)
- OAuth login Google sekali
- Selepas **Simpan & Sahkan** → auto upload JSON + PDF ke folder Drive
- Folder ikut no. rujukan (sama seperti struktur Fasa 2)

### 4b. Hantar dokumen
| Kaedah | Kesukaran | Kos |
|--------|-----------|-----|
| WhatsApp (link PDF Drive) | Mudah | Percuma |
| Email (Gmail API) | Sederhana | Percuma |
| WhatsApp Business API | Sukar | Berbayar |

### 4c. Notifikasi
- Email reminder invois overdue (7 hari sebelum due date)
- Dashboard: invois belum bayar, sebutharga pending

---

## Fasa 5 — e-Invoice LHDN & Akauntan

**Objektif:** Patuh undang-undang cukai Malaysia.

### MyInvois (LHDN)
- Integrasi API MyInvois apabila PSE wajib e-Invoice
- Validasi TIN pelanggan
- QR code validation LHDN pada invois PDF
- Consolidated invoice untuk B2C

### Modul akauntan
- Export CSV/Excel untuk pekerja akauntan
- Laporan: jualan bulanan, SST kollectible, aging report
- Link invois ↔ resit bayaran

### SST penuh
- SST 8% / 6% configurable
- Tax invoice vs normal invoice
- SST-02 report helper

---

## Carta Aliran Perniagaan (Target Akhir)

```
Pelanggan hubungi
      ↓
Buat Sebutharga (PSE-QUO-2026-00XX)
      ↓
Hantar PDF/WhatsApp
      ↓
Pelanggan setuju?
   ↙        ↘
 Tidak     Ya
   ↓         ↓
 Archive   Buat Invois (PSE-INV-2026-00XX)
              ↓
         Hantar + track due date
              ↓
         Bayaran diterima?
           ↙        ↘
        Tidak       Ya
          ↓          ↓
    Reminder    Mark LUNAS
                  ↓
            e-Invoice LHDN (Fasa 5)
                  ↓
            Export ke akauntan
```

---

## Keutamaan Cadangan

| # | Tindakan | Bila |
|---|----------|------|
| 1 | Guna sistem Fasa 1 harian | **Sekarang** |
| 2 | Export backup mingguan ke Google Drive | **Setiap Jumaat** |
| 3 | Aktifkan export ZIP + PDF auto | **Fasa 2 (siap)** |
| 4 | Daftar Supabase & setup sync | Bila guna 2+ peranti |
| 5 | Google Drive auto-sync | Bila dokumen > 20/bulan |
| 6 | MyInvois | Apabila LHDN wajibkan |

---

## Kos Jangka Panjang (Anggaran)

| Item | Bulanan | Tahunan |
|------|---------|---------|
| Supabase Free | RM 0 | RM 0 |
| Google Drive 15GB | RM 0 | RM 0 |
| Domain pse-system.com (optional) | ~RM 4 | ~RM 50 |
| Supabase Pro (jika perlu) | ~RM 110 | ~RM 1,320 |
| e-Invoice middleware | TBD | TBD |

**Untuk PSE sekarang: RM 0/bulan** dengan Fasa 1 + 2 + backup Drive manual.

---

## Fail Projek (Struktur Target)

```
Quotation and invoice PSE/
├── index.html              ← App utama
├── PLAN.md                 ← Dokumen ini
├── js/
│   ├── config.js           ← Tetapan & fasa
│   ├── storage.js          ← Simpanan tempatan
│   ├── sync.js             ← Sync adapter (local/supabase/drive)
│   └── app.js              ← UI & logic
├── supabase/
│   └── schema.sql          ← Schema cloud (Fasa 3)
├── assets/
│   └── logo.png
└── exports/                ← Folder export tempatan (auto)
```

---

*Kemaskini terakhir: Jun 2026 — Pillar Stride Enterprise*
