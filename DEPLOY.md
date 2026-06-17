# Deploy PSE System Online

## Pilihan 1: Render.com (Disyorkan)

**Kos:** ~USD 7/bulan (Starter + Disk 1GB) — data kekal, tidak hilang bila restart.

### Langkah

1. **Cipta akaun** [render.com](https://render.com) (login dengan GitHub/Google)

2. **Upload code ke GitHub**
   - Buat repo baru di github.com (contoh: `pse-quotation-invoice`)
   - Upload semua fail projek (kecuali `node_modules/` dan `data/`)

3. **Deploy di Render**
   - Dashboard → **New +** → **Blueprint**
   - Connect repo GitHub
   - Render baca `render.yaml` automatik
   - Set **ADMIN_PASSWORD** bila diminta (kata laluan kuat!)
   - Klik **Apply**

4. **Selesai** — URL seperti: `https://pse-quotation-invoice.onrender.com`

---

## Pilihan 2: Railway.app

1. Daftar [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub**
3. Set environment variables:
   ```
   NODE_ENV=production
   SESSION_SECRET=<random string>
   ADMIN_PASSWORD=<kata laluan anda>
   DATA_DIR=/app/data
   ```
4. Tambah **Volume** mount ke `/app/data` (penting!)

---

## Pilihan 3: VPS (Oracle Cloud Free / DigitalOcean)

```bash
# Di server Linux
git clone <repo-url>
cd pse-quotation-invoice
npm install
export NODE_ENV=production
export SESSION_SECRET=your-secret
export ADMIN_PASSWORD=your-password
npm start

# Atau guna Docker
docker build -t pse-system .
docker run -d -p 3000:3000 -v pse-data:/app/data \
  -e SESSION_SECRET=xxx -e ADMIN_PASSWORD=xxx pse-system
```

Guna **nginx** + **Let's Encrypt** untuk HTTPS.

---

## Pilihan 4: Akses Pantas (Ujian Sahaja)

Tunnel tanpa deploy penuh — URL temporary:

```bash
# Pastikan npm start dah jalan, kemudian:
npx cloudflared tunnel --url http://localhost:3000
```

Dapat URL `*.trycloudflare.com` — sesuai demo, bukan production.

---

## Environment Variables (Production)

| Variable | Wajib | Penerangan |
|----------|-------|------------|
| `NODE_ENV` | Ya | `production` |
| `SESSION_SECRET` | Ya | String random 32+ aksara |
| `ADMIN_PASSWORD` | Ya | Kata laluan log masuk |
| `ADMIN_USERNAME` | Tidak | Default: `admin` |
| `DATA_DIR` | Ya* | Path simpanan data (*wajib jika guna disk/volume) |
| `PORT` | Auto | Platform set automatik |

---

## Selepas Deploy

1. Buka URL website
2. Log masuk dengan username/password production
3. **Export backup** dari Tetapan → simpan ke Google Drive
4. Buat backup mingguan

---

## Nota Penting

- **Tanpa persistent disk**, data akan hilang bila server restart
- **render.yaml** dah include disk 1GB (Starter plan)
- Tukar password default sebelum kongsi URL dengan orang lain
