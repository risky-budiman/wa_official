# Blueprint & Roadmap Pengembangan WhatsApp CRM Platform (Meta Cloud API) - Revision: MySQL & Multi-Role RBAC

Dokumen ini merupakan panduan arsitektur komprehensif, skema sistem, kurikulum keahlian, dan *project roadmap* untuk membangun platform WhatsApp CRM & Omnichannel resmi berbasis **Meta WhatsApp Cloud API** menggunakan **Bun (Backend)**, **MySQL + Drizzle ORM (Database)**, serta **SvelteKit + TypeScript (Frontend)** dengan sistem **Multi-User Role-Based Access Control (RBAC)** berjenjang (`ADMINISTRATOR`, `SUPERVISOR`, `AGENT`).

---

## 1. Ikhtisar Arsitektur Sistem (High-Level Architecture)

```
                       ┌────────────────────────────────────────┐
                       │        Meta WhatsApp Cloud API         │
                       └────┬──────────────────────────────▲────┘
                            │ (Inbound Webhook Events)     │ (Outbound Messages/Templates)
                            ▼                              │
                 ┌───────────────────────┐                 │
                 │   Nginx / Reverse     │                 │
                 │        Proxy          │                 │
                 └──────────┬────────────┘                 │
                            │                              │
                            ▼                              │
                 ┌───────────────────────┐                 │
                 │    Bun + Elysia/Hono  ├─────────────────┘
                 │   (Fast Webhook API)  │
                 └──────────┬────────────┘
                            │ (Push Raw Event)
                            ▼
                 ┌───────────────────────┐
                 │  Redis / Valkey Queue │
                 │      (BullMQ)         │
                 └──────────┬────────────┘
                            │
                            ▼
                 ┌───────────────────────┐
                 │   Bun Worker / Event  │
                 │       Processor       │
                 └────┬──────────────┬───┘
                      │              │
       (Save Chat/DB) │              │ (Realtime Sync via WebSocket)
                      ▼              ▼
           ┌────────────────┐   ┌───────────────────────────┐
           │    MySQL 8+    │   │      Bun WebSocket        │
           │  (via Drizzle) │   │          Server           │
           └────────────────┘   └─────────────┬─────────────┘
                                              │ (WSS with RBAC Channel Auth)
                                              ▼
                                ┌───────────────────────────┐
                                │     SvelteKit + TS App    │
                                │ (Admin/Spv/Agent Portal)  │
                                └───────────────────────────┘
```

---

## 2. Matriks Hak Akses Pengguna (Role-Based Access Control / RBAC)

Sistem dirancang dengan hierarki 3 peran (*Role*):

| Modul / Hak Akses | Administrator | Supervisor | Agent |
| :--- | :---: | :---: | :---: |
| **Konfigurasi Sistem & Meta WABA** | ✅ Penuh | ❌ | ❌ |
| **Manajemen Pengguna (CRUD User & Assign Role)** | ✅ Penuh | ❌ (Hanya lihat anggota tim) | ❌ |
| **Billing, API Key & Webhook Settings** | ✅ Penuh | ❌ | ❌ |
| **Lihat Semua Percakapan (Omnichannel)** | ✅ Semua | ✅ Semua Tim/Departemen | ❌ Hanya yang di-assign / unassigned |
| **Assignment & Re-assign Tiket/Chat** | ✅ Bebas | ✅ Bebas (Manual / Auto-routing) | ❌ Hanya terima tugas / transfer |
| **Kirim Pesan & Balas Obrolan** | ✅ | ✅ | ✅ |
| **Template Builder & Meta Submission** | ✅ Create / Submit | ✅ Draft / Review | ❌ Hanya menggunakan template |
| **Broadcast Campaign** | ✅ Buat & Eksekusi | ✅ Buat & Eksekusi | ❌ Lihat jadwal/status |
| **Live Chat Monitoring & Whispering (Internal Note)** | ✅ | ✅ | ❌ Catatan internal saja |
| **Laporan & Analitik Kinerja Agen (SLA, CSAT, Speed)** | ✅ Lengkap | ✅ Lengkap (Per Tim) | ❌ Hanya metrik performa sendiri |

---

## 3. Tech Stack & Komponen Teknis

### Backend (Bun Runtime)
* **Runtime:** `Bun` (v1.1+)
* **Framework:** `Elysia.js` atau `Hono` (Elysia Eden Treaty / RPC untuk type-safety ke SvelteKit)
* **Database ORM:** `Drizzle ORM` (`drizzle-orm/mysql2`)
* **Primary Database:** `MySQL 8.0+` (InnoDB Engine, utf8mb4 collation)
* **Message Broker & Cache:** `Redis` (BullMQ queueing webhook, rate-limiter, session caching)
* **Object Storage:** `MinIO` / Cloudflare R2 / AWS S3 (Penyimpanan media WA)
* **Real-time Engine:** Native WebSockets pada Bun (Room-based: Broadcast per Role/Org/Conversation)

