# PSE System — Sistem Sebutharga & Invois

Sistem web untuk **Pillar Stride Enterprise** — sebutharga & invois dalam Bahasa Melayu.

---

## 🚀 Setup Online (PERCUMA — Vercel + Supabase)

**Double-click:** `SETUP-ONLINE.bat`

Skrip ini akan:
1. Copy schema database ke clipboard
2. Buka Supabase untuk anda setup
3. Uji sambungan database
4. Import data tempatan (jika ada)
5. Deploy ke Vercel automatik

**Kos: RM 0/bulan**

| Log masuk | |
|-----------|---|
| Username | `admin` |
| Password | `pse2026` |

> Tukar password selepas deploy!

Panduan manual: **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)**

---

## 📱 iPhone / Offline (PWA)

Selepas deploy online:

1. Buka URL Vercel dalam **Safari** (bukan Chrome)
2. Log masuk sekali semasa ada internet (data disimpan pada telefon)
3. Kongsi → **Tambah ke Skrin Utama**
4. Buka ikon PSE dari skrin utama — boleh guna **tanpa internet**

Perubahan offline akan sync automatik bila telefon ada internet semula.

> Kali pertama mesti online. Reset Safari / padam data laman = perlu log masuk online lagi.

---

## 💻 Guna Tempatan (Offline PC)

```bash
npm install
npm start
```

Buka: **http://localhost:3000**

Atau double-click `start.bat`

---

## Apa Yang Boleh Anda Lakukan

- **Sebutharga** — auto nombor `PSE-QUO-2026-0001`
- **Invois** — auto nombor `PSE-INV-2026-0001`
- **Versi dokumen** — edit tanpa tukar nombor rujukan
- **Arkib** — folder ikut no. rujukan
- **Pelanggan** — simpan template pelanggan
- **Backup** — export/import JSON
- **Cetak PDF** — Save as PDF dari browser
- **PWA iPhone** — tambah ke skrin utama, guna offline

---

## Struktur Projek

```
├── api/              ← Vercel serverless API
├── lib/              ← Supabase, auth, numbering
├── public/           ← Website (login, app, PWA)
│   ├── sw.js         ← Service worker (offline shell)
│   ├── manifest.webmanifest
│   └── js/offline.js ← Cache & sync offline
├── supabase/         ← Database schema SQL
├── scripts/          ← Setup & migration scripts
├── SETUP-ONLINE.bat  ← Setup cloud (1-click)
├── server/           ← Local Express server (offline)
└── DEPLOY-VERCEL.md  ← Panduan deploy
```

---

## Deploy Semula

Double-click `DEPLOY-ONLINE.bat` (selepas setup pertama)

---

*Pillar Stride Enterprise — v3.2*
