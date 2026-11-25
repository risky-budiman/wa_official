<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
  import {
    Bot, Save, Shield, Sparkles, ListChecks, Clock, Workflow, MessageSquareText, UserRound, BellOff,
    Plus, Trash2, ArrowUp, ArrowDown, Copy, X, KeyRound, Loader2, CheckCircle2, AlertTriangle, Send,
    RotateCcw, Info, Server, Zap, Moon, Sun,
  } from 'lucide-svelte';

  // ───────── types ─────────
  type RuleAction = 'REPLY' | 'HANDOFF_HUMAN' | 'HANDOVER_AI';
  interface Rule { id: string; title: string; keywords: string[]; replyText: string; action: RuleAction }
  type Provider = 'gemini' | 'openai' | 'claude' | 'custom_llm';
  type Fallback = 'AI_ASSISTANT' | 'STATIC_MESSAGE' | 'NONE';
  type Tab = 'behavior' | 'menu' | 'ai' | 'hours';

  const DEFAULT_GREETING = `Halo {{contactName}}! 👋 Selamat datang di {{businessName}}.

Silakan balas dengan angka:
1️⃣ Informasi produk
2️⃣ Cek status pesanan
3️⃣ Bicara dengan customer service`;

  // ───────── state ─────────
  let hours = $state({ enabled: false, timezone: 'Asia/Jakarta', days: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '17:00' });
  let ai = $state({
    enabled: false,
    triggerMode: 'ALWAYS' as 'ALWAYS' | 'OUT_OF_HOURS',
    mode: 'AI_ASSISTANT' as Fallback,
    provider: 'gemini' as Provider,
    apiKey: '',
    model: 'gemini-2.0-flash',
    baseUrl: '',
    systemPrompt: '',
    staticMessage: '',
  });
  let menu = $state({
    enabled: false,
    greetingText: DEFAULT_GREETING,
    greetingKeywords: ['halo', 'hai', 'hi', 'menu', 'mulai', 'p'],
    greetOnNewConversation: true,
    rules: [] as Rule[],
  });
  let hasApiKey = $state(false);
  let apiKeyHint = $state('');
  let editingKey = $state(false);
  let clearApiKey = $state(false);

  let tab = $state<Tab>('behavior');
  let loading = $state(true);
  let saving = $state(false);
  let notice = $state<{ tone: 'success' | 'error'; text: string } | null>(null);
  let savedSnapshot = $state('');

  const snapshot = () => JSON.stringify({ hours, ai, menu, clearApiKey });
  const isDirty = $derived(!loading && savedSnapshot !== '' && snapshot() !== savedSnapshot);

  const canEdit = $derived(['ADMINISTRATOR', 'SUPER_ADMIN', 'SUPERVISOR'].includes(authStore.role || ''));

  // ───────── constants ─────────
  const days = [
    { id: 1, label: 'Sen' }, { id: 2, label: 'Sel' }, { id: 3, label: 'Rab' }, { id: 4, label: 'Kam' },
    { id: 5, label: 'Jum' }, { id: 6, label: 'Sab' }, { id: 7, label: 'Min' },
  ];

  const providers: { id: Provider; name: string; desc: string; keyHint: string }[] = [
    { id: 'gemini', name: 'Google Gemini', desc: 'Cepat & hemat', keyHint: 'AIza…' },
    { id: 'openai', name: 'OpenAI', desc: 'GPT-4o / mini', keyHint: 'sk-…' },
    { id: 'claude', name: 'Anthropic Claude', desc: 'Natural & teliti', keyHint: 'sk-ant-…' },
    { id: 'custom_llm', name: 'Custom / Ollama', desc: 'Endpoint kompatibel OpenAI', keyHint: 'opsional' },
  ];

  const providerModels: Record<Provider, { id: string; label: string }[]> = {
    gemini: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — cepat & hemat (disarankan)' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — penalaran lebih dalam' },
    ],
    openai: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini — cepat & hemat (disarankan)' },
      { id: 'gpt-4o', label: 'GPT-4o' },
    ],
    claude: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — paling cerdas (disarankan)' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — seimbang' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — paling cepat & hemat' },
    ],
    custom_llm: [
      { id: 'llama3:8b', label: 'Llama 3 8B' },
      { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
      { id: 'mistral:7b', label: 'Mistral 7B' },
    ],
  };
  const isCustomModel = $derived(!providerModels[ai.provider].some((m) => m.id === ai.model));
  let customModelMode = $state(false);

  const presets = [
    {
      key: 'shop', title: 'Toko online', text: `Kamu adalah customer service toko online kami.
Informasi toko:
- Jam operasional: Senin–Sabtu 08.00–17.00 WIB
- Pengiriman: JNE, J&T, SiCepat. Ongkir dihitung dari kota tujuan.
- Retur: maksimal 2 hari setelah barang diterima, wajib video unboxing.

Cara menjawab:
- Untuk cek ongkir, tanyakan kecamatan & kota tujuan.
- Untuk cek pesanan, minta nomor invoice; jelaskan tim akan mengecek.
- Sapa pelanggan dengan "Kak".` },
    {
      key: 'clinic', title: 'Klinik / reservasi', text: `Kamu adalah admin reservasi klinik kami.
Informasi klinik:
- Jam buka: Senin–Sabtu 09.00–20.00 WIB
- Layanan: dokter umum, dokter gigi, laboratorium.

Cara menjawab:
- Untuk booking, minta nama lengkap, usia, layanan, dan tanggal kunjungan.
- Jangan memberi diagnosis. Untuk keadaan darurat, sarankan segera ke IGD terdekat.` },
    {
      key: 'service', title: 'Jasa / B2B', text: `Kamu adalah customer service perusahaan jasa kami.
Informasi:
- Jam kerja: Senin–Jumat 08.30–17.30 WIB
- Layanan utama: (tuliskan layanan Anda)

Cara menjawab:
- Untuk permintaan penawaran, minta nama perusahaan, kebutuhan, dan kontak PIC.
- Gunakan bahasa formal dan poin-poin yang rapi.` },
  ];

  const fallbackOptions: { id: Fallback; title: string; desc: string; icon: any }[] = [
    { id: 'AI_ASSISTANT', title: 'Dijawab AI', desc: 'AI menjawab berdasarkan panduan bisnis Anda.', icon: Sparkles },
    { id: 'STATIC_MESSAGE', title: 'Pesan otomatis', desc: 'Kirim satu pesan tetap (maks. sekali per 6 jam).', icon: MessageSquareText },
    { id: 'NONE', title: 'Diam, tunggu agen', desc: 'Tidak dibalas otomatis; agen yang menjawab.', icon: BellOff },
  ];

  const actionMeta: Record<RuleAction, { label: string; short: string; cls: string }> = {
    REPLY: { label: 'Balas teks', short: 'Balas', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
    HANDOFF_HUMAN: { label: 'Teruskan ke agen', short: 'Ke agen', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    HANDOVER_AI: { label: 'Serahkan ke AI', short: 'Ke AI', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
  };

  // ───────── load / save ─────────
  const parse = (v: any) => {
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return v;
  };

  async function load() {
    loading = true;
    const res = await apiRequest<any>('/settings/operating-hours');
    if (res.success) {
      const h = parse(res.operatingHours);
      const a = parse(res.aiAgentConfig);
      const c = parse(res.chatbotConfig);
      if (h) hours = { enabled: !!h.enabled, timezone: h.timezone || 'Asia/Jakarta', days: Array.isArray(h.days) ? h.days : [1, 2, 3, 4, 5], startTime: h.startTime || '08:00', endTime: h.endTime || '17:00' };
      if (a) {
        ai = {
          enabled: !!a.enabled,
          triggerMode: a.triggerMode === 'OUT_OF_HOURS' ? 'OUT_OF_HOURS' : 'ALWAYS',
          mode: ['AI_ASSISTANT', 'STATIC_MESSAGE', 'NONE'].includes(a.mode) ? a.mode : 'AI_ASSISTANT',
          provider: (['gemini', 'openai', 'claude', 'custom_llm'].includes(a.provider) ? a.provider : 'gemini') as Provider,
          apiKey: '',
          model: a.model || providerModels[(a.provider as Provider) || 'gemini']?.[0]?.id || 'gemini-2.0-flash',
          baseUrl: a.baseUrl || '',
          systemPrompt: a.systemPrompt || '',
          staticMessage: a.staticMessage || '',
        };
        // retired Claude 3.x ids → current default
        if (ai.provider === 'claude' && /^claude-(3|2|instant)/.test(ai.model)) ai.model = 'claude-opus-5-5';
        hasApiKey = !!a.hasApiKey;
        apiKeyHint = a.apiKeyHint || '';
      }
      if (c) {
        menu = {
          enabled: c.enabled === true,
          greetingText: typeof c.greetingText === 'string' && c.greetingText ? c.greetingText : DEFAULT_GREETING,
          greetingKeywords: Array.isArray(c.greetingKeywords) && c.greetingKeywords.length ? c.greetingKeywords : menu.greetingKeywords,
          greetOnNewConversation: c.greetOnNewConversation === true,
          rules: Array.isArray(c.rules)
            ? c.rules.map((r: any, i: number) => ({
                id: r.id || `rule-${i}`,
                title: r.title || `Menu ${i + 1}`,
                keywords: Array.isArray(r.keywords) ? r.keywords.filter(Boolean) : [],
                replyText: r.replyText || '',
                action: (['REPLY', 'HANDOFF_HUMAN', 'HANDOVER_AI'].includes(r.action) ? r.action : 'REPLY') as RuleAction,
              }))
            : [],
        };
      }
      customModelMode = false;
    } else {
      notice = { tone: 'error', text: res.error || 'Gagal memuat pengaturan' };
    }
    editingKey = false;
    clearApiKey = false;
    loading = false;
    savedSnapshot = snapshot();
  }

  async function save() {
    saving = true;
    notice = null;
    const aiPayload: any = { ...$state.snapshot(ai) };
    if (!aiPayload.apiKey) delete aiPayload.apiKey; // keep the stored key
    if (clearApiKey) aiPayload.clearApiKey = true;
    const res = await apiRequest<any>('/settings/operating-hours', {
      method: 'POST',
      body: JSON.stringify({
        operatingHours: $state.snapshot(hours),
        aiAgentConfig: aiPayload,
        chatbotConfig: { ...$state.snapshot(menu) },
      }),
    });
    saving = false;
    if (res.success) {
      notice = { tone: 'success', text: 'Pengaturan disimpan dan langsung berlaku untuk pesan WhatsApp berikutnya.' };
      await load();
      setTimeout(() => (notice = null), 5000);
    } else {
      notice = { tone: 'error', text: res.error || 'Gagal menyimpan pengaturan' };
    }
  }

  // ───────── menu helpers ─────────
  function addRule() {
    const n = menu.rules.length + 1;
    menu.rules = [...menu.rules, { id: `rule-${Date.now()}`, title: `Menu ${n}`, keywords: [String(n)], replyText: '', action: 'REPLY' }];
  }
  function moveRule(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= menu.rules.length) return;
    const copy = [...menu.rules];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    menu.rules = copy;
  }
  function duplicateRule(i: number) {
    const r = menu.rules[i];
    const copy = [...menu.rules];
    copy.splice(i + 1, 0, { ...r, id: `rule-${Date.now()}`, title: `${r.title} (salinan)`, keywords: [...r.keywords] });
    menu.rules = copy;
  }
  function removeRule(i: number) {
    menu.rules = menu.rules.filter((_, idx) => idx !== i);
  }
  function addKeyword(list: string[], raw: string): string[] {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...list];
    for (const p of parts) if (!next.some((k) => k.toLowerCase() === p.toLowerCase())) next.push(p);
    return next;
  }
  function keywordKeydown(e: KeyboardEvent, apply: (v: string[]) => void, list: string[]) {
    const input = e.currentTarget as HTMLInputElement;
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      apply(addKeyword(list, input.value));
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && list.length) {
      apply(list.slice(0, -1));
    }
  }
  function insertVar(field: 'greeting' | 'static' | number, v: string) {
    const token = `{{${v}}}`;
    if (field === 'greeting') menu.greetingText += token;
    else if (field === 'static') ai.staticMessage += token;
    else menu.rules[field].replyText += token;
  }

  // keywords used by more than one rule (first one wins → the later rule never triggers)
  const duplicateKeywords = $derived.by(() => {
    const seen = new Map<string, number>();
    const dup = new Set<string>();
    menu.rules.forEach((r) => r.keywords.forEach((k) => {
      const key = k.trim().toLowerCase();
      if (seen.has(key)) dup.add(key); else seen.set(key, 1);
    }));
    return dup;
  });

  // ───────── hours helpers ─────────
  function toggleDay(id: number) {
    hours.days = hours.days.includes(id) ? hours.days.filter((d) => d !== id) : [...hours.days, id].sort();
  }
  let now = $state(new Date());
  const openNow = $derived.by(() => {
    if (!hours.enabled) return null;
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: hours.timezone, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
      const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
      const day = map[parts.find((p) => p.type === 'weekday')?.value || 'Mon'];
      const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
      const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      const cur = h * 60 + m;
      const [sh, sm] = hours.startTime.split(':').map(Number);
      const [eh, em] = hours.endTime.split(':').map(Number);
      const open = hours.days.includes(day) && cur >= sh * 60 + sm && cur < eh * 60 + em;
      return { open, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
    } catch { return null; }
  });
  const tzLabel: Record<string, string> = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };

  // ───────── AI key test ─────────
  let testingKey = $state(false);
  let keyTest = $state<{ ok: boolean; text: string } | null>(null);
  async function testAi() {
    testingKey = true;
    keyTest = null;
    const res = await apiRequest<any>('/settings/ai-agent/test', {
      method: 'POST',
      body: JSON.stringify({
        provider: ai.provider,
        model: ai.model,
        apiKey: ai.apiKey || undefined,
        baseUrl: ai.provider === 'custom_llm' ? ai.baseUrl || undefined : undefined,
        systemPrompt: ai.systemPrompt,
        userMessage: 'Halo, tolong perkenalkan diri dalam satu kalimat.',
      }),
    });
    testingKey = false;
    keyTest = res.success ? { ok: true, text: res.reply } : { ok: false, text: res.error || 'Gagal terhubung ke AI' };
  }

  // ───────── simulator ─────────
  interface SimMsg { from: 'customer' | 'bot'; text: string; tag?: string; tone?: 'menu' | 'ai' | 'static' | 'handoff' | 'silent' | 'error' }
  let sim = $state<SimMsg[]>([]);
  let simInput = $state('');
  let simBusy = $state(false);
  let simHandedOff = $state(false);
  let simEl = $state<HTMLDivElement | null>(null);

  const simSuggestions = $derived.by(() => {
    const list = ['halo'];
    for (const r of menu.rules.slice(0, 3)) if (r.keywords[0]) list.push(r.keywords[0]);
    list.push('Berapa harga produknya?');
    return Array.from(new Set(list));
  });

  function resetSim() {
    sim = [];
    simHandedOff = false;
  }

  async function sendSim(text?: string) {
    const msg = (text ?? simInput).trim();
    if (!msg || simBusy) return;
    simInput = '';
    const isNew = sim.length === 0;
    sim = [...sim, { from: 'customer', text: msg }];
    scrollSim();
    if (simHandedOff) {
      sim = [...sim, { from: 'bot', text: 'Bot diam karena pelanggan sudah meminta agen. Agen yang akan membalas.', tone: 'silent', tag: 'Menunggu agen' }];
      scrollSim();
      return;
    }
    simBusy = true;
    const history = sim.slice(0, -1).map((m) => ({ role: m.from === 'customer' ? 'user' : 'model', text: m.text }));
    const aiPayload: any = { ...$state.snapshot(ai) };
    if (!aiPayload.apiKey) delete aiPayload.apiKey;
    const res = await apiRequest<any>('/settings/chatbot/simulate', {
      method: 'POST',
      body: JSON.stringify({ message: msg, isNewConversation: isNew, aiAgentConfig: aiPayload, chatbotConfig: $state.snapshot(menu), history }),
    });
    simBusy = false;
    if (!res.success) {
      sim = [...sim, { from: 'bot', text: res.error || 'Simulasi gagal', tone: 'error', tag: 'Error' }];
    } else if (res.kind === 'SILENT') {
      sim = [...sim, { from: 'bot', text: res.note || 'Tidak ada balasan otomatis.', tone: 'silent', tag: 'Tidak dibalas' }];
    } else if (res.kind === 'AI_ERROR') {
      sim = [...sim, { from: 'bot', text: res.reply, tone: 'error', tag: `AI gagal: ${res.error}` }];
    } else {
      const tag =
        res.kind === 'GREETING' ? 'Sapaan / menu utama'
        : res.kind === 'RULE' ? `Menu: ${res.ruleTitle}`
        : res.kind === 'AI' ? 'Jawaban AI'
        : 'Pesan otomatis';
      const tone = res.kind === 'AI' ? 'ai' : res.kind === 'STATIC' ? 'static' : 'menu';
      if (res.reply) sim = [...sim, { from: 'bot', text: res.reply, tag, tone }];
      if (res.handoff) {
        simHandedOff = true;
        sim = [...sim, { from: 'bot', text: 'Percakapan masuk antrean agen. Bot berhenti membalas sampai agen mengambil alih.', tone: 'handoff', tag: 'Diteruskan ke agen' }];
      }
    }
    scrollSim();
  }

  function scrollSim() {
    requestAnimationFrame(() => simEl?.scrollTo({ top: simEl.scrollHeight, behavior: 'smooth' }));
  }

  // WhatsApp-style formatting for the preview (*bold*, _italic_), escaped first
  function waFormat(text: string) {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<strong>$2</strong>')
      .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br/>');
  }

  // ───────── summary ─────────
  const statusSummary = $derived.by(() => {
    if (!ai.enabled) return 'Nonaktif — semua pesan dijawab agen.';
    const when = ai.triggerMode === 'OUT_OF_HOURS' && hours.enabled ? 'di luar jam kerja' : 'setiap saat';
    const parts = [];
    if (menu.enabled) parts.push('menu kata kunci');
    parts.push(ai.mode === 'AI_ASSISTANT' ? 'AI' : ai.mode === 'STATIC_MESSAGE' ? 'pesan otomatis' : 'meneruskan ke agen');
    return `Aktif ${when}: ${parts.join(' → ')}.`;
  });

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'behavior', label: 'Perilaku', icon: Workflow },
    { id: 'menu', label: 'Menu otomatis', icon: ListChecks },
    { id: 'ai', label: 'Asisten AI', icon: Sparkles },
    { id: 'hours', label: 'Jam kerja', icon: Clock },
  ];

  onMount(() => {
    load();
    const t = setInterval(() => (now = new Date()), 30000);
    return () => clearInterval(t);
  });