### Frontend (Svelte & TypeScript)
* **Framework:** `SvelteKit 2` (dengan Svelte 5 Runes)
* **Language:** `TypeScript` (Strict mode)
* **State Management:** Svelte Runes (`$state`, `$derived`, `$effect`)
* **Styling & UI:** `TailwindCSS v4` + `shadcn-svelte` / `Bits UI` / `Lucide Icons`
* **Realtime Client:** Native WebSocket client dengan auto-reconnect logic
* **Data Fetching / RPC:** Elysia Eden Treaty / TanStack Query Svelte

---

## 4. Skema Basis Data Relasional (MySQL 8+ & Drizzle ORM)

```sql
-- Set Character Set agar mendukung emoji WhatsApp
SET NAMES utf8mb4;

-- 1. Organisasi / Multi-Tenancy
CREATE TABLE organizations (
    id VARCHAR(36) PRIMARY KEY, -- UUID v4
    name VARCHAR(255) NOT NULL,
    waba_id VARCHAR(100),       -- WhatsApp Business Account ID dari Meta
    app_id VARCHAR(100),
    access_token TEXT,          -- Encrypted System User Token
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tim / Departemen (Opsional untuk pembagian tugas Supervisor)
CREATE TABLE teams (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Akun Pengguna / Agen CRM dengan Multi-Role
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    team_id VARCHAR(36) NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('ADMINISTRATOR', 'SUPERVISOR', 'AGENT') NOT NULL DEFAULT 'AGENT',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    is_online BOOLEAN DEFAULT FALSE,
    max_active_chats INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_email (organization_id, email),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Nomor WhatsApp Terdaftar (Channel Phone Numbers)
CREATE TABLE phone_numbers (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    phone_number_id VARCHAR(100) NOT NULL,
    display_phone_number VARCHAR(50) NOT NULL,
    verified_name VARCHAR(255),
    quality_rating VARCHAR(50) DEFAULT 'UNKNOWN',
    status VARCHAR(50) DEFAULT 'CONNECTED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_phone_id (phone_number_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Database Kontak Pelanggan (CRM Contacts)
CREATE TABLE contacts (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    wa_id VARCHAR(50) NOT NULL, -- Format nomor tanpa tanda + (e.g. 628123456789)
    name VARCHAR(255),
    email VARCHAR(255),
    custom_attributes JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_wa (organization_id, wa_id),
    INDEX idx_contact_wa (wa_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Sesi Obrolan / Conversation Thread
CREATE TABLE conversations (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    phone_number_id VARCHAR(36) NOT NULL,
    contact_id VARCHAR(36) NOT NULL,
    assigned_user_id VARCHAR(36) NULL, -- ID Agen / Supervisor yang menangani
    team_id VARCHAR(36) NULL,
    status ENUM('UNASSIGNED', 'OPEN', 'PENDING', 'RESOLVED', 'EXPIRED') NOT NULL DEFAULT 'UNASSIGNED',
    window_expires_at DATETIME NULL, -- Meta 24-Hour Customer Care Window
    last_message_preview TEXT,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conv_status (status),
    INDEX idx_conv_user (assigned_user_id),
    INDEX idx_conv_last_msg (last_message_at),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Riwayat Pesan (Chat Messages)
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL,
    wam_id VARCHAR(255) NULL, -- Meta Message ID (wamid.HBgL...)
    direction ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    sender_type ENUM('CONTACT', 'AGENT', 'SUPERVISOR', 'SYSTEM', 'BOT') NOT NULL,
    sender_id VARCHAR(36) NULL, -- NULL jika kontak, atau users.id jika agen/spv
    message_type VARCHAR(50) NOT NULL, -- 'text', 'image', 'document', 'audio', 'template', 'interactive'
    body TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    is_internal_note BOOLEAN DEFAULT FALSE, -- Whispering Note (Hanya agen/spv yang lihat)
    status ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED') DEFAULT 'SENT',
    error_details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wamid (wam_id),
    INDEX idx_msg_conv (conversation_id, created_at),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. WhatsApp Message Templates
CREATE TABLE message_templates (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    meta_template_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION') NOT NULL,
    language VARCHAR(20) NOT NULL, -- 'id', 'en_US', etc.
    status ENUM('APPROVED', 'REJECTED', 'PENDING', 'PAUSED') DEFAULT 'PENDING',
    components JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Broadcast Campaigns
CREATE TABLE broadcast_campaigns (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    created_by_id VARCHAR(36) NOT NULL,
    template_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status ENUM('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'DRAFT',
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    read_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    scheduled_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES users(id),
    FOREIGN KEY (template_id) REFERENCES message_templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Audit Log & Agent SLA Performance Metrics
CREATE TABLE activity_logs (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    action VARCHAR(100) NOT NULL, -- 'ASSIGN_CHAT', 'RESOLVE_CHAT', 'SEND_TEMPLATE', 'ROLE_CHANGE'
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_org (organization_id, created_at),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 5. Matriks Keahlian & Skillset

| Domain | Skill / Teknologi | Fokus Implementasi |
| :--- | :--- | :--- |
| **Meta Platform** | WhatsApp Cloud API, Graph API v20+ | Webhook signature verification, template creation & approval, 24-hr session window. |
| **Backend** | Bun, Elysia.js / Hono, TypeScript | High-throughput async routing, Elysia Eden Treaty type-safety, JWT multi-role middleware. |
| **Database** | MySQL 8.0+, Drizzle ORM (`drizzle-orm/mysql2`) | Indexing untuk pagination chat, UTF8MB4 emojis, JSON query support, atomic transactions. |
| **Concurrency & Queue**| Redis, BullMQ | Webhook decoupled ingestion, broadcast rate-limiting (sesuai Tier limit Meta). |
| **Realtime Engine** | Bun Native WebSockets | Role-based WebSocket rooms (Spv monitor all, Agent receives assigned chats). |
| **Frontend** | Svelte 5, SvelteKit, TypeScript | Runes reactivity (`$state`, `$derived`), virtualized list, dynamic UI based on User Role. |
| **Security & RBAC** | RBAC Middleware, Argon2/Bcrypt, HMAC | Route guard (Admin/Spv/Agent), payload validation (`X-Hub-Signature-256`), Token encryption. |

---

## 6. Project Roadmap (Phase-by-Phase)

```
[Phase 1: Setup & RBAC Foundation] ──► [Phase 2: Meta Webhook & Queue] ──► [Phase 3: SvelteKit Omnichannel] ──► [Phase 4: Spv Tools & Broadcast] ──► [Phase 5: Production]
   (Bun + MySQL + Auth System)              (BullMQ + DB + WS Room)           (Agent & Spv Inbox Layout)             (Campaigns & SLA Analytics)         (Docker, SSL & Load Test)
