<script lang="ts">
  import Alert from '$lib/components/ui/Alert.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
  import {
    fetchQuickReplies,
    saveQuickReplies,
    resetQuickReplies,
    readLegacyQuickReplies,
    clearLegacyQuickReplies,
    type QuickReplyItem,
  } from '$lib/api/quick-replies';
  import {
    Zap,
    Plus,
    Search,
    Pencil,
    Trash2,
    RotateCcw,
    Copy,
    Check,
    Lock,
    ShieldCheck,
    MessageSquare,
    Info,
    CornerDownLeft
  } from 'lucide-svelte';


  let customQuickReplies = $state<QuickReplyItem[]>([]);
  let searchQuery = $state('');
  let copiedId = $state<string | null>(null);

  // Form state
  let showFormModal = $state(false);
  let newQrShortcut = $state('');
  let newQrTitle = $state('');
  let newQrBody = $state('');
  let editingQrId = $state<string | null>(null);

  const canManage = $derived(
    ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'].includes(authStore.role || '')
  );

  const filteredReplies = $derived(
    customQuickReplies.filter((qr) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        qr.shortcut.toLowerCase().includes(q) ||
        qr.title.toLowerCase().includes(q) ||
        qr.body.toLowerCase().includes(q)
      );
    })
  );

  let loading = $state(true);
  let saving = $state(false);
  let notice = $state<{ tone: 'success' | 'error'; text: string } | null>(null);
  let isDefaultList = $state(false);
  let legacyItems = $state<QuickReplyItem[]>([]);

  function flash(tone: 'success' | 'error', text: string) {
    notice = { tone, text };
    if (tone === 'success') setTimeout(() => (notice = null), 4000);
  }

  async function loadQuickReplies() {
    loading = true;
    const res = await fetchQuickReplies();
    loading = false;
    if (res.error) {
      flash('error', res.error);
      return;
    }
    customQuickReplies = res.items;
    isDefaultList = res.isDefault;
    // Older versions kept the list only in this browser — offer a one-time import
    const legacy = readLegacyQuickReplies();
    legacyItems = canManage && legacy.length > 0 ? legacy : [];
  }

  /** Persist the whole list for the team; on failure keep what the server has. */
  async function persist(next: QuickReplyItem[], successText: string) {
    saving = true;
    const res = await saveQuickReplies(next);
    saving = false;
    if (!res.success) {
      flash('error', res.error || 'Gagal menyimpan balas cepat');
      return false;
    }
    customQuickReplies = res.items;
    isDefaultList = false;
    flash('success', successText);
    return true;
  }

  async function handleSaveQr() {
    if (!canManage) return;
    if (!newQrShortcut.trim() || !newQrTitle.trim() || !newQrBody.trim()) {
      flash('error', 'Isi shortcut, judul, dan isi balasan cepat.');
      return;
    }

    let shortcutClean = newQrShortcut.trim().toLowerCase().replace(/\s+/g, '_');
    if (!shortcutClean.startsWith('/')) shortcutClean = '/' + shortcutClean;

    const next = editingQrId
      ? customQuickReplies.map((q) =>
          q.id === editingQrId ? { ...q, shortcut: shortcutClean, title: newQrTitle.trim(), body: newQrBody.trim() } : q
        )
      : [{ id: 'qr-' + Date.now(), shortcut: shortcutClean, title: newQrTitle.trim(), body: newQrBody.trim() }, ...customQuickReplies];

    if (await persist(next, editingQrId ? 'Balas cepat diperbarui untuk seluruh tim.' : 'Balas cepat ditambahkan untuk seluruh tim.')) {
      editingQrId = null;
      showFormModal = false;
      newQrShortcut = '';
      newQrTitle = '';
      newQrBody = '';
    }
  }

  function editQr(qr: QuickReplyItem) {
    if (!canManage) return;
    editingQrId = qr.id;
    newQrShortcut = qr.shortcut;
    newQrTitle = qr.title;
    newQrBody = qr.body;
    showFormModal = true;
  }

  async function deleteQr(id: string) {
    if (!canManage) return;
    if (!confirm('Hapus balasan cepat ini untuk seluruh tim?')) return;
    await persist(customQuickReplies.filter((q) => q.id !== id), 'Balas cepat dihapus.');
  }

  async function resetDefaultQr() {
    if (!canManage) return;
    if (!confirm('Kembalikan daftar ke balasan cepat bawaan? Daftar tim saat ini akan diganti.')) return;
    saving = true;
    const res = await resetQuickReplies();
    saving = false;
    if (res.success) {
      customQuickReplies = res.items;
      isDefaultList = true;
      flash('success', 'Daftar dikembalikan ke bawaan.');
    } else flash('error', res.error || 'Gagal mengembalikan daftar');
  }

  async function importLegacy() {
    const byShortcut = new Map(customQuickReplies.map((q) => [q.shortcut, q]));
    for (const q of legacyItems) byShortcut.set(q.shortcut.startsWith('/') ? q.shortcut : '/' + q.shortcut, q);
    const merged = isDefaultList ? legacyItems : Array.from(byShortcut.values());
    if (await persist(merged, `${legacyItems.length} balas cepat dari browser ini sekarang tersedia untuk seluruh tim.`)) {
      clearLegacyQuickReplies();
      legacyItems = [];
    }
  }

  function dismissLegacy() {
    clearLegacyQuickReplies();
    legacyItems = [];
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    copiedId = id;
    setTimeout(() => {
      if (copiedId === id) copiedId = null;
    }, 2000);
  }

  onMount(() => {
    loadQuickReplies();
  });
</script>

