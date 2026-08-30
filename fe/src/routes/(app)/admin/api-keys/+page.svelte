<script lang="ts">
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api/client';
  import {
    Key,
    Plus,
    Copy,
    Check,
    Trash2,
    Shield,
    Terminal,
    Code2,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    X,
    Flame,
    Zap,
    Lock,
    Globe,
    BookOpen,
    Send,
    Play,
    Smartphone,
    Layers,
    FileText,
    MessageSquare,
    Sparkles,
    ArrowRight,
    HelpCircle,
    CreditCard,
    DollarSign
  } from 'lucide-svelte';

  interface ApiKeyItem {
    id: string;
    name: string;
    keyPrefix: string;
    permissions: string[];
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  }

  let activeTab = $state<'OVERVIEW' | 'DOCS' | 'TESTER'>('OVERVIEW');

  let apiKeysList = $state<ApiKeyItem[]>([]);
  let isLoading = $state(true);
  let isRefreshing = $state(false);

  // Modal states
  let showCreateModal = $state(false);
  let newKeyName = $state('');
  let selectedPermissions = $state<string[]>([
    'messages:send',
    'templates:send',
    'contacts:read',
    'contacts:write',
  ]);
  let isSubmitting = $state(false);
  let createError = $state<string | null>(null);

  // One-time secret key reveal modal
  let showRevealModal = $state(false);
  let generatedFullKey = $state('');
  let copied = $state(false);

  // Code Snippet Playground state
  let selectedEndpoint = $state<'SEND_TEMPLATE' | 'SEND_TEXT' | 'UPSERT_CONTACT' | 'GET_TEMPLATES' | 'GET_QUOTA'>('SEND_TEMPLATE');
  let selectedLang = $state<'curl' | 'php' | 'js' | 'python'>('curl');
  let copiedSnippet = $state(false);

  // In-App Interactive API Tester state
  let testKey = $state('');
  let testToPhone = $state('081234567890');
  let testTemplateName = $state('order_confirmation');
  let testCustomerName = $state('Budi Santoso');
  let testInvoiceNo = $state('INV-2026-001');
  let isTesting = $state(false);
  let testResponse = $state<any>(null);
  let testStatus = $state<number | null>(null);

  async function loadApiKeys(showLoader = true) {
    if (showLoader) isLoading = true;
    isRefreshing = true;
    const res = await apiRequest<{ items: ApiKeyItem[] }>('/settings/api-keys');
    isLoading = false;
    isRefreshing = false;

    if (res.success && res.items) {
      apiKeysList = res.items;
      if (apiKeysList.length > 0 && !testKey) {
        testKey = apiKeysList[0].keyPrefix;
      }
    }
  }

  async function handleCreateApiKey(e: Event) {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    createError = null;
    isSubmitting = true;
    const res = await apiRequest<{ apiKey: { key: string } & ApiKeyItem }>('/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        name: newKeyName.trim(),
        permissions: selectedPermissions,
      }),
    });
    isSubmitting = false;

    if (res.success && res.apiKey) {
      generatedFullKey = res.apiKey.key;
      testKey = res.apiKey.key;
      showCreateModal = false;
      newKeyName = '';
      showRevealModal = true;
      loadApiKeys(false);
    } else {
      createError = res.error || 'Gagal membuat API Key baru';
    }
  }

  async function deleteApiKey(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus / mencabut API Key ini? Aplikasi luar yang menggunakannya tidak akan dapat mengirim pesan lagi.')) {
      return;
    }

    const res = await apiRequest(`/settings/api-keys/${id}`, {
      method: 'DELETE',
    });

    if (res.success) {
      loadApiKeys(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2500);
  }

  function copySnippetToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    copiedSnippet = true;
    setTimeout(() => {
      copiedSnippet = false;
    }, 2500);
  }

  async function runInteractiveTest() {
    if (!testKey) {
      alert('Silakan masukkan API Key Anda terlebih dahulu untuk menjalankan pengetesan.');
      return;
    }

    isTesting = true;
    testResponse = null;
    testStatus = null;

    try {
      const url = `${baseUrl}/api/v1/external/messages/send-template`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': testKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testToPhone.trim(),
          templateName: testTemplateName.trim(),
          recipientName: testCustomerName.trim(),
          bodyParameters: [testCustomerName.trim(), testInvoiceNo.trim(), 'Rp 150.000'],
          buttonParameters: [{ index: '0', text: testInvoiceNo.trim() }],
        }),
      });

      testStatus = res.status;
      testResponse = await res.json();
    } catch (err: any) {
      testStatus = 500;
      testResponse = { success: false, error: err.message || 'Network error' };
    } finally {
      isTesting = false;
    }
  }

  onMount(() => {
    loadApiKeys();
  });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wacrm.yourdomain.com';
  const sampleKey = 'wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx';

  function getSnippet(endpoint: string, lang: string): string {
    if (endpoint === 'SEND_TEMPLATE') {
      if (lang === 'curl') {
        return `curl -X POST "${baseUrl}/api/v1/external/messages/send-template" \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "081234567890",
    "templateName": "order_confirmation",
    "language": "id",
    "recipientName": "Budi Santoso",
    "bodyParameters": ["Budi Santoso", "INV-2026-001", "Rp 250.000"],
    "buttonParameters": [
      { "index": "0", "text": "INV-2026-001" }
    ]
  }'`;
      } else if (lang === 'php') {
        return `<?php
// Contoh PHP / Laravel Http Facade
use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'X-API-Key' => '${sampleKey}',
    'Content-Type' => 'application/json',
])->post('${baseUrl}/api/v1/external/messages/send-template', [
    'to' => '081234567890',
    'templateName' => 'order_confirmation',
    'language' => 'id',
    'recipientName' => 'Budi Santoso',
    'bodyParameters' => ['Budi Santoso', 'INV-2026-001', 'Rp 250.000'],
    'buttonParameters' => [
        ['index' => '0', 'text' => 'INV-2026-001']
    ]
]);

$result = $response->json();
print_r($result);
?>`;
      } else if (lang === 'js') {
        return `// Contoh Node.js / JavaScript (Fetch API)
const response = await fetch('${baseUrl}/api/v1/external/messages/send-template', {
  method: 'POST',
  headers: {
    'X-API-Key': '${sampleKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '081234567890',
    templateName: 'order_confirmation',
    language: 'id',
    recipientName: 'Budi Santoso',
    bodyParameters: ['Budi Santoso', 'INV-2026-001', 'Rp 250.000'],
    buttonParameters: [{ index: '0', text: 'INV-2026-001' }]
  }),
});

const data = await response.json();
console.log(data);`;
      } else if (lang === 'python') {
        return `import requests

url = "${baseUrl}/api/v1/external/messages/send-template"
headers = {
    "X-API-Key": "${sampleKey}",
    "Content-Type": "application/json"
}
payload = {
    "to": "081234567890",
    "templateName": "order_confirmation",
    "language": "id",
    "recipientName": "Budi Santoso",
    "bodyParameters": ["Budi Santoso", "INV-2026-001", "Rp 250.000"],
    "buttonParameters": [{"index": "0", "text": "INV-2026-001"}]
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
      }
    } else if (endpoint === 'SEND_TEXT') {
      if (lang === 'curl') {
        return `curl -X POST "${baseUrl}/api/v1/external/messages/send-text" \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "081234567890",
    "message": "Halo Budi! Pesanan Anda sedang disiapkan oleh tim kami."
  }'`;
      } else if (lang === 'php') {
        return `<?php
use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'X-API-Key' => '${sampleKey}',
])->post('${baseUrl}/api/v1/external/messages/send-text', [
    'to' => '081234567890',
    'message' => 'Halo Budi! Pesanan Anda sedang disiapkan oleh tim kami.'
]);

print_r($response->json());
?>`;
      } else if (lang === 'js') {
        return `const res = await fetch('${baseUrl}/api/v1/external/messages/send-text', {
  method: 'POST',
  headers: {
    'X-API-Key': '${sampleKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: '081234567890',
    message: 'Halo Budi! Pesanan Anda sedang disiapkan.'
  })
});
console.log(await res.json());`;
      } else {
        return `import requests

res = requests.post(
    "${baseUrl}/api/v1/external/messages/send-text",
    headers={"X-API-Key": "${sampleKey}"},
    json={"to": "081234567890", "message": "Halo Budi!"}
)
print(res.json())`;
      }
    } else if (endpoint === 'UPSERT_CONTACT') {
      if (lang === 'curl') {
        return `curl -X POST "${baseUrl}/api/v1/external/contacts" \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "081234567890",
    "name": "Budi Santoso",
    "email": "budi@gmail.com",
    "customAttributes": {
      "city": "Jakarta",
      "customerTier": "VIP Gold"
    }
  }'`;
      } else if (lang === 'php') {
        return `<?php
use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'X-API-Key' => '${sampleKey}',
])->post('${baseUrl}/api/v1/external/contacts', [
    'phone' => '081234567890',
    'name' => 'Budi Santoso',
    'email' => 'budi@gmail.com',
    'customAttributes' => ['customerTier' => 'VIP Gold']
]);
print_r($response->json());
?>`;
      } else {
        return `// Register/Upsert Customer Contact
const res = await fetch('${baseUrl}/api/v1/external/contacts', {
  method: 'POST',
  headers: {
    'X-API-Key': '${sampleKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: '081234567890',
    name: 'Budi Santoso',
    email: 'budi@gmail.com'
  })
});
console.log(await res.json());`;
      }
    } else if (endpoint === 'GET_TEMPLATES') {
      if (lang === 'curl') {
        return `curl -X GET "${baseUrl}/api/v1/external/templates" \\
  -H "X-API-Key: ${sampleKey}"`;
      } else {
        return `// Fetch Approved WhatsApp Templates
const res = await fetch('${baseUrl}/api/v1/external/templates', {
  headers: { 'X-API-Key': '${sampleKey}' }
});
console.log(await res.json());`;
      }
    } else {
      if (lang === 'curl') {
        return `curl -X GET "${baseUrl}/api/v1/external/quota" \\
  -H "X-API-Key: ${sampleKey}"`;
      } else {
        return `// Fetch Live 24-Hour Meta Messaging Quota
const res = await fetch('${baseUrl}/api/v1/external/quota', {
  headers: { 'X-API-Key': '${sampleKey}' }
});
console.log(await res.json());`;
      }
    }
    return '';
  }
