# 🚀 Panduan Deployment — WhatsApp CRM (Bare Metal Linux)

Panduan lengkap untuk deploy WhatsApp CRM ke server **Ubuntu/Debian** tanpa Docker.

---

## 📋 Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Persiapan Server](#2-persiapan-server)
3. [Install Dependencies](#3-install-dependencies)
4. [Upload Project](#4-upload-project)
5. [Konfigurasi Database](#5-konfigurasi-database)
6. [Konfigurasi Environment](#6-konfigurasi-environment)
7. [Build & Jalankan](#7-build--jalankan)
8. [Setup Nginx Reverse Proxy](#8-setup-nginx-reverse-proxy)
9. [SSL Certificate (HTTPS)](#9-ssl-certificate-https)
10. [Systemd Service (Auto-Start)](#10-systemd-service-auto-start)
11. [Konfigurasi Meta Webhook](#11-konfigurasi-meta-webhook)
12. [Monitoring & Maintenance](#12-monitoring--maintenance)
13. [Troubleshooting](#13-troubleshooting)
14. [Multi-Tenant: Cara Menambah Organisasi Baru](#14-multi-tenant-cara-menambah-organisasi-baru)

---

## 1. Prasyarat

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| **OS** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS |
| **RAM** | 2 GB | 4 GB |
| **CPU** | 1 vCPU | 2 vCPU |
| **Disk** | 20 GB SSD | 40 GB SSD |
| **Domain** | ✅ Diperlukan (untuk SSL + Meta Webhook) | — |
| **Port Terbuka** | 80, 443, 22 | — |

### Software yang akan diinstall:
- **Bun** (JavaScript runtime — menggantikan Node.js)
- **Node.js 20+** (untuk SvelteKit production server)
- **MySQL 8.0+** (database utama)
- **Redis 7+** (message queue & cache)
- **Nginx** (reverse proxy & SSL termination)

---

## 2. Persiapan Server

```bash
# Login ke server
ssh root@IP_SERVER_ANDA

# Update system packages
sudo apt update && sudo apt upgrade -y

# Buat user khusus untuk aplikasi (jangan jalankan sebagai root)
sudo adduser wacrm
sudo usermod -aG sudo wacrm

# Pindah ke user baru
su - wacrm
```

---

## 3. Install Dependencies

### A. Install Bun

```bash
# Install unzip (diperlukan installer Bun)
sudo apt update && sudo apt install -y unzip

# Install Bun runtime
curl -fsSL https://bun.sh/install | bash

# Reload shell
source ~/.bashrc

# Verifikasi
bun --version
```

### B. Install Node.js 20 (untuk SvelteKit production)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi
node --version   # → v20.x.x
npm --version
```

### C. Install MySQL 8.0

```bash
sudo apt install -y mysql-server

# Jalankan security setup
sudo mysql_secure_installation
# → Set root password
# → Remove anonymous users: Y
# → Disallow root login remotely: Y
# → Remove test database: Y
# → Reload privilege tables: Y

# Buat database dan user
sudo mysql -u root -p
```

```sql
-- Di dalam MySQL shell:
CREATE DATABASE wa_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wacrm'@'localhost' IDENTIFIED BY 'PASSWORD_ANDA_DISINI';
GRANT ALL PRIVILEGES ON wa_crm.* TO 'wacrm'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### D. Install Redis

```bash
sudo apt install -y redis-server

# Edit konfigurasi (opsional: set password)
sudo nano /etc/redis/redis.conf
# Cari baris `# requirepass foobared` lalu ubah menjadi:
# requirepass PASSWORD_REDIS_ANDA

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Verifikasi
redis-cli ping   # → PONG
```

### E. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## 4. Upload Project

### Opsi A: Git Clone (Rekomendasi)

```bash
cd /home/wacrm
git clone https://github.com/USERNAME/wa_official.git
cd wa_official
```

### Opsi B: Upload Manual via SCP

```bash
# Dari komputer lokal Anda:
scp -r ./wa_official wacrm@IP_SERVER:/home/wacrm/
```

### Install Dependencies

```bash
# Backend
cd /home/wacrm/wa_official/be
bun install

# Frontend
cd /home/wacrm/wa_official/fe
bun install
```

---

## 5. Konfigurasi Database

Jalankan Drizzle migration untuk membuat tabel-tabel di MySQL:

```bash
cd /home/wacrm/wa_official/be

# Buat file .env dulu (lihat langkah 6), lalu jalankan:
bun run db:push

# Atau jika ingin generate migration SQL dan apply manual:
bun run db:generate
bun run db:migrate
```

### (Opsional) Jalankan Seed Data

```bash
bun run db:seed
```

> Ini akan membuat organisasi demo, user admin/supervisor/agent dengan password `admin12345`.

---

## 6. Konfigurasi Environment

### Backend `.env`

```bash
cd /home/wacrm/wa_official/be
cp .env.example .env
nano .env
```

Edit isinya sesuai server Anda:

```env
# ===========================================
# PRODUCTION Environment
# ===========================================

# Server
PORT=3000
NODE_ENV=production

# CORS — isi domain frontend Anda
CORS_ORIGIN=https://crm.domainanda.com

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=wacrm
DB_PASSWORD=PASSWORD_MYSQL_ANDA
DB_NAME=wa_crm

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=PASSWORD_REDIS_ANDA

# JWT — WAJIB ganti! Gunakan random string minimal 32 karakter
# Generate dengan: openssl rand -hex 32
JWT_SECRET=GANTI_DENGAN_RANDOM_STRING_32_CHAR
JWT_EXPIRES_IN=7d

# Meta WhatsApp Cloud API
META_APP_ID=ID_APP_DARI_META_DEVELOPER
META_APP_SECRET=SECRET_APP_DARI_META_DEVELOPER
META_ACCESS_TOKEN=TOKEN_SYSTEM_USER_DARI_META
META_PHONE_NUMBER_ID=ID_PHONE_NUMBER_DARI_META
META_WABA_ID=ID_WABA_DARI_META
META_WEBHOOK_VERIFY_TOKEN=TOKEN_VERIFIKASI_CUSTOM_ANDA
META_API_VERSION=v20.0

# Object Storage (opsional, untuk media WhatsApp)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=wa-crm-media
S3_REGION=us-east-1
```

### Generate JWT Secret

```bash
openssl rand -hex 32
# Output contoh: a3f8b1c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
```

### Frontend `.env` (opsional)

```bash
cd /home/wacrm/wa_official/fe
nano .env
```

```env
# Jika backend dan frontend di domain yang sama via Nginx proxy,
# tidak perlu diisi (default /api/v1 sudah benar)
# PUBLIC_API_URL=https://crm.domainanda.com/api/v1

# Sembunyikan demo login shortcuts
PUBLIC_HIDE_DEMO=true
```

---

## 7. Build & Jalankan

### A. Test Backend

```bash
cd /home/wacrm/wa_official/be
bun run start
```

Jika berhasil, akan muncul:
```
╔════════════════════════════════════════════╗
║     🟢 WhatsApp CRM API Server            ║
║     📍 http://localhost:3000              ║
║     🔧 Environment: production            ║
╚════════════════════════════════════════════╝
✅ Environment loaded (production)
✅ MySQL connected → localhost:3306/wa_crm
✅ Redis connected → localhost:6379
```

Tekan `Ctrl+C` untuk stop (nanti kita jalankan via systemd).

### B. Build Frontend

```bash
cd /home/wacrm/wa_official/fe
bun run build
```

Hasil build akan ada di folder `build/`. Test jalankan:

```bash
PORT=3001 HOST=127.0.0.1 node build/index.js
```

Tekan `Ctrl+C` untuk stop.

---

## 8. Setup Nginx Reverse Proxy

```bash
# Copy konfigurasi Nginx
sudo cp /home/wacrm/wa_official/nginx/wa-crm.conf /etc/nginx/sites-available/wa-crm

# Edit domain
sudo nano /etc/nginx/sites-available/wa-crm
# Ganti semua `crm.domainanda.com` dengan domain Anda

# Aktifkan site
sudo ln -s /etc/nginx/sites-available/wa-crm /etc/nginx/sites-enabled/

# Hapus default site (opsional)
sudo rm /etc/nginx/sites-enabled/default

# Test konfigurasi
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Tes Akses

Pastikan DNS domain Anda sudah mengarah ke IP server. Buka di browser:

```
http://crm.domainanda.com
```

---

## 9. SSL Certificate (HTTPS)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d crm.domainanda.com

# Ikuti instruksi:
# → Masukkan email
# → Agree to terms: Y
# → Redirect HTTP to HTTPS: 2 (Yes)

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot akan otomatis mengubah konfigurasi Nginx untuk menambahkan SSL.

### Auto-Renewal (Sudah otomatis via cron)

```bash
# Verifikasi timer sudah aktif
sudo systemctl status certbot.timer
```

---

## 10. Systemd Service (Auto-Start)

Agar backend dan frontend otomatis jalan saat server reboot:

### A. Backend Service

```bash
# Copy service file
sudo cp /home/wacrm/wa_official/systemd/wa-crm-backend.service /etc/systemd/system/

# Edit path jika berbeda
sudo nano /etc/systemd/system/wa-crm-backend.service
# Pastikan WorkingDirectory dan ExecStart sesuai

# Reload dan aktifkan
sudo systemctl daemon-reload
sudo systemctl enable wa-crm-backend
sudo systemctl start wa-crm-backend

# Cek status
sudo systemctl status wa-crm-backend
```

### B. Frontend Service

```bash
# Copy service file
sudo cp /home/wacrm/wa_official/systemd/wa-crm-frontend.service /etc/systemd/system/

# Edit domain di Environment=ORIGIN
sudo nano /etc/systemd/system/wa-crm-frontend.service
# Ganti https://crm.domainanda.com dengan domain Anda

# Reload dan aktifkan
sudo systemctl daemon-reload
sudo systemctl enable wa-crm-frontend
sudo systemctl start wa-crm-frontend

# Cek status
sudo systemctl status wa-crm-frontend
```

### Perintah Berguna

```bash
# Lihat log realtime
sudo journalctl -u wa-crm-backend -f
sudo journalctl -u wa-crm-frontend -f

# Restart service
sudo systemctl restart wa-crm-backend
sudo systemctl restart wa-crm-frontend

# Stop service
sudo systemctl stop wa-crm-backend
sudo systemctl stop wa-crm-frontend
```

---

## 11. Konfigurasi Meta Webhook

Setelah server berjalan dan SSL aktif, konfigurasi webhook di Meta Developer Dashboard:

1. Buka https://developers.facebook.com → App Anda → WhatsApp → Configuration
2. Isi **Callback URL**:
   ```
   https://crm.domainanda.com/api/v1/webhook
   ```
3. Isi **Verify Token** sesuai `META_WEBHOOK_VERIFY_TOKEN` di `.env`
4. Klik **Verify and Save**
5. Subscribe ke events:
   - `messages`
   - `message_template_status_update`

### Test Webhook

```bash
# Dari server, test health endpoint:
curl https://crm.domainanda.com/health

# Test webhook verification:
curl "https://crm.domainanda.com/api/v1/webhook?hub.mode=subscribe&hub.verify_token=TOKEN_ANDA&hub.challenge=test123"
# Harus return: test123
```

---

## 12. Monitoring & Maintenance

### Lihat Log Aplikasi

```bash
# Backend log (realtime)
sudo journalctl -u wa-crm-backend -f --no-pager

# Frontend log
sudo journalctl -u wa-crm-frontend -f --no-pager

# Nginx access log
sudo tail -f /var/log/nginx/access.log

# Nginx error log
sudo tail -f /var/log/nginx/error.log
```

### Backup Database (Harian)

```bash
# Buat script backup
sudo nano /home/wacrm/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/wacrm/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

mysqldump -u wacrm -pPASSWORD_ANDA wa_crm | gzip > "$BACKUP_DIR/wa_crm_$DATE.sql.gz"

# Hapus backup lebih dari 30 hari
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "✅ Backup selesai: wa_crm_$DATE.sql.gz"
```

```bash
chmod +x /home/wacrm/backup-db.sh

# Jadwalkan backup harian jam 02:00
crontab -e
# Tambahkan baris:
0 2 * * * /home/wacrm/backup-db.sh >> /home/wacrm/backups/backup.log 2>&1
```

### Update Aplikasi

```bash
cd /home/wacrm/wa_official

# Pull update terbaru
git pull origin main

# Install dependencies baru
cd be && bun install
cd ../fe && bun install

# Build frontend
cd ../fe && bun run build

# Jalankan migration database (jika ada perubahan schema)
cd ../be && bun run db:push

# Restart services
sudo systemctl restart wa-crm-backend
sudo systemctl restart wa-crm-frontend
```

---

## 13. Troubleshooting

### ❌ Backend tidak bisa konek ke MySQL

```bash
# Cek MySQL berjalan
sudo systemctl status mysql

# Cek kredensial
mysql -u wacrm -p wa_crm -e "SELECT 1"

# Cek .env sudah benar
cat /home/wacrm/wa_official/be/.env | grep DB_
```

### ❌ Backend tidak bisa konek ke Redis

```bash
# Cek Redis berjalan
sudo systemctl status redis-server

# Test koneksi
redis-cli ping

# Jika pakai password:
redis-cli -a PASSWORD_REDIS_ANDA ping
```

### ❌ Nginx 502 Bad Gateway

```bash
# Cek backend dan frontend berjalan
sudo systemctl status wa-crm-backend
sudo systemctl status wa-crm-frontend

# Cek port listening
ss -tlnp | grep -E '3000|3001'

# Restart jika perlu
sudo systemctl restart wa-crm-backend
sudo systemctl restart wa-crm-frontend
sudo systemctl restart nginx
```

### ❌ WebSocket tidak terkoneksi

```bash
# Pastikan Nginx proxy WebSocket dikonfigurasi (sudah ada di wa-crm.conf)
# Cek log backend untuk koneksi WS
sudo journalctl -u wa-crm-backend -f | grep "WS"
```

### ❌ Webhook Meta gagal verifikasi

```bash
# Test manual
curl "https://crm.domainanda.com/api/v1/webhook?hub.mode=subscribe&hub.verify_token=TOKEN_DI_ENV&hub.challenge=test"

# Pastikan:
# 1. SSL aktif (Meta WAJIB HTTPS)
# 2. Verify token di .env sama dengan yang di Meta Dashboard
# 3. Tidak ada firewall yang blokir port 443
```

### ❌ Bun: command not found (di systemd)

```bash
# Cari path bun
which bun

# Update ExecStart di service file dengan full path
sudo nano /etc/systemd/system/wa-crm-backend.service
# Ubah ExecStart=/usr/local/bin/bun menjadi path yang benar
# Biasanya: /home/wacrm/.bun/bin/bun

sudo systemctl daemon-reload
sudo systemctl restart wa-crm-backend
```

---

## 14. Multi-Tenant: Cara Menambah Organisasi Baru

WhatsApp CRM ini sudah mendukung **multi-tenant** secara penuh. Setiap organisasi memiliki data yang terisolasi.

### Cara 1: Via Halaman Registrasi (Self-Service)

1. Buka `https://crm.domainanda.com/register`
2. Pilih tab **"Buat Organisasi"**
3. Isi nama perusahaan, nama admin, email, password
4. User pertama otomatis menjadi **ADMINISTRATOR**

### Cara 2: Anggota Tim Bergabung

1. Administrator buka halaman **Manajemen Agen** di panel admin
2. Catat **ID Organisasi** yang tertera
3. Bagikan ID tersebut ke anggota tim
4. Anggota buka `https://crm.domainanda.com/register`
5. Pilih tab **"Gabung Organisasi"**
6. Masukkan ID organisasi + pilih role (Agent/Supervisor)

### Setiap Organisasi Baru Perlu:

- ✅ Konfigurasi WABA sendiri (via Admin → Pengaturan WABA)
- ✅ Menghubungkan nomor WhatsApp Business masing-masing
- ✅ Setiap organisasi menerima webhook dari nomor WA mereka sendiri

### Catatan Penting tentang Webhook Multi-Tenant

Meta mengirim semua webhook ke **satu URL endpoint yang sama**. Sistem backend akan secara otomatis menentukan organisasi mana yang harus menerima pesan berdasarkan `phone_number_id` yang terdaftar di database.

```
Webhook masuk → Resolve phone_number_id → Temukan organization_id → Proses pesan
```

Jadi **tidak perlu konfigurasi webhook terpisah per organisasi**. Cukup satu endpoint webhook untuk semua tenant.

---

## ✅ Checklist Deployment

- [ ] Server Ubuntu/Debian siap dengan RAM ≥ 2 GB
- [ ] Domain sudah mengarah ke IP server
- [ ] Bun, Node.js, MySQL, Redis, Nginx terinstall
- [ ] Project di-clone / di-upload ke `/home/wacrm/wa_official`
- [ ] `.env` backend sudah dikonfigurasi (terutama JWT_SECRET, DB, Redis)
- [ ] Database migration sudah dijalankan (`bun run db:push`)
- [ ] Frontend sudah di-build (`bun run build`)
- [ ] Nginx reverse proxy sudah aktif
- [ ] SSL certificate sudah terpasang (Certbot)
- [ ] Systemd service sudah enabled & running
- [ ] Meta webhook sudah dikonfigurasi dan terverifikasi
- [ ] Backup database sudah dijadwalkan
- [ ] Admin pertama sudah terdaftar via `/register`