<div class="ui-page">
  <PageHeader title="Balas Cepat" icon={Zap}>
    {#snippet meta()}
      <p class="max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Template jawaban singkat untuk tim CS. Ketik <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-emerald-600 dark:bg-slate-800 dark:text-emerald-400">/shortcut</code> di kolom pesan Inbox untuk memakainya.
      </p>
    {/snippet}
    {#snippet actions()}
      {#if canManage}
        <button type="button" onclick={resetDefaultQr} class="ui-btn-secondary">
          <RotateCcw class="h-4 w-4" />
          Reset Bawaan
        </button>
        <button
          type="button"
          onclick={() => { editingQrId = null; newQrShortcut = ''; newQrTitle = ''; newQrBody = ''; showFormModal = true; }}
          class="ui-btn-primary"
        >
          <Plus class="h-4 w-4" />
          Tambah Balas Cepat
        </button>
      {/if}
    {/snippet}
  </PageHeader>

  {#if notice}
    <Alert tone={notice.tone} message={notice.text} ondismiss={() => (notice = null)} />
  {/if}

  {#if legacyItems.length > 0}
    <Alert tone="info" title="Balas cepat lama ditemukan di browser ini">
      <p class="mt-0.5 opacity-90">
        {legacyItems.length} balas cepat sebelumnya hanya tersimpan di browser ini (agen lain tidak bisa melihatnya).
        Impor agar tersedia untuk seluruh tim.
      </p>
      <div class="mt-2 flex gap-2">
        <button type="button" class="ui-btn-primary !py-1.5 text-xs" onclick={importLegacy} disabled={saving}>Impor ke tim</button>
        <button type="button" class="ui-btn-ghost !py-1.5 text-xs" onclick={dismissLegacy}>Abaikan</button>
      </div>
    </Alert>
  {/if}

  {#if !canManage}
    <Alert
      tone="info"
      title="Akses baca saja"
      message="Balas Cepat dikelola oleh Supervisor & Administrator. Anda tetap bisa memakai semua shortcut saat membalas pesan."
    />
  {/if}

  <!-- Search & Filter Bar -->
  <div class="ui-card flex items-center justify-between gap-4 p-4">
    <div class="relative flex-1 max-w-md">
      <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Cari shortcut / nama / isi balasan cepat..."
        class="ui-input pl-9"
      />
    </div>

    <span class="text-xs text-slate-500 font-medium">
      Total <strong>{filteredReplies.length}</strong> Shortcut Balas Cepat
    </span>
  </div>

  <!-- Cards Grid -->
  {#if loading}
    <div class="ui-card p-10 text-center text-sm text-slate-500">Memuat balas cepat…</div>
  {:else if filteredReplies.length === 0}
    <div class="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
      <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
        <Zap class="w-6 h-6" />
      </div>
      <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Tidak ada template balas cepat ditemukan</p>
      <p class="text-xs text-slate-400 max-w-sm mx-auto">Coba kata kunci lain atau tambahkan template balasan cepat baru.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each filteredReplies as qr}
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 group">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {qr.shortcut}
              </span>

              <div class="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
                <button
                  type="button"
                  onclick={() => copyText(qr.body, qr.id)}
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Salin Teks"
                >
                  {#if copiedId === qr.id}
                    <Check class="w-3.5 h-3.5 text-emerald-500" />
                  {:else}
                    <Copy class="w-3.5 h-3.5" />
                  {/if}
                </button>

                {#if canManage}
                  <button
                    type="button"
                    onclick={() => editQr(qr)}
                    class="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer"
                    title="Edit Template"
                  >
                    <Pencil class="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onclick={() => deleteQr(qr.id)}
                    class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    title="Hapus Template"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                {/if}
              </div>
            </div>

            <h3 class="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{qr.title}</h3>

            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4 bg-slate-50/80 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 font-sans">
              {qr.body}
            </p>
          </div>

          <div class="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span class="flex items-center gap-1">
              <CornerDownLeft class="w-3 h-3 text-emerald-500" />
              Ketik {qr.shortcut} di Inbox
            </span>
            <span>Internal CS</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal Form Add/Edit Quick Reply -->
{#if showFormModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-lg rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Zap class="w-5 h-5 text-amber-500" />
          {editingQrId ? 'Edit Balas Cepat CS' : 'Tambah Balas Cepat CS Baru'}
        </h3>
        <button
          onclick={() => (showFormModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          ×
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label for="input_shortcut" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Shortcut (Contoh: <code class="font-mono text-emerald-600 dark:text-emerald-400">/salam</code>, <code class="font-mono text-emerald-600 dark:text-emerald-400">/harga</code>)
          </label>
          <input
            id="input_shortcut"
            type="text"
            bind:value={newQrShortcut}
            placeholder="/katalog /promo /rekening"
            class="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500 font-mono text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label for="input_title" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Judul Balas Cepat</label>
          <input
            id="input_title"
            type="text"
            bind:value={newQrTitle}
            placeholder="Contoh: Informasi Katalog & Pricelist"
            class="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label for="input_body" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Isi Pesan Balas Cepat</label>
          <textarea
            id="input_body"
            bind:value={newQrBody}
            rows="4"
            placeholder="Tuliskan pesan balasan lengkap yang akan otomatis tertempel saat shortcut dipilih..."
            class="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none leading-relaxed"
          ></textarea>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onclick={() => (showFormModal = false)}
          class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
        >
          Batal
        </button>

        <button
          type="button"
          onclick={handleSaveQr}
          class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          <span>{editingQrId ? 'Simpan Perubahan' : 'Tambah Balas Cepat'}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
