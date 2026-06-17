# Deploy PSE — Vercel + Supabase (FREE)

> **RM 0/bulan** — Vercel Hobby (free) + Supabase Free tier (500MB)

---

## Langkah 1: Setup Supabase (Database)

1. Daftar **[supabase.com](https://supabase.com)** (free)
2. **New Project** → nama: `pse-system` → pilih region **Singapore** (terdekat)
3. Tunggu project siap (~2 minit)
4. Pergi **SQL Editor** → **New query**
5. Copy **semua** kandungan fail `supabase/schema-vercel.sql` → paste → **Run**
6. Pergi **Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret!) → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ Jangan kongsi `service_role` key dengan sesiapa. Key ini hanya untuk server.

---

## Langkah 2: Upload ke GitHub

1. Buat repo baru di [github.com](https://github.com) → `pse-quotation-invoice`
2. Upload semua fail projek (**kecuali** `node_modules/`, `data/`, `.env`)
3. Atau guna git:
   ```bash
   git add .
   git commit -m "PSE System v3.1 Vercel+Supabase"
   git remote add origin https://github.com/USERNAME/pse-quotation-invoice.git
   git push -u origin master
   ```

---

## Langkah 3: Deploy Vercel

1. Daftar **[vercel.com](https://vercel.com)** → login dengan GitHub
2. **Add New → Project**
3. Import repo `pse-quotation-invoice`
4. **Environment Variables** — tambah:

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | `https://xxxxx.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` (service_role) |
   | `SESSION_SECRET` | string random panjang (cth: `pse-secret-abc123xyz789`) |
   | `NODE_ENV` | `production` |

5. Klik **Deploy** → tunggu ~2 minit
6. URL anda: `https://pse-quotation-invoice.vercel.app`

---

## Langkah 4: Tukar Password

Selepas deploy, tukar password admin dalam Supabase:

1. Supabase → **Table Editor** → `admin_users`
2. Edit row `admin` → tukar `password_hash` ke kata laluan baru
3. Atau run SQL:
   ```sql
   UPDATE admin_users SET password_hash = 'kata-laluan-baru' WHERE username = 'admin';
   ```

---

## Log Masuk

| | |
|---|---|
| URL | `https://your-app.vercel.app` |
| Username | `admin` |
| Password | `pse2026` (tukar selepas deploy!) |

---

## Test Local (Optional)

```bash
npm install
# Buat .env.local:
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
# SESSION_SECRET=local-dev-secret
npx vercel dev
```

Buka http://localhost:3000

---

## Struktur Cloud

```
Browser (Vercel CDN)
    ↓
Vercel Serverless API (/api/*)
    ↓
Supabase PostgreSQL (database cloud)
    ↓
Data kekal — accessible dari mana-mana peranti
```

---

## Had Free Tier

| | Supabase Free | Vercel Free |
|--|---------------|-------------|
| Storage | 500 MB | - |
| Bandwidth | 5 GB/bulan | 100 GB/bulan |
| Projects | 2 | Unlimited |
| Pause | After 1 week inactive | Never |

> Supabase project **pause** selepas 1 minggu tiada aktiviti — buka dashboard untuk wake up.

---

## Troubleshooting

| Masalah | Penyelesaian |
|---------|-------------|
| 500 error API | Semak env variables Vercel |
| Login gagal | Semak `admin_users` table ada data |
| Nombor duplicate | Pastikan SQL `increment_counter` function dah run |
| Session logout sendiri | Pastikan `SESSION_SECRET` diset |

---

*Pillar Stride Enterprise — v3.1 Vercel + Supabase*