</script>

{#snippet varChips(field: 'greeting' | 'static' | number)}
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="text-xs text-slate-500 dark:text-slate-400">Sisipkan:</span>
    <button type="button" class="var-chip" onclick={() => insertVar(field, 'contactName')}>Nama pelanggan</button>
    <button type="button" class="var-chip" onclick={() => insertVar(field, 'businessName')}>Nama bisnis</button>
  </div>
{/snippet}

{#snippet toggle(checked: boolean, onchange: (v: boolean) => void, label: string)}
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onclick={() => onchange(!checked)}
    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors {checked ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}"
  >
    <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform {checked ? 'translate-x-5.5' : 'translate-x-0.5'}"></span>
  </button>
{/snippet}

<div class="ui-page">
  {#if authStore.role && !canEdit}
    <div class="ui-card mx-auto max-w-md p-10 text-center">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800"><Shield class="h-6 w-6" /></div>
      <h2 class="text-base font-semibold text-slate-900 dark:text-white">Akses dibatasi</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Pengaturan Chatbot & AI hanya untuk Administrator atau Supervisor.</p>
    </div>
  {:else}
    <PageHeader title="Chatbot & AI" description="Balas pesan WhatsApp secara otomatis dengan menu kata kunci dan asisten AI, lalu serahkan ke agen saat dibutuhkan." icon={Bot}>
      {#snippet meta()}
        <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset {ai.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20' : 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'}">
          <span class="h-1.5 w-1.5 rounded-full {ai.enabled ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          {ai.enabled ? 'Asisten aktif' : 'Asisten nonaktif'}
        </span>
      {/snippet}
      {#snippet actions()}
        <button type="button" class="ui-btn-primary" onclick={save} disabled={saving || loading || !isDirty}>
          {#if saving}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Save class="h-4 w-4" />{/if}
          {saving ? 'Menyimpan…' : isDirty ? 'Simpan perubahan' : 'Tersimpan'}
        </button>
      {/snippet}
    </PageHeader>

    {#if notice}<Alert tone={notice.tone} message={notice.text} ondismiss={() => (notice = null)} />{/if}

    {#if loading}
      <div class="ui-card flex items-center justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 class="h-5 w-5 animate-spin" /> Memuat pengaturan…</div>
    {:else}
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <!-- ═════════ SETTINGS ═════════ -->
        <div class="min-w-0 space-y-5">
          <div class="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70" role="tablist">
            {#each tabs as t}
              <button
                role="tab"
                aria-selected={tab === t.id}
                onclick={() => (tab = t.id)}
                class="inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition {tab === t.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}"
              >
                <t.icon class="h-4 w-4" />
                {t.label}
              </button>
            {/each}
          </div>

          {#if tab === 'behavior'}
            <!-- Master switch -->
            <section class="ui-card p-5">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-3">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><Bot class="h-5 w-5" /></span>
                  <div>
                    <h2 class="text-base font-semibold text-slate-900 dark:text-white">Asisten otomatis</h2>
                    <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{statusSummary}</p>
                  </div>
                </div>
                {@render toggle(ai.enabled, (v) => (ai.enabled = v), 'Aktifkan asisten otomatis')}
              </div>

              <!-- Flow -->
              <ol class="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
                {#each [
                  { t: 'Pesan masuk', d: 'Percakapan belum dipegang agen', on: true },
                  { t: 'Menu kata kunci', d: menu.enabled ? `${menu.rules.length} menu aktif` : 'Nonaktif', on: menu.enabled },
                  { t: ai.mode === 'AI_ASSISTANT' ? 'Jawaban AI' : ai.mode === 'STATIC_MESSAGE' ? 'Pesan otomatis' : 'Tanpa balasan', d: 'Jika tidak ada menu cocok', on: ai.mode !== 'NONE' },
                  { t: 'Agen manusia', d: 'Mengambil alih kapan saja', on: true },
                ] as step, i}
                  <li class="relative rounded-xl border px-3 py-2.5 {step.on && ai.enabled ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5' : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/30'}">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Langkah {i + 1}</p>
                    <p class="font-medium text-slate-900 dark:text-white">{step.t}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">{step.d}</p>
                  </li>
                {/each}
              </ol>
            </section>

            <!-- When -->
            <section class="ui-card space-y-3 p-5">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Kapan asisten membalas?</h3>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {#each [{ id: 'ALWAYS', title: 'Setiap saat (24/7)', desc: 'Membalas kapan pun, selama belum ada agen yang memegang percakapan.', icon: Sun }, { id: 'OUT_OF_HOURS', title: 'Hanya di luar jam kerja', desc: 'Pada jam kerja, pesan langsung masuk ke agen.', icon: Moon }] as opt}
                  <button type="button" onclick={() => (ai.triggerMode = opt.id as any)} class="option-card {ai.triggerMode === opt.id ? 'option-card-active' : ''}">
                    <opt.icon class="h-5 w-5 shrink-0 {ai.triggerMode === opt.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}" />
                    <span class="min-w-0 text-left">
                      <span class="block text-sm font-medium text-slate-900 dark:text-white">{opt.title}</span>
                      <span class="block text-xs text-slate-500 dark:text-slate-400">{opt.desc}</span>
                    </span>
                  </button>
                {/each}
              </div>
              {#if ai.triggerMode === 'OUT_OF_HOURS' && !hours.enabled}
                <Alert tone="warning" message="Jam kerja belum diatur, jadi asisten tetap membalas setiap saat. Atur di tab Jam kerja." />
              {/if}
            </section>

            <!-- Fallback -->
            <section class="ui-card space-y-3 p-5">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Jika pesan tidak cocok dengan menu</h3>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {#each fallbackOptions as opt}
                  <button type="button" onclick={() => (ai.mode = opt.id)} class="option-card flex-col items-start {ai.mode === opt.id ? 'option-card-active' : ''}">
                    <opt.icon class="h-5 w-5 {ai.mode === opt.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}" />
                    <span class="block text-left text-sm font-medium text-slate-900 dark:text-white">{opt.title}</span>
                    <span class="block text-left text-xs text-slate-500 dark:text-slate-400">{opt.desc}</span>
                  </button>
                {/each}
              </div>

              {#if ai.mode === 'AI_ASSISTANT' && !hasApiKey && !ai.apiKey && ai.provider !== 'custom_llm'}
                <Alert tone="warning" message="API key AI belum diisi. Buka tab Asisten AI untuk memasukkannya." />
              {/if}

              {#if ai.mode !== 'NONE'}
                <div class="space-y-1.5 pt-1">
                  <label for="static-msg" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {ai.mode === 'STATIC_MESSAGE' ? 'Isi pesan otomatis' : 'Pesan cadangan (dipakai bila AI gagal)'}
                  </label>
                  <textarea id="static-msg" rows="3" class="ui-input leading-relaxed" bind:value={ai.staticMessage} placeholder={'Halo {{contactName}}, terima kasih telah menghubungi {{businessName}}. Tim kami akan segera membalas. 🙏'}></textarea>
                  {@render varChips('static')}
                </div>
              {/if}
            </section>

          {:else if tab === 'menu'}
            <section class="ui-card p-5">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-base font-semibold text-slate-900 dark:text-white">Menu kata kunci</h2>
                  <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Balasan cepat & pasti untuk pertanyaan yang sering muncul. Diperiksa sebelum AI.</p>
                </div>
                {@render toggle(menu.enabled, (v) => (menu.enabled = v), 'Aktifkan menu kata kunci')}
              </div>
            </section>

            <div class="space-y-5 {menu.enabled ? '' : 'pointer-events-none opacity-50'}" aria-disabled={!menu.enabled}>
              <!-- Greeting -->
              <section class="ui-card space-y-4 p-5">
                <div>
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Sapaan & menu utama</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Dikirim saat pelanggan menyapa, misalnya mengetik "halo" atau "menu".</p>
                </div>
                <textarea rows="6" class="ui-input leading-relaxed" bind:value={menu.greetingText}></textarea>
                {@render varChips('greeting')}

                <div class="space-y-1.5">
                  <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Kata pemicu sapaan</span>
                  <div class="chip-input">
                    {#each menu.greetingKeywords as k, ki}
                      <span class="chip">{k}<button type="button" aria-label="Hapus {k}" onclick={() => (menu.greetingKeywords = menu.greetingKeywords.filter((_, i) => i !== ki))}><X class="h-3 w-3" /></button></span>
                    {/each}
                    <input class="min-w-[8rem] flex-1 bg-transparent text-sm outline-none" placeholder="Ketik lalu Enter…" onkeydown={(e) => keywordKeydown(e, (v) => (menu.greetingKeywords = v), menu.greetingKeywords)} />
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Harus sama persis dengan isi pesan.</p>
                </div>

                <label class="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" bind:checked={menu.greetOnNewConversation} />
                  <span>Kirim sapaan juga pada pesan pertama setiap percakapan baru <span class="text-slate-400">(jika tidak ada menu yang cocok)</span></span>
                </label>
              </section>

              <!-- Rules -->
              <section class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Pilihan menu <span class="font-normal text-slate-400">· {menu.rules.length}</span></h3>
                  <button type="button" class="ui-btn-secondary !py-1.5 text-xs" onclick={addRule}><Plus class="h-4 w-4" /> Tambah menu</button>
                </div>

                {#if menu.rules.length === 0}
                  <div class="ui-card flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <ListChecks class="h-8 w-8 text-slate-300" />
                    <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Belum ada pilihan menu</p>
                    <p class="max-w-sm text-xs text-slate-500">Contoh: kata kunci "1" atau "katalog" dibalas dengan link katalog produk.</p>
                    <button type="button" class="ui-btn-primary mt-2 !py-1.5 text-xs" onclick={addRule}><Plus class="h-4 w-4" /> Tambah menu pertama</button>
                  </div>
                {/if}

                {#each menu.rules as rule, i (rule.id)}
                  <article class="ui-card overflow-hidden">
                    <header class="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">{i + 1}</span>
                      <input class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-white" bind:value={rule.title} aria-label="Nama menu" />
                      <span class="hidden rounded-md px-2 py-0.5 text-[11px] font-medium sm:inline {actionMeta[rule.action].cls}">{actionMeta[rule.action].short}</span>
                      <div class="flex items-center">
                        <button type="button" class="ui-icon-btn h-7 w-7" title="Naikkan" aria-label="Naikkan" disabled={i === 0} onclick={() => moveRule(i, -1)}><ArrowUp class="h-4 w-4" /></button>
                        <button type="button" class="ui-icon-btn h-7 w-7" title="Turunkan" aria-label="Turunkan" disabled={i === menu.rules.length - 1} onclick={() => moveRule(i, 1)}><ArrowDown class="h-4 w-4" /></button>
                        <button type="button" class="ui-icon-btn h-7 w-7" title="Duplikat" aria-label="Duplikat" onclick={() => duplicateRule(i)}><Copy class="h-4 w-4" /></button>
                        <button type="button" class="ui-icon-btn h-7 w-7 hover:text-rose-600" title="Hapus" aria-label="Hapus menu" onclick={() => removeRule(i)}><Trash2 class="h-4 w-4" /></button>
                      </div>
                    </header>
                    <div class="space-y-4 p-4">
                      <div class="space-y-1.5">
                        <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Kata kunci</span>
                        <div class="chip-input">
                          {#each rule.keywords as k, ki}
                            <span class="chip {duplicateKeywords.has(k.trim().toLowerCase()) ? '!bg-amber-100 !text-amber-800 dark:!bg-amber-500/20 dark:!text-amber-200' : ''}">{k}<button type="button" aria-label="Hapus {k}" onclick={() => (rule.keywords = rule.keywords.filter((_, x) => x !== ki))}><X class="h-3 w-3" /></button></span>
                          {/each}
                          <input class="min-w-[8rem] flex-1 bg-transparent text-sm outline-none" placeholder="Ketik lalu Enter…" onkeydown={(e) => keywordKeydown(e, (v) => (rule.keywords = v), rule.keywords)} />
                        </div>
                        {#if rule.keywords.some((k) => duplicateKeywords.has(k.trim().toLowerCase()))}
                          <p class="text-xs text-amber-700 dark:text-amber-300">Kata kunci berwarna kuning juga dipakai menu lain — menu yang lebih atas yang dipakai.</p>
                        {:else}
                          <p class="text-xs text-slate-500 dark:text-slate-400">Angka & kata ≤2 huruf harus dikirim persis; kata lain cocok bila muncul utuh di pesan.</p>
                        {/if}
                      </div>

                      <div class="space-y-1.5">
                        <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Tindakan</span>
                        <div class="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                          {#each Object.entries(actionMeta) as [id, m]}
                            <button type="button" onclick={() => (rule.action = id as RuleAction)} class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition {rule.action === id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}">{m.label}</button>
                          {/each}
                        </div>
                      </div>

                      <div class="space-y-1.5">
                        <span class="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {rule.action === 'HANDOFF_HUMAN' ? 'Pesan sebelum diteruskan ke agen' : rule.action === 'HANDOVER_AI' ? 'Pesan pembuka (opsional — kosongkan agar AI langsung menjawab)' : 'Isi balasan'}
                        </span>
                        <textarea rows="3" class="ui-input leading-relaxed" bind:value={rule.replyText} placeholder={rule.action === 'HANDOFF_HUMAN' ? 'Baik {{contactName}}, kami hubungkan ke customer service ya. Mohon tunggu sebentar 🙏' : 'Tulis balasan…'}></textarea>
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          {@render varChips(i)}
                          {#if rule.action === 'REPLY' && !rule.replyText.trim()}<span class="text-xs text-rose-600">Isi balasan masih kosong</span>{/if}
                        </div>
                      </div>
                    </div>
                  </article>
                {/each}
              </section>
            </div>

          {:else if tab === 'ai'}
            <section class="ui-card space-y-4 p-5">
              <div>
                <h2 class="text-base font-semibold text-slate-900 dark:text-white">Penyedia AI</h2>
                <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Dipakai saat pesan tidak cocok dengan menu, atau menu "Serahkan ke AI".</p>
              </div>
              <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {#each providers as p}
                  <button
                    type="button"
                    onclick={() => { if (ai.provider !== p.id) { ai.provider = p.id; ai.model = providerModels[p.id][0].id; customModelMode = false; keyTest = null; } }}
                    class="option-card flex-col items-start {ai.provider === p.id ? 'option-card-active' : ''}"
                  >
                    {#if p.id === 'custom_llm'}<Server class="h-5 w-5 text-slate-400" />{:else}<Sparkles class="h-5 w-5 {ai.provider === p.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}" />{/if}
                    <span class="block text-left text-sm font-medium text-slate-900 dark:text-white">{p.name}</span>
                    <span class="block text-left text-xs text-slate-500 dark:text-slate-400">{p.desc}</span>
                  </button>
                {/each}
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                  <label for="ai-model" class="text-sm font-medium text-slate-700 dark:text-slate-300">Model</label>
                  <select
                    id="ai-model"
                    class="ui-input"
                    value={customModelMode || isCustomModel ? '__custom' : ai.model}
                    onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v === '__custom') { customModelMode = true; } else { customModelMode = false; ai.model = v; } }}
                  >
                    {#each providerModels[ai.provider] as m}<option value={m.id}>{m.label}</option>{/each}
                    <option value="__custom">Model lain (ketik manual)…</option>
                  </select>
                  {#if customModelMode || isCustomModel}
                    <input class="ui-input font-mono text-sm" bind:value={ai.model} placeholder="nama-model" aria-label="Nama model" />
                  {/if}
                </div>

                <div class="space-y-1.5">
                  <span class="text-sm font-medium text-slate-700 dark:text-slate-300">API key {ai.provider === 'custom_llm' ? '(opsional)' : ''}</span>
                  {#if hasApiKey && !editingKey && !clearApiKey}
                    <div class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <KeyRound class="h-4 w-4 text-emerald-600" />
                      <span class="flex-1 font-mono text-sm text-slate-700 dark:text-slate-300">Tersimpan {apiKeyHint}</span>
                      <button type="button" class="text-xs font-semibold text-emerald-600 hover:underline" onclick={() => (editingKey = true)}>Ganti</button>
                      <button type="button" class="text-xs font-semibold text-rose-600 hover:underline" onclick={() => (clearApiKey = true)}>Hapus</button>
                    </div>
                  {:else if clearApiKey}
                    <div class="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                      <span class="flex-1">API key akan dihapus saat disimpan.</span>
                      <button type="button" class="text-xs font-semibold hover:underline" onclick={() => (clearApiKey = false)}>Batal</button>
                    </div>
                  {:else}
                    <div class="flex gap-2">
                      <input type="password" autocomplete="off" class="ui-input font-mono" bind:value={ai.apiKey} placeholder={providers.find((p) => p.id === ai.provider)?.keyHint} />
                      {#if hasApiKey}<button type="button" class="ui-btn-ghost !px-2 text-xs" onclick={() => { editingKey = false; ai.apiKey = ''; }}>Batal</button>{/if}
                    </div>
                  {/if}
                  <p class="text-xs text-slate-500 dark:text-slate-400">Disimpan di server dan tidak pernah ditampilkan ulang.</p>
                </div>
              </div>

              {#if ai.provider === 'custom_llm'}
                <div class="space-y-1.5">
                  <label for="ai-base" class="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat endpoint</label>
                  <input id="ai-base" class="ui-input font-mono text-sm" bind:value={ai.baseUrl} placeholder="https://llm.domain-anda.com" />
                  <p class="text-xs text-slate-500 dark:text-slate-400">Harus kompatibel dengan API OpenAI (<code>/v1/chat/completions</code>). Alamat jaringan lokal server tidak diizinkan.</p>
                </div>
              {/if}

              <div class="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button type="button" class="ui-btn-secondary" onclick={testAi} disabled={testingKey}>
                  {#if testingKey}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Zap class="h-4 w-4" />{/if}
                  Tes koneksi AI
                </button>
                {#if keyTest}
                  <span class="flex min-w-0 flex-1 items-start gap-1.5 text-sm {keyTest.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                    {#if keyTest.ok}<CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0" />{:else}<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />{/if}
                    <span class="line-clamp-2">{keyTest.ok ? `Terhubung — "${keyTest.text}"` : keyTest.text}</span>
                  </span>
                {/if}
              </div>
            </section>

            <section class="ui-card space-y-4 p-5">
              <div>
                <h2 class="text-base font-semibold text-slate-900 dark:text-white">Panduan untuk AI</h2>
                <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Tuliskan informasi bisnis, FAQ, dan cara menjawab. AI tidak akan mengarang hal di luar panduan ini.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="self-center text-xs text-slate-500">Mulai dari contoh:</span>
                {#each presets as p}
                  <button type="button" class="var-chip" onclick={() => { if (!ai.systemPrompt.trim() || confirm('Ganti panduan saat ini dengan contoh?')) ai.systemPrompt = p.text; }}>{p.title}</button>
                {/each}
              </div>
              <textarea rows="12" class="ui-input font-mono text-[13px] leading-relaxed" bind:value={ai.systemPrompt} placeholder="Contoh:&#10;Nama bisnis: …&#10;Jam buka: …&#10;Produk/layanan: …&#10;Pertanyaan yang sering ditanyakan: …"></textarea>
              <div class="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                <Info class="mt-0.5 h-4 w-4 shrink-0" />
                <span>Aturan dasar sudah otomatis ditambahkan: jawab ramah & ringkas dalam Bahasa Indonesia, jangan mengarang harga/stok/status pesanan, dan tawarkan meneruskan ke customer service bila tidak tahu. {ai.systemPrompt.length.toLocaleString('id-ID')} karakter.</span>
              </div>
            </section>

          {:else if tab === 'hours'}
            <section class="ui-card space-y-5 p-5">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-base font-semibold text-slate-900 dark:text-white">Jam kerja tim</h2>
                  <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Dipakai bila asisten diatur "hanya di luar jam kerja".</p>
                </div>
                {@render toggle(hours.enabled, (v) => (hours.enabled = v), 'Aktifkan jam kerja')}
              </div>

              {#if hours.enabled}
                {#if openNow}
                  <div class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm {openNow.open ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}">
                    <span class="h-2 w-2 rounded-full {openNow.open ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                    Sekarang {openNow.time} {tzLabel[hours.timezone] || ''} — <strong class="font-semibold">{openNow.open ? 'jam kerja' : 'di luar jam kerja'}</strong>
                  </div>
                {/if}
                <div class="space-y-2">
                  <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Hari kerja</span>
                  <div class="flex flex-wrap gap-2">
                    {#each days as d}
                      <button type="button" onclick={() => toggleDay(d.id)} aria-pressed={hours.days.includes(d.id)} class="h-10 w-12 cursor-pointer rounded-xl text-sm font-medium transition {hours.days.includes(d.id) ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'}">{d.label}</button>
                    {/each}
                  </div>
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div class="space-y-1.5"><label for="h-start" class="text-sm font-medium text-slate-700 dark:text-slate-300">Buka</label><input id="h-start" type="time" class="ui-input" bind:value={hours.startTime} /></div>
                  <div class="space-y-1.5"><label for="h-end" class="text-sm font-medium text-slate-700 dark:text-slate-300">Tutup</label><input id="h-end" type="time" class="ui-input" bind:value={hours.endTime} /></div>
                  <div class="space-y-1.5">
                    <label for="h-tz" class="text-sm font-medium text-slate-700 dark:text-slate-300">Zona waktu</label>
                    <select id="h-tz" class="ui-input" bind:value={hours.timezone}>
                      <option value="Asia/Jakarta">WIB — Jakarta</option>
                      <option value="Asia/Makassar">WITA — Makassar</option>
                      <option value="Asia/Jayapura">WIT — Jayapura</option>
                    </select>
                  </div>
                </div>
              {/if}
            </section>
          {/if}

          {#if isDirty}
            <div class="sticky bottom-4 z-20 flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-white dark:text-slate-900">
              <span>Ada perubahan yang belum disimpan.</span>
              <div class="flex gap-2">
                <button type="button" class="rounded-lg px-3 py-1.5 font-medium text-slate-300 hover:text-white dark:text-slate-600 dark:hover:text-slate-900" onclick={load}>Batalkan</button>
                <button type="button" class="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-400" onclick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
              </div>
            </div>
          {/if}
        </div>

        <!-- ═════════ SIMULATOR ═════════ -->
        <aside class="xl:sticky xl:top-20 xl:self-start">
          <div class="ui-card flex h-[620px] flex-col overflow-hidden">
            <div class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white"><Bot class="h-5 w-5" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-900 dark:text-white">Uji coba langsung</p>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">Memakai pengaturan di layar (belum perlu disimpan)</p>
              </div>
              <button type="button" class="ui-icon-btn h-8 w-8" onclick={resetSim} title="Mulai ulang" aria-label="Mulai ulang"><RotateCcw class="h-4 w-4" /></button>
            </div>

            <div bind:this={simEl} class="chat-canvas flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {#if sim.length === 0}
                <div class="mx-auto mt-6 max-w-[16rem] rounded-xl bg-white/90 p-3 text-center text-xs text-slate-500 shadow-sm dark:bg-slate-800/90 dark:text-slate-400">
                  Ketik pesan seperti pelanggan untuk melihat balasan otomatis. Pesan pertama dianggap awal percakapan baru.
                </div>
              {/if}
              {#each sim as m}
                {#if m.from === 'customer'}
                  <div class="flex justify-end"><div class="max-w-[85%] rounded-2xl rounded-tr-md bg-emerald-100 px-3 py-2 text-sm text-slate-800 shadow-sm dark:bg-emerald-900/50 dark:text-slate-100">{m.text}</div></div>
                {:else if m.tone === 'silent' || m.tone === 'handoff'}
                  <div class="flex justify-center"><div class="max-w-[90%] rounded-lg bg-white/90 px-3 py-1.5 text-center text-[11px] text-slate-500 shadow-sm dark:bg-slate-800/90 dark:text-slate-400"><span class="font-semibold">{m.tag}</span> · {m.text}</div></div>
                {:else}
                  <div class="flex justify-start">
                    <div class="max-w-[85%] rounded-2xl rounded-tl-md bg-white px-3 pt-1.5 pb-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700/60">
                      <p class="mb-0.5 text-[11px] font-semibold {m.tone === 'ai' ? 'text-violet-600 dark:text-violet-300' : m.tone === 'error' ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}">{m.tag}</p>
                      <div class="break-words">{@html waFormat(m.text)}</div>
                    </div>
                  </div>
                {/if}
              {/each}
              {#if simBusy}
                <div class="flex justify-start"><div class="rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-slate-800"><Loader2 class="h-4 w-4 animate-spin text-slate-400" /></div></div>
              {/if}
            </div>

            <div class="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
              <div class="flex gap-1.5 overflow-x-auto pb-0.5">
                {#each simSuggestions as s}
                  <button type="button" class="var-chip shrink-0" onclick={() => sendSim(s)} disabled={simBusy}>{s}</button>
                {/each}
              </div>
              <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); sendSim(); }}>
                <input class="ui-input" bind:value={simInput} placeholder="Tulis pesan pelanggan…" aria-label="Pesan uji coba" />
                <button type="submit" class="ui-btn-primary !px-3" disabled={simBusy || !simInput.trim()} aria-label="Kirim"><Send class="h-4 w-4" /></button>
              </form>
              <p class="text-[11px] text-slate-400">Jawaban AI di uji coba memakai API key sungguhan dan bisa dikenakan biaya oleh penyedia AI.</p>
            </div>
          </div>
        </aside>
      </div>

    {/if}
  {/if}
</div>

<style>
  :global(.option-card) {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    cursor: pointer;
    border-radius: 0.875rem;
    border: 1px solid rgb(226 232 240);
    background: white;
    padding: 0.875rem;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  }
  :global(.option-card:hover) { border-color: rgb(203 213 225); }
  :global(.option-card-active) {
    border-color: rgb(16 185 129);
    background: rgb(236 253 245 / 0.6);
    box-shadow: 0 0 0 3px rgb(16 185 129 / 0.12);
  }
  :global(.dark .option-card) { border-color: rgb(51 65 85); background: rgb(15 23 42); }
  :global(.dark .option-card-active) { border-color: rgb(52 211 153); background: rgb(16 185 129 / 0.08); }
  :global(.var-chip) {
    cursor: pointer;
    border-radius: 9999px;
    border: 1px solid rgb(226 232 240);
    background: white;
    padding: 0.2rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgb(71 85 105);
    transition: background-color 0.15s;
  }
  :global(.var-chip:hover) { background: rgb(241 245 249); }
  :global(.dark .var-chip) { border-color: rgb(51 65 85); background: rgb(15 23 42); color: rgb(203 213 225); }
  :global(.chip-input) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    min-height: 2.6rem;
    border-radius: 0.75rem;
    border: 1px solid rgb(226 232 240);
    background: white;
    padding: 0.375rem 0.5rem;
  }
  :global(.chip-input:focus-within) { border-color: rgb(16 185 129); box-shadow: 0 0 0 4px rgb(16 185 129 / 0.1); }
  :global(.dark .chip-input) { border-color: rgb(51 65 85); background: rgb(15 23 42); color: white; }
  :global(.chip) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 0.5rem;
    background: rgb(241 245 249);
    padding: 0.15rem 0.35rem 0.15rem 0.55rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: rgb(30 41 59);
  }
  :global(.chip button) { cursor: pointer; border-radius: 0.25rem; padding: 0.1rem; color: rgb(148 163 184); }
  :global(.chip button:hover) { color: rgb(225 29 72); }
  :global(.dark .chip) { background: rgb(30 41 59); color: rgb(226 232 240); }
</style>
