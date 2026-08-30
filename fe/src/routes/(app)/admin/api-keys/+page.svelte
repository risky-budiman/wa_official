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
    Globe
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
  let selectedEndpoint = $state<'SEND_TEMPLATE' | 'SEND_TEXT' | 'UPSERT_CONTACT' | 'GET_TEMPLATES'>('SEND_TEMPLATE');
  let selectedLang = $state<'curl' | 'php' | 'js' | 'python'>('curl');
  let copiedSnippet = $state(false);

  async function loadApiKeys(showLoader = true) {
    if (showLoader) isLoading = true;
    isRefreshing = true;
    const res = await apiRequest<{ items: ApiKeyItem[] }>('/settings/api-keys');
    isLoading = false;
    isRefreshing = false;

    if (res.success && res.items) {
      apiKeysList = res.items;
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

  onMount(() => {
    loadApiKeys();
  });

  // Dynamic code snippets
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wacrm.yourdomain.com';
  const sampleKey = 'wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxx';

  function getSnippet(endpoint: string, lang: string): string {
    if (endpoint === 'SEND_TEMPLATE') {
      if (lang === 'curl') {
        return `curl -X POST "${baseUrl}/api/v1/external/messages/send-template" \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "628123456789",
    "templateName": "order_confirmation",
    "language": "id",
    "bodyParameters": ["Budi", "INV-2026-001"],
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
    'to' => '628123456789',
    'templateName' => 'order_confirmation',
    'language' => 'id',
    'bodyParameters' => ['Budi', 'INV-2026-001'],
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
    to: '628123456789',
    templateName: 'order_confirmation',
    language: 'id',
    bodyParameters: ['Budi', 'INV-2026-001'],
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
    "to": "628123456789",
    "templateName": "order_confirmation",
    "language": "id",
    "bodyParameters": ["Budi", "INV-2026-001"],
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
    "to": "628123456789",
    "message": "Halo Budi! Pesanan Anda sedang disiapkan oleh tim kami."
  }'`;
      } else if (lang === 'php') {
        return `<?php
use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'X-API-Key' => '${sampleKey}',
])->post('${baseUrl}/api/v1/external/messages/send-text', [
    'to' => '628123456789',
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
    to: '628123456789',
    message: 'Halo Budi! Pesanan Anda sedang disiapkan.'
  })
});
console.log(await res.json());`;
      } else {
        return `import requests

res = requests.post(
    "${baseUrl}/api/v1/external/messages/send-text",
    headers={"X-API-Key": "${sampleKey}"},
    json={"to": "628123456789", "message": "Halo Budi!"}
)
print(res.json())`;
      }
    } else if (endpoint === 'UPSERT_CONTACT') {
      if (lang === 'curl') {
        return `curl -X POST "${baseUrl}/api/v1/external/contacts" \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "628123456789",
    "name": "Budi Santoso",
    "email": "budi@gmail.com",
    "customAttributes": {
      "city": "Jakarta",
      "customerTier": "VIP"
    }
  }'`;
      } else if (lang === 'php') {
        return `<?php
use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'X-API-Key' => '${sampleKey}',
])->post('${baseUrl}/api/v1/external/contacts', [
    'phone' => '628123456789',
    'name' => 'Budi Santoso',
    'email' => 'budi@gmail.com',
    'customAttributes' => ['customerTier' => 'VIP']
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
    phone: '628123456789',
    name: 'Budi Santoso',
    email: 'budi@gmail.com'
  })
});
console.log(await res.json());`;
      }
    } else {
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
        <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">API Key & Integrasi Developer</h2>
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
        Hubungkan sistem luar (Website E-Commerce, Backend Laravel, POS, ERP, Webhook) ke WhatsApp CRM melalui REST API resmi
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

  <!-- Highlight Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <div class="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
      <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold">
        <Key class="w-4 h-4 text-emerald-500" />
        <span>API Keys Aktif</span>
      </div>
      <div class="text-2xl font-black text-slate-900 dark:text-white">{apiKeysList.length}</div>
      <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Terhubung ke Organisasi Anda</span>
    </div>

    <div class="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
      <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold">
        <Zap class="w-4 h-4 text-indigo-500" />
        <span>Metode Autentikasi</span>
      </div>
      <div class="text-base font-black text-slate-900 dark:text-white font-mono mt-1">Header: X-API-Key</div>
      <span class="text-[11px] text-slate-500 dark:text-slate-400">Atau Authorization: Bearer</span>
    </div>

    <div class="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
      <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold">
        <Globe class="w-4 h-4 text-teal-500" />
        <span>Base Endpoint URL</span>
      </div>
      <div class="text-xs font-mono font-bold text-slate-900 dark:text-white truncate mt-1">{baseUrl}/api/v1/external</div>
      <span class="text-[11px] text-teal-600 dark:text-teal-400 font-bold">Ready for Production</span>
    </div>
  </div>

  <!-- API Keys Table Section -->
  <div class="bg-white dark:bg-slate-900/70 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
    <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Daftar API Keys</h3>
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
          Klik tombol <strong>"Buat API Key Baru"</strong> untuk menghubungkan website atau backend aplikasi Anda.
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

  <!-- Interactive Developer Documentation & Code Playground -->
  <div class="bg-white dark:bg-slate-900/70 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <Terminal class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Dokumentasi & Contoh Kode Integrasi</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Contoh siap pakai untuk backend website, Laravel, Node.js, atau Python Anda</p>
        </div>
      </div>
    </div>

    <!-- Endpoint Selector Tabs -->
    <div class="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
      <button
        onclick={() => (selectedEndpoint = 'SEND_TEMPLATE')}
        class="py-1.5 px-3.5 rounded-xl text-xs font-bold transition cursor-pointer {selectedEndpoint === 'SEND_TEMPLATE'
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}"
      >
        POST /messages/send-template (Kirim Notif / OTP / Template)
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
          <label for="key_name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nama Aplikasi / Service Klien
          </label>
          <input
            id="key_name"
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