```

### Phase 1: Inisialisasi Project, MySQL Setup & Auth RBAC (Minggu 1)
- [ ] Inisialisasi Monorepo (`bun-backend` & `svelte-frontend`).
- [ ] Konfigurasi Drizzle ORM dengan driver `mysql2` & migrasi skema tabel.
- [ ] Implementasi Authentication (JWT/Session) + Argon2 password hashing.
- [ ] Middleware RBAC di backend (`requireRole(['ADMINISTRATOR', 'SUPERVISOR'])`).
- [ ] Setup Meta Developer App, WhatsApp Cloud API Sandbox, dan System User Token.

### Phase 2: Webhook Engine, Queueing & Realtime WebSocket (Minggu 2 - 3)
- [ ] Endpoint Webhook GET (Verifikasi Handshake Meta) & POST (HMAC SHA-256 Signature Check).
- [ ] Ingestion BullMQ + Redis untuk menerima pesan WhatsApp tanpa blocking.
- [ ] Worker processor untuk mengurai event (Text, Media, Location, Interactive Buttons, Status updates).
- [ ] Auto-assignment logic (Tiket baru masuk $ightarrow$ Status `UNASSIGNED` atau didistribusikan secara *Round-Robin* ke Agen aktif).
- [ ] Bun WebSocket Server dengan sistem Room (Room Org, Room Tim, Room Conversation).

### Phase 3: SvelteKit Multi-Role UI & Omnichannel Live Chat (Minggu 4 - 5)
- [ ] Layout Dinamis SvelteKit berdasarkan Role:
  - **Admin:** Panel Pengaturan Organisasi, API Key, User Management.
  - **Supervisor:** Live Chat Monitoring View, Team Management, Re-assignment tool.
  - **Agent:** Focused Chat Inbox (Hanya pesan yang di-assign).
- [ ] Chat area dengan fitur:
  - Indikator 24-Hour Session Window Timer.
  - Internal Note / Whispering (Hanya dilihat Supervisor & Agen, tidak terkirim ke WhatsApp pelanggan).
  - Status checklist pesan (*sent*, *delivered*, *read*).
  - Media viewer (Gambar, Audio player, PDF preview).
- [ ] Virtual scroll untuk optimasi memori saat me-render ribuan pesan.

### Phase 4: Template Builder, Broadcast Campaign & Reporting (Minggu 6 - 7)
- [ ] UI Template Message Creator (Sinkronisasi langsung ke Meta Graph API).
- [ ] Broadcast Engine dengan Sliding Window Rate-Limiter (Aman dari limit tier Meta).
- [ ] Supervisor SLA & Analytics Dashboard:
  - First Response Time (FRT) & Average Resolution Time (ART).
  - Jumlah chat terselesaikan per agen.
  - Metrik Delivery & Read Rate pesan broadcast.
- [ ] Export kontak dan log obrolan ke format Excel / CSV.

### Phase 5: Testing, Hardening & Deployment (Minggu 8)
- [ ] Load testing endpoint webhook & WebSocket dengan k6 (Target: >1.000 req/detik).
- [ ] Security audit: SQL Injection prevention, XSS filter, Webhook replay attack guard.
- [ ] Containerization (Dockerfile Bun + SvelteKit Node Adapter/Bun + MySQL + Redis).
- [ ] Deployment ke VPS / Cloud (Coolify / Docker Compose + Nginx/Caddy Reverse Proxy SSL).

---

## 7. Contoh Implementasi Teknis Kunci

### A. RBAC Middleware & Route Protection (Bun + Elysia)
```typescript
// backend/src/middleware/auth.ts
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';

