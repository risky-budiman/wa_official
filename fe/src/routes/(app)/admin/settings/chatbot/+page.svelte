<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
  import {
    Bot,
    Clock,
    Sparkles,
    Save,
    CheckCircle2,
    AlertCircle,
    BookOpen,
    Lightbulb,
    Zap,
    MessageSquare,
    Sliders,
    Shield,
    Check,
    Send,
    HelpCircle
  } from 'lucide-svelte';

  // Operating Hours State
  let operatingHours = $state({
    enabled: false,
    timezone: 'Asia/Jakarta',
    days: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '17:00',
  });

  // AI Agent & Chatbot Config State
  let aiAgentConfig = $state({
    enabled: true,
    triggerMode: 'ALWAYS' as 'OUT_OF_HOURS' | 'ALWAYS',
    mode: 'AI_ASSISTANT' as 'AI_ASSISTANT' | 'STATIC_MESSAGE',
    provider: 'gemini' as 'gemini' | 'openai',
    apiKey: '',
    model: 'gemini-2.0-flash',
    systemPrompt: '',
    staticMessage: 'Halo! Layanan kami saat ini sedang berada di luar jam operasional. Pesan Anda telah kami terima dan akan segera dibalas oleh tim kami saat jam kerja dimulai. Terima kasih! 🙏',
  });

  // Custom Rule-Based Chatbot Config State
  let chatbotConfig = $state({
    greetingText: `Halo Kak {{contactName}}! 👋 Selamat datang di Layanan Pelanggan Kami.

Silakan pilih menu bantuan di bawah ini dengan mengetikkan angkanya:

1️⃣ Informasi Produk & Katalog
2️⃣ Cek Status Pesanan / Resi
3️⃣ Hubungi Customer Care (Agen Manusia)
4️⃣ Tanya Jawab Otomatis (Asisten AI)

Ketik angka 1-4 untuk melanjutkan. 🙏`,
    rules: [
      {
        id: 'rule-1',
        keywords: ['1', 'katalog', 'produk', 'harga'],
        title: 'Informasi Katalog & Produk',
        replyText: '📦 *Informasi Produk & Katalog*\n\nTerima kasih atas minat Kak {{contactName}}!\nAnda dapat melihat katalog lengkap produk kami di: https://katalog.perusahaan.com\n\nKetik *MENU* untuk kembali.',
        action: 'REPLY' as 'REPLY' | 'HANDOFF_HUMAN' | 'HANDOVER_AI',
      },
      {
        id: 'rule-2',
        keywords: ['2', 'resi', 'pesanan', 'lacak'],
        title: 'Status Pesanan & Lacak Resi',
        replyText: '🚚 *Cek Status Pengiriman Pesanan*\n\nUntuk melacak pesanan Anda, silakan kirimkan Nomor Invoice atau Nomor Resi Anda (contoh: #INV-88902).\n\nKetik *MENU* untuk kembali.',
        action: 'REPLY' as 'REPLY' | 'HANDOFF_HUMAN' | 'HANDOVER_AI',
      },
      {
        id: 'rule-3',
        keywords: ['3', 'cs', 'agen', 'operator', 'human'],
        title: 'Hubungi CS (Human Handoff)',
        replyText: '👤 *Menghubungkan ke Customer Care...*\n\nPesan Kak {{contactName}} telah kami masukkan ke antrean prioritas. Agen CS kami akan segera melayani Anda! 🙏',
        action: 'HANDOFF_HUMAN' as 'REPLY' | 'HANDOFF_HUMAN' | 'HANDOVER_AI',
      },
    ],
  });

  function addRule() {
    chatbotConfig.rules = [
      ...chatbotConfig.rules,
      {
        id: 'rule-' + Date.now(),
        keywords: ['menu_baru'],
        title: 'Aturan Baru',
        replyText: 'Halo Kak {{contactName}}, terima kasih telah menghubungi kami!',
        action: 'REPLY',
      },
    ];
  }

  function removeRule(id: string) {
    chatbotConfig.rules = chatbotConfig.rules.filter((r) => r.id !== id);
  }

  let isSaving = $state(false);
  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  // Live Simulator State
  let testMessage = $state('Halo, apa saja pilihan menu dan informasi produk yang tersedia?');
  let isTesting = $state(false);
  let testReply = $state<string | null>(null);
  let testError = $state<string | null>(null);
  let appliedPresetKey = $state<string | null>(null);

  const daysOfWeek = [
    { id: 1, label: 'Senin' },
    { id: 2, label: 'Selasa' },
    { id: 3, label: 'Rabu' },
    { id: 4, label: 'Kamis' },
    { id: 5, label: 'Jumat' },
    { id: 6, label: 'Sabtu' },
    { id: 7, label: 'Minggu' },
  ];

  const promptPresets: Record<string, { title: string; badge: string; desc: string; text: string }> = {
    ecommerce: {
      title: '🛍️ Toko Online / E-Commerce',
      badge: 'Katalog & Resi',
      desc: 'Panduan katalog produk, cek ongkir, nomor resi pengiriman, dan kebijakan retur.',
      text: `Anda adalah asisten AI resmi toko online kami di WhatsApp.
INFORMASI TOKO:
- Nama Toko: Sukses Store
- Jam Buka: Senin - Sabtu 08:00 - 17:00 WIB
- Kebijakan Retur: Maksimal 2 hari setelah barang diterima dengan melampirkan video unboxing.

SKILLS:
1. CEK ONGKIR: Minta pelanggan menyebutkan Kecamatan dan Kota tujuan pengiriman.
2. CEK RESI: Minta nomor invoice/resi untuk dicatat oleh tim logistik.
3. GAYA BICARA: Ramah, gunakan sapaan "Kak", sopan, dan solutif.`,
    },
    it_support: {
      title: '💻 IT Support & Helpdesk',
      badge: 'Troubleshooting',
      desc: 'Panduan teknis penanganan kendala login, error, laporan bug, dan eskalasi server.',
      text: `Anda adalah asisten AI Customer Service resmi dari tim IT Support kami.
INFORMASI:
- Jam Kerja Agen: Senin - Jumat 08:30 - 17:30 WIB
- Jalur Darurat: Kirim email ke ops@perusahaan.com jika terjadi server down.

SKILLS:
1. KENDALA LOGIN: Minta email terdaftar dan screenshot kendala.
2. GAYA BAHASA: Poin-poin terstruktur, profesional, dan solutif.`,
    },
    clinic_booking: {
      title: '🏥 Klinik & Janji Temu',
      badge: 'Reservasi',
      desc: 'Pendaftaran pasien, jadwal praktek dokter, estimasi biaya, dan protokol darurat.',
      text: `Anda adalah asisten AI resmi Klinik Sehat Prima di WhatsApp.
INFORMASI KLINIK:
- Jam Buka: Senin - Sabtu 09:00 - 20:00 WIB
- Layanan: Poli Gigi, Dokter Umum, Laboratorium.

SKILLS:
1. BOOKING: Minta (Nama Lengkap, Usia, Poli Tujuan, Tanggal Kunjungan).
2. DARURAT: Anjurkan menuju IGD RS terdekat jika terjadi gejala darurat medis.`,
    },
  };

  const providerModels: Record<string, { id: string; label: string }[]> = {
    gemini: [
      { id: 'gemini-2.0-flash', label: '✨ Gemini 2.0 Flash (Sangat Cepat & Gratis - Direkomendasikan)' },
      { id: 'gemini-1.5-flash', label: '⚡ Gemini 1.5 Flash (Stabil & Cepat)' },
      { id: 'gemini-1.5-pro', label: '🧠 Gemini 1.5 Pro (Penalaran Tingkat Lanjut)' },
      { id: 'CUSTOM', label: '✏️ Ketik Nama Model Custom...' },
    ],
    openai: [
      { id: 'gpt-4o-mini', label: '🟩 GPT-4o Mini (Sangat Hemat & Cepat - Direkomendasikan)' },
      { id: 'gpt-4o', label: '🚀 GPT-4o (Unggulan / Most Capable)' },
      { id: 'gpt-4-turbo', label: '⚡ GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', label: '📦 GPT-3.5 Turbo' },
      { id: 'CUSTOM', label: '✏️ Ketik Nama Model Custom...' },
    ],
    claude: [
      { id: 'claude-3-5-sonnet-20240620', label: '🟧 Claude 3.5 Sonnet (Terbaik & Paling Empati - Direkomendasikan)' },
      { id: 'claude-3-haiku-20240307', label: '⚡ Claude 3 Haiku (Ringan & Cepat)' },
      { id: 'claude-3-opus-20240229', label: '🧠 Claude 3 Opus (Analisis Mendalam)' },
      { id: 'CUSTOM', label: '✏️ Ketik Nama Model Custom...' },
    ],
    custom_llm: [
      { id: 'llama3:8b', label: '🖥️ Llama 3 8B (Ollama / LocalAI - Direkomendasikan)' },
      { id: 'deepseek-r1:8b', label: '🔍 DeepSeek R1 8B (Reasoning Local)' },
      { id: 'mistral:7b', label: '💨 Mistral 7B' },
      { id: 'CUSTOM', label: '✏️ Ketik Nama Model Custom...' },
    ],
  };

  let isCustomModel = $state(false);

  function handleProviderChange(newProvider: string) {
    const defaultModel = providerModels[newProvider]?.[0]?.id || 'gemini-2.0-flash';
    aiAgentConfig.model = defaultModel;
    isCustomModel = false;
  }

  function handleModelSelect(selected: string) {
    if (selected === 'CUSTOM') {
      isCustomModel = true;
    } else {
      isCustomModel = false;
      aiAgentConfig.model = selected;
    }
  }

  function toggleDay(dayId: number) {
    if (operatingHours.days.includes(dayId)) {
      operatingHours.days = operatingHours.days.filter((d) => d !== dayId);
    } else {
      operatingHours.days = [...operatingHours.days, dayId].sort();
    }
  }

  async function loadSettings() {
    try {
      const res = await apiRequest<any>('/settings/operating-hours');
      if (res.success) {
        let h = res.operatingHours;
        let a = res.aiAgentConfig;
        let c = res.chatbotConfig;
        if (typeof h === 'string') try { h = JSON.parse(h); } catch (_) {}
        if (typeof a === 'string') try { a = JSON.parse(a); } catch (_) {}
        if (typeof c === 'string') try { c = JSON.parse(c); } catch (_) {}

        if (h) {
          operatingHours = {
            enabled: Boolean(h.enabled),
            timezone: h.timezone || 'Asia/Jakarta',
            days: Array.isArray(h.days) ? h.days : [1, 2, 3, 4, 5],
            startTime: h.startTime || '08:00',
            endTime: h.endTime || '17:00',
          };
        }
        if (a) {
          aiAgentConfig = {
            enabled: Boolean(a.enabled),
            triggerMode: a.triggerMode || 'ALWAYS',
            mode: a.mode || 'AI_ASSISTANT',
            provider: a.provider || 'gemini',
            apiKey: a.apiKey || '',
            model: a.model || 'gemini-2.0-flash',
            systemPrompt: a.systemPrompt || '',
            staticMessage: a.staticMessage || 'Halo! Layanan kami saat ini sedang berada di luar jam operasional. Terima kasih! 🙏',
          };
        }
        if (c) {
          chatbotConfig = {
            greetingText: c.greetingText || chatbotConfig.greetingText,
            rules: Array.isArray(c.rules) && c.rules.length > 0 ? c.rules : chatbotConfig.rules,
          };
        }
      }
    } catch (_) {}
  }

  async function saveSettings(e?: Event) {
    if (e && e.preventDefault) e.preventDefault();
    isSaving = true;
    successMsg = null;
    errorMsg = null;

    try {
      const cleanHours = $state.snapshot(operatingHours);
      const cleanAi = $state.snapshot(aiAgentConfig);
      const cleanChatbot = $state.snapshot(chatbotConfig);

      const res = await apiRequest<any>('/settings/operating-hours', {
        method: 'POST',
        body: JSON.stringify({
          operatingHours: cleanHours,
          aiAgentConfig: cleanAi,
          chatbotConfig: cleanChatbot,
        }),
      });
      isSaving = false;

      if (res.success) {
        successMsg = 'Pengaturan Chatbot & AI Agent berhasil disimpan!';
        setTimeout(() => (successMsg = null), 5000);
      } else {
        errorMsg = res.error || 'Gagal menyimpan pengaturan Chatbot & AI';
        setTimeout(() => (errorMsg = null), 5000);
      }
    } catch (err: any) {
      isSaving = false;
      errorMsg = err.message || 'Terjadi kesalahan sistem saat menyimpan';
      setTimeout(() => (errorMsg = null), 5000);
    }
  }

  async function testAiResponse() {
    if (!testMessage.trim()) return;
    isTesting = true;
    testReply = null;
    testError = null;

    try {
      const res = await apiRequest<any>('/settings/ai-agent/test', {
        method: 'POST',
        body: JSON.stringify({
          provider: aiAgentConfig.provider,
          systemPrompt: aiAgentConfig.systemPrompt,
          userMessage: testMessage,
          apiKey: aiAgentConfig.apiKey || undefined,
          model: aiAgentConfig.model || undefined,
        }),
      });
      isTesting = false;

      if (res.success && res.reply) {
        testReply = res.reply;
      } else {
        testError = res.error || 'AI tidak memberikan balasan.';
      }
    } catch (err: any) {
      isTesting = false;
      testError = err.message || 'Gagal menghubungi AI Engine';
    }
  }

  function applyPreset(key: string) {
    const preset = promptPresets[key];
    if (preset) {
      aiAgentConfig.systemPrompt = preset.text;
      appliedPresetKey = key;
    }
  }

  onMount(() => {
    loadSettings();
  });
