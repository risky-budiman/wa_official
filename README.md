# WhatsApp CRM Platform

Platform CRM & Omnichannel berbasis **WhatsApp Cloud API** (Meta) dengan sistem **Multi-User RBAC**.

## Tech Stack

| Layer | Teknologi |
|:--|:--|
| **Backend** | Bun + Elysia.js + TypeScript |
| **Database** | MySQL 8 + Drizzle ORM |
| **Queue** | Redis + BullMQ |
| **Realtime** | Bun Native WebSocket |
| **Frontend** | SvelteKit 2 + Svelte 5 + TailwindCSS v4 |

## Quick Start

### Backend
```bash
cd be
cp .env.example .env   # Edit konfigurasi
bun install
bun run db:push        # Push schema ke MySQL
bun run dev            # Start dev server → http://localhost:3000
```

### Frontend
```bash
cd fe
bun install
bun run dev            # Start dev server → http://localhost:5173
```

## Struktur Project

```
wa_official/
├── be/    → Backend API (Bun + Elysia)
├── fe/    → Frontend UI (SvelteKit)
└── docs/  → Dokumentasi
```
# wa_official