export type UserRole = 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT';

export const authPlugin = new Elysia({ name: 'auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key'
    })
  )
  .derive(async ({ jwt, headers, set }) => {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null };
    }

    const token = authHeader.split(' ')[1];
    const payload = await jwt.verify(token);

    if (!payload) {
      return { user: null };
    }

    return {
      user: payload as { id: string; orgId: string; role: UserRole; email: string }
    };
  })
  .macro(({ onBeforeHandle }) => ({
    requireRoles(roles: UserRole[]) {
      onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Unauthorized: Harap login terlebih dahulu' };
        }
        if (!roles.includes(user.role)) {
          set.status = 403;
          return { error: 'Forbidden: Hak akses tidak mencukupi' };
        }
      });
    }
  }));
```

### B. Svelte 5 Dynamic Navigation Berdasarkan Role (Frontend)
```svelte
<!-- frontend/src/lib/components/Sidebar.svelte -->
<script lang="ts">
  import { page } from '$app/stores';

  // Role pengguna saat ini (dari session/auth state)
  interface Props {
    userRole: 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT';
  }
  let { userRole }: Props = $props();

  // Menu items dengan filter hak akses
  const menuItems = $derived([
    { name: 'Live Inbox', path: '/inbox', roles: ['ADMINISTRATOR', 'SUPERVISOR', 'AGENT'] },
    { name: 'Monitoring Tim', path: '/supervisor/monitoring', roles: ['ADMINISTRATOR', 'SUPERVISOR'] },
    { name: 'Broadcast', path: '/broadcast', roles: ['ADMINISTRATOR', 'SUPERVISOR'] },
    { name: 'Template WA', path: '/templates', roles: ['ADMINISTRATOR', 'SUPERVISOR'] },
    { name: 'Laporan SLA', path: '/reports', roles: ['ADMINISTRATOR', 'SUPERVISOR'] },
    { name: 'Manajemen Agen', path: '/admin/users', roles: ['ADMINISTRATOR'] },
    { name: 'Pengaturan WABA', path: '/admin/settings', roles: ['ADMINISTRATOR'] }
  ].filter(item => item.roles.includes(userRole)));
</script>

<aside class="w-64 bg-slate-900 text-white h-screen flex flex-col p-4">
  <div class="text-xl font-bold text-emerald-400 mb-6 px-2">WhatsApp CRM</div>
  
  <div class="mb-4 px-2 py-1 bg-slate-800 rounded text-xs text-slate-400">
    Role: <span class="text-emerald-400 font-semibold">{userRole}</span>
  </div>

  <nav class="space-y-1 flex-1">
    {#each menuItems as item}
      <a 
        href={item.path}
        class="block px-3 py-2 rounded-lg text-sm font-medium transition {$page.url.pathname.startsWith(item.path) ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}"
      >
        {item.name}
      </a>
    {/each}
  </nav>
</aside>
```

---

## 8. Catatan Penting Regulasi & Biaya Meta

1. **24-Hour Customer Care Window:** Balasan bebas tanpa template hanya berlaku 24 jam sejak pesan terakhir pelanggan diterima. Agen tidak bisa mengetik pesan biasa jika waktu jendela habis; sistem otomatis mengalihkan tombol kirim ke *Template Picker*.
2. **Kategori Pesan Template & Biaya:**
   - **Service (Customer-Initiated):** Bebas biaya untuk 1.000 percakapan pertama per bulan per WABA.
   - **Utility:** Transaksi, resi, konfirmasi pembayaran.
   - **Marketing:** Promo, penawaran broadcast (Wajib ada opsi opt-out/unsubscribe).
   - **Authentication:** Verifikasi OTP login.
3. **Kualitas Nomor (Quality Rating):** Dashboard Administrator wajib menampilkan status kualitas nomor (*GREEN*, *YELLOW*, *RED*) dari Meta Graph API agar nomor tidak terblokir mendadak saat menjalankan broadcast massal.