</script>

<div class="p-8 max-w-4xl mx-auto space-y-6">
  {#if authStore.role && authStore.role !== 'ADMINISTRATOR' && authStore.role !== 'SUPER_ADMIN' && authStore.role !== 'SUPERVISOR'}
    <div class="p-10 max-w-md mx-auto text-center space-y-4 py-16">
      <div class="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-500/20 shadow-lg shadow-rose-500/10">
        <Shield class="w-8 h-8" />
      </div>
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">Akses Dibatasi</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Halaman Pengaturan Chatbot & AI Agent hanya dapat diakses oleh akun dengan hak akses Administrator atau Supervisor.
      </p>
    </div>
  {:else}
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Bot class="w-6 h-6 text-indigo-500" />
          Pengaturan Chatbot & AI Agent
        </h2>
        <p class="text-xs text-slate-600 dark:text-slate-400">Atur menu chatbot otomatis, asisten AI (Gemini), prompt bisnis, dan jam operasional</p>
      </div>

      <button
        type="button"
        onclick={saveSettings}
        disabled={isSaving}
        class="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
      >
        <Save class="w-4 h-4" />
        <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
      </button>
    </div>

    {#if successMsg}
      <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold animate-in fade-in">
        <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        {successMsg}
      </div>
    {/if}

    {#if errorMsg}
      <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 font-bold animate-in fade-in">
        <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        {errorMsg}
      </div>
    {/if}

    <!-- 1. AI Agent Activation & Mode Card -->
    <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Status Chatbot & Asisten AI</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Aktifkan pembalas otomatis untuk pesan pelanggan yang masuk</p>
          </div>
        </div>

        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" bind:checked={aiAgentConfig.enabled} class="sr-only peer" />
          <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      {#if aiAgentConfig.enabled}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <!-- Trigger Mode -->
          <div class="space-y-1.5">
            <label for="ai_trigger_mode" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Waktu Pemicu Respons</label>
            <select
              id="ai_trigger_mode"
              bind:value={aiAgentConfig.triggerMode}
              class="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="ALWAYS">⚡ 24/7 Selalu Aktif (Setiap Pesan Masuk)</option>
              <option value="OUT_OF_HOURS">🌙 Di Luar Jam Operasional Kerja Saja</option>
            </select>
          </div>

          <!-- Engine Mode -->
          <div class="space-y-1.5">
            <label for="ai_mode" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Modus Balasan</label>
            <select
              id="ai_mode"
              bind:value={aiAgentConfig.mode}
              class="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="AI_ASSISTANT">🤖 Hybrid Menu Chatbot + AI Agent (Gemini)</option>
              <option value="STATIC_MESSAGE">💬 Pesan Statis / Auto-Reply Teks Saja</option>
            </select>
          </div>
        </div>

        {#if aiAgentConfig.mode === 'AI_ASSISTANT'}
          <div class="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/60 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- AI Provider Selector -->
              <div class="space-y-1.5">
                <label for="ai_provider" class="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Zap class="w-4 h-4 text-indigo-500" />
                  Penyedia Mesin AI (Multi-Provider)
                </label>
                <select
                  id="ai_provider"
                  bind:value={aiAgentConfig.provider}
                  onchange={(e) => handleProviderChange((e.target as HTMLSelectElement).value)}
                  class="w-full p-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="gemini">✨ Google Gemini AI (Default - Cepat & Stabil)</option>
                  <option value="openai">🟩 OpenAI GPT (GPT-4o / GPT-4o-mini)</option>
                  <option value="claude">🟧 Anthropic Claude (Claude 3.5 Sonnet)</option>
                  <option value="custom_llm">🖥️ Local / Custom LLM (Ollama / LocalAI)</option>
                </select>
              </div>

              <!-- Model Selector (Dropdown Select List) -->
              <div class="space-y-1.5">
                <label for="ai_model" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Model AI Resmi</label>
                <select
                  id="ai_model"
                  value={isCustomModel ? 'CUSTOM' : aiAgentConfig.model}
                  onchange={(e) => handleModelSelect((e.target as HTMLSelectElement).value)}
                  class="w-full p-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {#each (providerModels[aiAgentConfig.provider] || providerModels['gemini']) as m}
                    <option value={m.id}>{m.label}</option>
                  {/each}
                </select>

                {#if isCustomModel}
                  <input
                    type="text"
                    bind:value={aiAgentConfig.model}
                    placeholder="Ketikkan ID model custom (cth: mistral-large / gpt-4o-2024-08-06)..."
                    class="w-full mt-2 p-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-indigo-500 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none animate-in fade-in"
                  />
                {/if}
              </div>
            </div>

            <!-- API Key Input -->
            <div class="space-y-1.5">
              <label for="ai_api_key" class="text-xs font-semibold text-slate-700 dark:text-slate-300">API Key ({aiAgentConfig.provider?.toUpperCase()})</label>
              <input
                id="ai_api_key"
                type="password"
                bind:value={aiAgentConfig.apiKey}
                placeholder="Masukkan API Key (cth: AIzaSy... / sk-proj...)"
                class="w-full p-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        {:else}
          <div class="space-y-1.5">
            <label for="ai_static_message" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Pesan Balasan Otomatis (Teks Statis)</label>
            <textarea
              id="ai_static_message"
              bind:value={aiAgentConfig.staticMessage}
              rows="3"
              class="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            ></textarea>
          </div>
        {/if}
      {/if}
    </div>

    <!-- 2. Custom Static Chatbot Rules & Greeting Menu Card -->
    <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Sliders class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Pengaturan Menu Statis Chatbot</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Atur pesan ucapan selamat datang & aturan kata kunci jawaban statis</p>
          </div>
        </div>

        <button
          type="button"
          onclick={addRule}
          class="py-2 px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-amber-500/20"
        >
          <span>+ Tambah Menu Statis</span>
        </button>
      </div>

      <!-- Greeting Menu Input -->
      <div class="space-y-1.5">
        <label for="chatbot_greeting" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Teks Ucapan Selamat Datang (Greeting Menu)</label>
        <textarea
          id="chatbot_greeting"
          bind:value={chatbotConfig.greetingText}
          rows="5"
          placeholder="Ketikkan menu ucapan selamat datang..."
          class="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed"
        ></textarea>
        <p class="text-[11px] text-slate-400">*Gunakan <code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">{"{{contactName}}"}</code> untuk menyapa nama pelanggan secara otomatis.</p>
      </div>

      <!-- Rules List -->
      <div class="space-y-3 pt-2">
        <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">Daftar Kata Kunci Jawaban Statis:</h4>

        {#each chatbotConfig.rules as rule, idx}
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-900 dark:text-white">Aturan #{idx + 1}: {rule.title}</span>
              <button
                type="button"
                onclick={() => removeRule(rule.id)}
                class="text-xs font-bold text-rose-500 hover:text-rose-600 transition"
              >
                Hapus
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label for={"rule_kw_" + rule.id} class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Kata Kunci (dipisahkan koma)</label>
                <input
                  id={"rule_kw_" + rule.id}
                  type="text"
                  value={rule.keywords.join(', ')}
                  onchange={(e) => (rule.keywords = (e.target as HTMLInputElement).value.split(',').map(s => s.trim()))}
                  placeholder="1, katalog, produk"
                  class="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div class="space-y-1">
                <label for={"rule_act_" + rule.id} class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Tindakan Aksi (*Action*)</label>
                <select
                  id={"rule_act_" + rule.id}
                  bind:value={rule.action}
                  class="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                >
                  <option value="REPLY">💬 Balas Teks Statis di Bawah</option>
                  <option value="HANDOFF_HUMAN">👤 Alihkan ke Agen CS Manusia (Antrean Queue)</option>
                  <option value="HANDOVER_AI">🤖 Serahkan ke AI Agent (Gemini/OpenAI)</option>
                </select>
              </div>
            </div>

            <div class="space-y-1">
              <label for={"rule_text_" + rule.id} class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Teks Balasan Statis</label>
              <textarea
                id={"rule_text_" + rule.id}
                bind:value={rule.replyText}
                rows="2"
                placeholder="Ketik balasan teks statis..."
                class="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
              ></textarea>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- 3. System Prompt & Presets -->
    {#if aiAgentConfig.enabled && aiAgentConfig.mode === 'AI_ASSISTANT'}
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <BookOpen class="w-5 h-5 text-indigo-500" />
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Panduan & Persona CS (System Prompt)</h3>
          </div>
        </div>

        <p class="text-xs text-slate-500 dark:text-slate-400">
          Pilih templat preset di bawah ini untuk mengisi aturan dasar AI Agent sesuai dengan jenis bisnis Anda:
        </p>

        <!-- Preset Buttons -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          {#each Object.entries(promptPresets) as [key, preset]}
            <button
              type="button"
              onclick={() => applyPreset(key)}
              class="p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between {appliedPresetKey === key
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-300'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}"
            >
              <div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-1 inline-block">
                  {preset.badge}
                </span>
                <p class="text-xs font-bold text-slate-900 dark:text-white">{preset.title}</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{preset.desc}</p>
              </div>
              <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-2 flex items-center gap-1">
                Gunakan Templat Ini →
              </span>
            </button>
          {/each}
        </div>

        <!-- Custom Prompt Textarea -->
        <div class="space-y-1.5 pt-2">
          <label for="ai_system_prompt" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Teks Instruksi System Prompt</label>
          <textarea
            id="ai_system_prompt"
            bind:value={aiAgentConfig.systemPrompt}
            rows="7"
            placeholder="Ketik aturan khusus, SOP perusahaan, atau FAQ produk Anda di sini..."
            class="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
          ></textarea>
        </div>
      </div>
    {/if}

    <!-- 3. Operating Hours Settings -->
    <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Clock class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Jam Operasional Layanan CS</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Atur hari dan jam buka kantor untuk memisahkan jam kerja agen manusia dan waktu tutup</p>
          </div>
        </div>

        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" bind:checked={operatingHours.enabled} class="sr-only peer" />
          <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {#if operatingHours.enabled}
        <div class="space-y-4 pt-1">
          <!-- Active Days Selector -->
          <div class="space-y-2">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Hari Kerja Aktif</span>
            <div class="flex flex-wrap gap-2">
              {#each daysOfWeek as day}
                <button
                  type="button"
                  onclick={() => toggleDay(day.id)}
                  class="py-1.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer {operatingHours.days.includes(day.id)
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}"
                >
                  {day.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Time Range & Timezone -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-1.5">
              <label for="hours_start" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Jam Mulai (Buka)</label>
              <input
                id="hours_start"
                type="time"
                bind:value={operatingHours.startTime}
                class="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div class="space-y-1.5">
              <label for="hours_end" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Jam Selesai (Tutup)</label>
              <input
                id="hours_end"
                type="time"
                bind:value={operatingHours.endTime}
                class="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div class="space-y-1.5">
              <label for="hours_timezone" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Zona Waktu</label>
              <select
                id="hours_timezone"
                bind:value={operatingHours.timezone}
                class="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
              </select>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- 4. Live Simulator Testing Playground -->
    <div class="p-6 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-800/60 shadow-xl text-white space-y-4">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
          <MessageSquare class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold">Simulator Uji Coba Chatbot & AI (*Live Playground*)</h3>
          <p class="text-xs text-indigo-200/80">Ketik pesan uji coba untuk melihat bagaimana Chatbot & AI merespons sebelum diterapkan</p>
        </div>
      </div>

      <div class="flex gap-2">
        <input
          type="text"
          bind:value={testMessage}
          placeholder="Ketik pertanyaan simulasi (contoh: halo / menu / cek resi)..."
          class="flex-1 p-3 text-xs rounded-xl bg-slate-800/80 border border-indigo-500/30 text-white font-medium focus:ring-2 focus:ring-indigo-400 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onclick={testAiResponse}
          disabled={isTesting}
          class="py-3 px-5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
        >
          <Send class="w-4 h-4" />
          <span>{isTesting ? 'Menguji...' : 'Uji Balasan'}</span>
        </button>
      </div>

      {#if testReply}
        <div class="p-4 rounded-xl bg-slate-800/90 border border-indigo-500/40 space-y-2 animate-in fade-in">
          <div class="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <Bot class="w-4 h-4" />
            <span>Hasil Balasan AI Agent:</span>
          </div>
          <p class="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">{testReply}</p>
        </div>
      {/if}

      {#if testError}
        <div class="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          {testError}
        </div>
      {/if}
    </div>
  {/if}
</div>
