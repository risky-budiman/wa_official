// ===========================================
// App navigation — single source of truth for the sidebar menu,
// the header title/breadcrumb and the browser tab title.
// ===========================================

import {
  MessageSquare,
  Contact,
  Zap,
  FileText,
  Radio,
  BarChart3,
  Eye,
  Users,
  Bot,
  Settings,
  CreditCard,
  Key,
} from 'lucide-svelte';

export type AppRole =
  | 'SUPER_ADMIN'
  | 'CO_SUPER_ADMIN'
  | 'ADMIN_FINANCE'
  | 'ADMIN_SUPPORT'
  | 'ADMINISTRATOR'
  | 'SUPERVISOR'
  | 'AGENT';

export interface NavItem {
  name: string;
  /** Short description shown under the page title in the header */
  description: string;
  path: string;
  icon: typeof MessageSquare;
  roles: AppRole[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const ALL: AppRole[] = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR', 'AGENT'];
const LEADS: AppRole[] = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'];
const ADMINS: AppRole[] = ['SUPER_ADMIN', 'ADMINISTRATOR'];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Percakapan',
    items: [
      { name: 'Live Inbox', description: 'Balas percakapan pelanggan secara real-time', path: '/inbox', icon: MessageSquare, roles: ALL },
      { name: 'Kontak', description: 'Database pelanggan & riwayat interaksi', path: '/contacts', icon: Contact, roles: ALL },
      { name: 'Balas Cepat', description: 'Template jawaban singkat untuk tim CS', path: '/quick-replies', icon: Zap, roles: ALL },
    ],
  },
  {
    label: 'Kampanye',
    items: [
      { name: 'Template WhatsApp', description: 'Template pesan resmi yang disetujui Meta', path: '/templates', icon: FileText, roles: LEADS },
      { name: 'Broadcast', description: 'Kirim pesan massal ke segmen pelanggan', path: '/broadcast', icon: Radio, roles: LEADS },
    ],
  },
  {
    label: 'Analitik',
    items: [
      { name: 'Laporan & SLA', description: 'Kecepatan respons, penyelesaian & kepuasan', path: '/reports', icon: BarChart3, roles: LEADS },
      { name: 'Monitoring Tim', description: 'Pantau beban kerja & aktivitas agen', path: '/supervisor/monitoring', icon: Eye, roles: LEADS },
    ],
  },
  {
    label: 'Administrasi',
    items: [
      { name: 'Tim & Pengguna', description: 'Kelola anggota tim, peran & status', path: '/admin/users', icon: Users, roles: ADMINS },
      { name: 'Chatbot & AI', description: 'Atur balasan otomatis & asisten AI', path: '/admin/settings/chatbot', icon: Bot, roles: ADMINS },
      { name: 'Saluran WhatsApp', description: 'Koneksi WhatsApp Business (WABA) & kapasitas', path: '/admin/settings', icon: Settings, roles: ADMINS },
      { name: 'Langganan', description: 'Paket, kuota & riwayat tagihan', path: '/admin/subscription', icon: CreditCard, roles: ADMINS },
      { name: 'API & Developer', description: 'API key & dokumentasi integrasi', path: '/admin/api-keys', icon: Key, roles: ADMINS },
    ],
  },
];

/** Find the nav item (and its section) that best matches a pathname (longest prefix wins). */
export function findNavItem(pathname: string): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const matches = pathname === item.path || pathname.startsWith(item.path + '/');
      if (matches && (!best || item.path.length > best.item.path.length)) best = { section, item };
    }
  }
  return best;
}

/** True when `item` is the active entry for this pathname (exact or deepest prefix match). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return findNavItem(pathname)?.item.path === item.path;
}