</script>

<div class="p-8 max-w-7xl mx-auto space-y-8">
  <!-- Header Title -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Key class="w-5 h-5" />
        </div>
        <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">API Key & Portal Integrasi Developer</h2>
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
        Hubungkan Website E-Commerce, Toko Online, Backend Laravel, POS Kasir, dan Sistem ERP ke WhatsApp CRM via REST API resmi
      </p>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        onclick={() => loadApiKeys(false)}
        disabled={isRefreshing}
        class="py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 shadow-2xs transition cursor-pointer"
      >
        <RefreshCw class="w-3.5 h-3.5 {isRefreshing ? 'animate-spin text-emerald-500' : ''}" />
        Segarkan
      </button>
      <button
        onclick={() => (showCreateModal = true)}
        class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer"
      >
        <Plus class="w-4 h-4" />
        Buat API Key Baru
      </button>
    </div>
  </div>

  <!-- Navigation Tabs (Overview, Buku Panduan, Live Tester) -->
  <div class="flex border-b border-slate-200 dark:border-slate-800 gap-6">
    <button
      onclick={() => (activeTab = 'OVERVIEW')}
      class="pb-3 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 {activeTab === 'OVERVIEW'
        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
    >
      <Key class="w-4 h-4" />
      <span>Manajemen API Key</span>
      <span class="px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
        {apiKeysList.length}
      </span>
    </button>

    <button
      onclick={() => (activeTab = 'DOCS')}
      class="pb-3 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 {activeTab === 'DOCS'
        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
    >
      <BookOpen class="w-4 h-4" />
      <span>Buku Panduan & Dokumentasi API</span>
      <span class="px-2 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
        Lengkap
      </span>
    </button>

    <button
      onclick={() => (activeTab = 'TESTER')}
      class="pb-3 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 {activeTab === 'TESTER'
        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
    >
      <Play class="w-4 h-4 text-indigo-500" />
      <span>Live API Tester</span>
    </button>
  </div>

  <!-- TAB 1: OVERVIEW & KEYS LIST -->
  {#if activeTab === 'OVERVIEW'}
    <!-- Highlight Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
        <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold">
          <Key class="w-4 h-4 text-emerald-500" />
          <span>API Keys Terdaftar</span>
        </div>
        <div class="text-2xl font-black text-slate-900 dark:text-white">{apiKeysList.length}</div>
        <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Aktif untuk Organisasi Anda</span>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
        <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold">
          <Zap class="w-4 h-4 text-indigo-500" />
          <span>Header Autentikasi</span>
        </div>
        <div class="text-xs font-black text-slate-900 dark:text-white font-mono mt-1">X-API-Key: wacrm_live_...</div>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">Atau Authorization: Bearer</span>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
        <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold">
          <Globe class="w-4 h-4 text-teal-500" />
          <span>Base REST API URL</span>
        </div>
        <div class="text-xs font-mono font-bold text-slate-900 dark:text-white truncate mt-1">{baseUrl}/api/v1/external</div>
        <span class="text-[11px] text-teal-600 dark:text-teal-400 font-bold">5 Endpoints Siap Pakai</span>
      </div>
    </div>

    <!-- API Keys Table Section -->
    <div class="bg-white dark:bg-slate-900/70 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
      <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Daftar API Keys Anda</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Kelola kredensial akses untuk website dan aplikasi pihak ketiga Anda</p>
        </div>
      </div>

      {#if isLoading}
        <div class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Memuat data API key...</div>
      {:else if apiKeysList.length === 0}
        <div class="p-12 text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Key class="w-6 h-6" />
          </div>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Belum ada API Key</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Klik tombol <strong>"Buat API Key Baru"</strong> di atas untuk menghubungkan website atau backend aplikasi Anda.
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-3 px-4">Nama Aplikasi / Service</th>
                <th class="py-3 px-4">Key Prefix</th>
                <th class="py-3 px-4">Hak Akses (Scopes)</th>
                <th class="py-3 px-4">Terakhir Digunakan</th>
                <th class="py-3 px-4">Tanggal Dibuat</th>
                <th class="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {#each apiKeysList as k}
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    <div class="flex items-center gap-2">
                      <div class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
                        <Code2 class="w-3.5 h-3.5" />
                      </div>
                      <span>{k.name}</span>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">{k.keyPrefix}</td>
                  <td class="py-3.5 px-4">
                    <div class="flex flex-wrap gap-1">
                      {#each k.permissions as perm}
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {perm}
                        </span>
                      {/each}
                    </div>
                  </td>
                  <td class="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('id-ID') : 'Belum pernah digunakan'}
                  </td>
                  <td class="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                    {new Date(k.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <button
                      onclick={() => deleteApiKey(k.id)}
                      class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Cabut & hapus API Key ini"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <!-- Quick Code Playground in Overview -->
    <div class="bg-white dark:bg-slate-900/70 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Terminal class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Contoh Kode Integrasi Cepat</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Salin contoh kode ini dan gunakan di backend website Anda</p>
          </div>
        </div>

        <button
          onclick={() => (activeTab = 'DOCS')}
          class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Buka Panduan Lengkap</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Endpoint Selector Tabs -->
      <div class="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onclick={() => (selectedEndpoint = 'SEND_TEMPLATE')}
          class="py-1.5 px-3.5 rounded-xl text-xs font-bold transition cursor-pointer {selectedEndpoint === 'SEND_TEMPLATE'
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}"
        >
          POST /messages/send-template (Kirim Notifikasi / OTP / Invoice)
        </button>
        <button
          onclick={() => (selectedEndpoint = 'SEND_TEXT')}
          class="py-1.5 px-3.5 rounded-xl text-xs font-bold transition cursor-pointer {selectedEndpoint === 'SEND_TEXT'
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}"
        >
          POST /messages/send-text (Kirim Chat CS)
        </button>
        <button
          onclick={() => (selectedEndpoint = 'UPSERT_CONTACT')}
          class="py-1.5 px-3.5 rounded-xl text-xs font-bold transition cursor-pointer {selectedEndpoint === 'UPSERT_CONTACT'
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}"
        >
          POST /contacts (Daftar / Update Kontak)
        </button>
        <button
          onclick={() => (selectedEndpoint = 'GET_TEMPLATES')}
          class="py-1.5 px-3.5 rounded-xl text-xs font-bold transition cursor-pointer {selectedEndpoint === 'GET_TEMPLATES'
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}"
        >
          GET /templates (List Template Approved)
        </button>
      </div>

      <!-- Language Selector & Copy Action -->
      <div class="flex items-center justify-between bg-slate-950 rounded-t-xl px-4 py-2.5 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <button
            onclick={() => (selectedLang = 'curl')}
            class="px-2.5 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer {selectedLang === 'curl' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}"
          >
            cURL
          </button>
          <button
            onclick={() => (selectedLang = 'php')}
            class="px-2.5 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer {selectedLang === 'php' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}"
          >
            PHP / Laravel
          </button>
          <button
            onclick={() => (selectedLang = 'js')}
            class="px-2.5 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer {selectedLang === 'js' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}"
          >
            Node.js / JS
          </button>
          <button
            onclick={() => (selectedLang = 'python')}
            class="px-2.5 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer {selectedLang === 'python' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}"
          >
            Python
          </button>
        </div>

        <button
          onclick={() => copySnippetToClipboard(getSnippet(selectedEndpoint, selectedLang))}
          class="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition cursor-pointer"
        >
          {#if copiedSnippet}
            <Check class="w-3.5 h-3.5 text-emerald-400" />
            <span class="text-emerald-400">Tersalin!</span>
          {:else}
            <Copy class="w-3.5 h-3.5" />
            <span>Salin Kode</span>
          {/if}
        </button>
      </div>

      <!-- Code Block Display -->
      <pre class="bg-slate-950 text-slate-200 p-4 rounded-b-xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 -mt-5"><code>{getSnippet(selectedEndpoint, selectedLang)}</code></pre>
    </div>
  {/if}

  <!-- TAB 2: BUKU PANDUAN LENGKAP & DOKUMENTASI DEVELOPER -->
  {#if activeTab === 'DOCS'}
    <div class="space-y-8">
      <!-- 3 Easy Steps Quickstart -->
      <div class="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-indigo-500/20 text-white space-y-4 shadow-md">
        <div>
          <div class="flex items-center gap-2">
            <Sparkles class="w-5 h-5 text-amber-400" />
            <h3 class="text-base font-extrabold text-white">Panduan Cepat 3 Langkah Integrasi</h3>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Mulai kirim pesan WhatsApp otomatis dari aplikasi luar dalam 5 menit</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">1</span>
              <h4 class="text-xs font-bold text-white">Dapatkan API Key</h4>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              Klik <strong>"Buat API Key Baru"</strong> di tab Manajemen API Key. Simpan kunci rahasia Anda pada file <code class="text-emerald-400 font-mono">.env</code> server website Anda.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-indigo-500 text-white font-black text-xs flex items-center justify-center">2</span>
              <h4 class="text-xs font-bold text-white">Pasang Header Request</h4>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              Sertakan header <code class="text-indigo-300 font-mono">X-API-Key: wacrm_live_...</code> dan <code class="text-indigo-300 font-mono">Content-Type: application/json</code> di setiap request HTTP POST/GET.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-teal-500 text-slate-950 font-black text-xs flex items-center justify-center">3</span>
              <h4 class="text-xs font-bold text-white">Kirim Pesan Otomatis</h4>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              Tembak endpoint <code class="text-teal-300 font-mono">/messages/send-template</code> saat ada pesanan baru, OTP login, tagihan, atau resi di sistem Anda!
            </p>
          </div>
        </div>
      </div>

      <!-- Endpoint 1: Send Template Message -->
      <div class="bg-white dark:bg-slate-900/70 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div class="flex items-center gap-3">
          <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            POST
          </span>
          <span class="font-mono text-sm font-bold text-slate-900 dark:text-white">/api/v1/external/messages/send-template</span>
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-400">
          Endpoint utama untuk mengirim WhatsApp Template resmi Meta (OTP, Notifikasi Pesanan, Invoice Pembayaran, Nomor Resi Pengiriman) dengan parameter teks dinamis dan tombol tautan URL.
        </p>

        <!-- Parameter Table -->
        <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table class="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-950 font-bold text-[11px] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-2.5 px-3.5">Parameter JSON</th>
                <th class="py-2.5 px-3.5">Tipe Data</th>
                <th class="py-2.5 px-3.5">Wajib?</th>
                <th class="py-2.5 px-3.5">Keterangan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td class="py-2.5 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">to</td>
                <td class="py-2.5 px-3.5 font-mono">String</td>
                <td class="py-2.5 px-3.5"><span class="text-rose-500 font-bold">Wajib</span></td>
                <td class="py-2.5 px-3.5">Nomor WhatsApp tujuan (format bebas: <code>0812...</code>, <code>62812...</code>, atau <code>+62812...</code> otomatis dinormalisasi).</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">templateName</td>
                <td class="py-2.5 px-3.5 font-mono">String</td>
                <td class="py-2.5 px-3.5"><span class="text-rose-500 font-bold">Wajib</span></td>
                <td class="py-2.5 px-3.5">Nama template resmi yang sudah berstatus <code>APPROVED</code> di Meta (contoh: <code>order_confirmation</code>).</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">language</td>
                <td class="py-2.5 px-3.5 font-mono">String</td>
                <td class="py-2.5 px-3.5"><span class="text-slate-400">Opsional</span></td>
                <td class="py-2.5 px-3.5">Kode bahasa template resmi di Meta (default: <code>id</code> untuk Bahasa Indonesia).</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">recipientName</td>
                <td class="py-2.5 px-3.5 font-mono">String</td>
                <td class="py-2.5 px-3.5"><span class="text-slate-400">Opsional</span></td>
                <td class="py-2.5 px-3.5">Nama pelanggan untuk didaftarkan otomatis ke buku kontak CRM.</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">bodyParameters</td>
                <td class="py-2.5 px-3.5 font-mono">Array String</td>
                <td class="py-2.5 px-3.5"><span class="text-slate-400">Opsional</span></td>
                <td class="py-2.5 px-3.5">Daftar nilai variabel dinamis tanpa batas pengganti <code>{`{{1}}`}</code>, <code>{`{{2}}`}</code>, <code>{`{{3}}`}</code>, ..., <code>{`{{N}}`}</code> sesuai urutan nomor variabel di template Anda.</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">buttonParameters</td>
                <td class="py-2.5 px-3.5 font-mono">Array Object</td>
                <td class="py-2.5 px-3.5"><span class="text-slate-400">Opsional</span></td>
                <td class="py-2.5 px-3.5">Nilai dinamis untuk tombol URL (contoh invoice: <code>[{`{"index": 0, "parameter": "INV-2026-8899"}`}]</code>).</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Sample Request Body Box -->
        <div class="space-y-1.5">
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Contoh Request Body (JSON):</span>
          <pre class="bg-slate-950 text-emerald-400 p-4 rounded-xl overflow-x-auto text-xs font-mono border border-slate-800"><code>{`{
  "to": "081234567890",
  "templateName": "konfirmasi_pembayaran_v1",
  "language": "id",
  "recipientName": "Budi Santoso",
  "bodyParameters": [
    "Budi Santoso",
    "INV-2026-8899",
    "Rp 250.000"
  ],
  "buttonParameters": [
    {
      "index": 0,
      "parameter": "INV-2026-8899"
    }
  ]
}`}</code></pre>
        </div>
      </div>

      <!-- Endpoint 2: Send Text Message -->
      <div class="bg-white dark:bg-slate-900/70 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center gap-3">
          <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            POST
          </span>
          <span class="font-mono text-sm font-bold text-slate-900 dark:text-white">/api/v1/external/messages/send-text</span>
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-400">
          Kirim pesan obrolan teks live chat biasa kepada pelanggan dalam jendela 24 jam percakapan layanan aktif.
        </p>

        <pre class="bg-slate-950 text-emerald-400 p-4 rounded-xl overflow-x-auto text-xs font-mono border border-slate-800"><code>{`{
  "to": "081234567890",
  "message": "Halo Budi! Pembayaran pesanan Anda telah kami terima."
}`}</code></pre>
      </div>

      <!-- HTTP Status Codes Reference -->
      <div class="bg-white dark:bg-slate-900/70 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield class="w-4 h-4 text-emerald-500" />
          <span>Daftar Kode Status HTTP Respon</span>
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
            <span class="font-mono font-black text-emerald-700 dark:text-emerald-300 text-xs">200 OK — success: true</span>
            <p class="text-[11px] text-emerald-800 dark:text-emerald-400">
              Pesan berhasil diproses dan dikirim ke server Meta WhatsApp pelanggan secara langsung.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
            <span class="font-mono font-black text-amber-700 dark:text-amber-300 text-xs">400 Bad Request — success: false</span>
            <p class="text-[11px] text-amber-800 dark:text-amber-400">
              Format nomor salah, template belum Approved, atau parameter tombol kurang.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1">
            <span class="font-mono font-black text-rose-700 dark:text-rose-300 text-xs">401 Unauthorized — success: false</span>
            <p class="text-[11px] text-rose-800 dark:text-rose-400">
              Header <code>X-API-Key</code> tidak disertakan, token salah, atau key sudah dihapus.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1">
            <span class="font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs">404 Not Found — success: false</span>
            <p class="text-[11px] text-indigo-800 dark:text-indigo-400">
              Nama template yang diminta tidak ditemukan di database organisasi Anda.
            </p>
          </div>
        </div>
      </div>

      <!-- Transparansi Tagihan & Biaya Resmi Meta -->
      <div class="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/80 p-6 rounded-2xl border border-emerald-500/30 text-white space-y-5 shadow-lg">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <div class="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <CreditCard class="w-4 h-4" />
              </div>
              <h3 class="text-sm font-extrabold text-white">Transparansi Tagihan & Biaya Resmi Meta (Direct-to-Meta)</h3>
            </div>
            <p class="text-xs text-slate-300">
              Platform WhatsApp CRM ini <strong>TIDAK memungut komisi atau biaya per-pesan (0% Markup)</strong>. Tagihan resmi percakapan ditagihkan <strong>langsung oleh Meta</strong> ke metode pembayaran Anda.
            </p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
            0% Markup Platform
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-2">
            <div class="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <CheckCircle2 class="w-4 h-4" />
              <span>Sistem Tarif: Per Sesi 24 Jam (Bukan Per Pesan)</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              Meta menghitung biaya per <strong>Sesi Percakapan 24 Jam</strong>, bukan per butir pesan. Dalam 1 sesi 24 jam dengan pelanggan, Anda bebas membalas puluhan pesan chat secara gratis tanpa dikalikan jumlah pesan.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-2">
            <div class="flex items-center gap-2 text-teal-400 font-bold text-xs">
              <Sparkles class="w-4 h-4 text-teal-400" />
              <span>1.000 Percakapan Gratis / Bulan dari Meta</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              Setiap bulan, Meta memberikan jatah <strong>1.000 percakapan Layanan Pelanggan (CS) GRATIS (Rp 0)</strong> untuk setiap Akun WhatsApp Business (WABA).
            </p>
          </div>
        </div>

        <!-- Meta Category Table -->
        <div class="overflow-x-auto border border-slate-700/70 rounded-xl">
          <table class="w-full text-left text-xs text-slate-200">
            <thead class="bg-slate-950 font-bold text-[11px] text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-2.5 px-3.5">Kategori Percakapan</th>
                <th class="py-2.5 px-3.5">Keterangan & Use Case</th>
                <th class="py-2.5 px-3.5">Skema Tarif Resmi Meta</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 font-medium">
              <tr>
                <td class="py-2.5 px-3.5 font-bold text-emerald-400">1. Layanan CS (Service)</td>
                <td class="py-2.5 px-3.5">Obrolan live chat yang dimulai saat pelanggan chat ke CS</td>
                <td class="py-2.5 px-3.5 text-emerald-300">1.000 Pertama Gratis / Bulan. Di atas itu ~Rp 250 - Rp 350 / 24 jam</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-bold text-teal-400">2. Notifikasi Transaksi (Utility)</td>
                <td class="py-2.5 px-3.5">Konfirmasi pesanan, invoice tagihan, resi pengiriman</td>
                <td class="py-2.5 px-3.5 text-teal-300">~Rp 300 - Rp 450 / sesi 24 jam</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-bold text-indigo-400">3. Keamanan (Authentication)</td>
                <td class="py-2.5 px-3.5">Kode verifikasi OTP login dan reset password</td>
                <td class="py-2.5 px-3.5 text-indigo-300">~Rp 300 - Rp 400 / sesi 24 jam</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3.5 font-bold text-amber-400">4. Pemasaran (Marketing)</td>
                <td class="py-2.5 px-3.5">Broadcast promosi massal dan diskon produk</td>
                <td class="py-2.5 px-3.5 text-amber-300">~Rp 450 - Rp 600 / sesi 24 jam</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-[11px] text-slate-400 italic">
          * Catatan: Rincian pemakaian, faktur pajak resmi, dan penambahan kartu pembayaran (Kartu Debit/Kredit) diatur langsung oleh Anda melalui portal <strong>business.facebook.com ➔ Billing & Payments</strong>.
        </p>
      </div>
    </div>
  {/if}

  <!-- TAB 3: LIVE API TESTER -->
  {#if activeTab === 'TESTER'}
    <div class="bg-white dark:bg-slate-900/70 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      <div>
        <div class="flex items-center gap-2">
          <Play class="w-5 h-5 text-indigo-500" />
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Live REST API Tester (Uji Coba Pengiriman)</h3>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Uji coba kirim pesan WhatsApp langsung dari dashboard tanpa memerlukan aplikasi pihak ketiga seperti Postman
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Request Form -->
        <div class="space-y-4">
          <div>
            <label for="test_key" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Live API Key Anda
            </label>
            <input
              id="test_key"
              type="text"
              bind:value={testKey}
              placeholder="wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label for="test_phone" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nomor WhatsApp Tujuan Uji Coba
            </label>
            <input
              id="test_phone"
              type="text"
              bind:value={testToPhone}
              placeholder="e.g. 081234567890"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label for="test_template" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Template WhatsApp (Approved)
            </label>
            <input
              id="test_template"
              type="text"
              bind:value={testTemplateName}
              placeholder="e.g. order_confirmation"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="test_cust" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pelanggan (Param 1)
              </label>
              <input
                id="test_cust"
                type="text"
                bind:value={testCustomerName}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label for="test_inv" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No. Invoice (Param 2)
              </label>
              <input
                id="test_inv"
                type="text"
                bind:value={testInvoiceNo}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            onclick={runInteractiveTest}
            disabled={isTesting}
            class="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer"
          >
            {#if isTesting}
              <RefreshCw class="w-4 h-4 animate-spin" />
              <span>Mengirim Permintaan ke WhatsApp API...</span>
            {:else}
              <Send class="w-4 h-4" />
              <span>Jalankan Test Kirim Pesan Sekarang</span>
            {/if}
          </button>
        </div>

        <!-- Live Response Output -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Live JSON Response Output:</span>
            {#if testStatus !== null}
              <span class="px-2.5 py-0.5 rounded font-mono text-[11px] font-bold {testStatus === 200 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}">
                HTTP {testStatus}
              </span>
            {/if}
          </div>

          <div class="bg-slate-950 rounded-xl p-4 border border-slate-800 min-h-[260px] font-mono text-xs overflow-x-auto text-emerald-400">
            {#if isTesting}
              <div class="text-slate-500 animate-pulse">Menghubungi server WhatsApp CRM...</div>
            {:else if testResponse}
              <pre><code>{JSON.stringify(testResponse, null, 2)}</code></pre>
            {:else}
              <div class="text-slate-600 text-center py-20">
                Respon JSON dari server akan ditampilkan di sini setelah Anda mengklik tombol test di sebelah kiri.
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Modal Create API Key -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Buat API Key Baru</h3>
        <button onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleCreateApiKey} class="space-y-4">
        <div>
          <label for="modal_key_name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nama Aplikasi / Service Klien
          </label>
          <input
            id="modal_key_name"
            type="text"
            bind:value={newKeyName}
            placeholder="e.g. Website Checkout, Laravel Backend, POS Kasir"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <span class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Hak Akses (Permissions / Scopes)
          </span>
          <div class="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked disabled class="accent-emerald-600 rounded" />
              <span><strong>messages:send</strong> — Kirim pesan teks WhatsApp</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked disabled class="accent-emerald-600 rounded" />
              <span><strong>templates:send</strong> — Kirim WhatsApp template resmi</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked disabled class="accent-emerald-600 rounded" />
              <span><strong>contacts:write</strong> — Simpan / perbarui data pelanggan</span>
            </label>
          </div>
        </div>

        {#if createError}
          <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
            <span>{createError}</span>
          </div>
        {/if}

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={() => (showCreateModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
          >
            <Key class="w-3.5 h-3.5" />
            {isSubmitting ? 'Membuat...' : 'Generate API Key'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal Reveal Full API Key (One-Time Display) -->
{#if showRevealModal}
  <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 border border-emerald-500/40 shadow-2xl space-y-4">
      <div class="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div class="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
          <Shield class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">API Key Berhasil Dibuat!</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Harap salin key ini sekarang</p>
        </div>
      </div>

      <div class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
        <div class="flex items-center gap-1.5 font-bold">
          <AlertCircle class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Simpan Kredensial Ini dengan Aman</span>
        </div>
        <p class="text-[11px] leading-relaxed">
          Demi alasan keamanan, secret key ini <strong>hanya ditampilkan satu kali</strong> dan tidak akan dapat dilihat kembali setelah jendela ini ditutup.
        </p>
      </div>

      <!-- Key Box with Copy -->
      <div class="space-y-1.5">
        <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Live API Key Anda:</span>
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold break-all">{generatedFullKey}</span>
          <button
            onclick={() => copyToClipboard(generatedFullKey)}
            class="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
          >
            {#if copied}
              <Check class="w-3.5 h-3.5" />
              <span>Tersalin!</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span>Salin</span>
            {/if}
          </button>
        </div>
      </div>

      <div class="flex justify-end pt-2">
        <button
          onclick={() => {
            showRevealModal = false;
            generatedFullKey = '';
          }}
          class="py-2.5 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition cursor-pointer"
        >
          Saya Sudah Menyimpan API Key
        </button>
      </div>
    </div>
  </div>
{/if}
