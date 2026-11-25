<script lang="ts">
  import Alert from '$lib/components/ui/Alert.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
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

  interface QuickReplyItem {
    id: string;
    shortcut: string;
    title: string;
    body: string;
  }

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

  function loadQuickReplies() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wa_crm_quick_replies');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            customQuickReplies = parsed;
            return;
          }
        } catch (e) {}
      }
    }
    // Default fallback list
    customQuickReplies = [
      {
        id: 'qr-salam',
        shortcut: '/salam',
        title: 'Salam & Sapaan Pelanggan',
        body: 'Halo, terima kasih telah menghubungi kami. Ada yang bisa kami bantu hari ini? 😊',
      },
      {
        id: 'qr-terimakasih',
        shortcut: '/terimakasih',
        title: 'Ucapan Terima Kasih',
        body: 'Terima kasih banyak atas kepercayaan Anda. Jika ada pertanyaan lain, jangan ragu untuk menghubungi kami kembali! 🙏',
      },
      {
        id: 'qr-jamkerja',
        shortcut: '/jam_kerja',
        title: 'Jam Operasional Layanan',
        body: 'Jam operasional layanan kami adalah Senin - Jumat (08.00 - 17.00 WIB) dan Sabtu (08.00 - 12.00 WIB).',
      },
      {
        id: 'qr-rekening',
        shortcut: '/rekening',
        title: 'Nomor Rekening Pembayaran',
        body: 'Berikut nomor rekening resmi pembayaran kami:\nBCA: 1234567890 a.n. PT Official WA CRM\nMandiri: 0987654321 a.n. PT Official WA CRM',
      },
      {
        id: 'qr-tunggu',
        shortcut: '/tunggu',
        title: 'Konfirmasi Mohon Tunggu',
        body: 'Mohon tunggu sebentar ya kak, tim kami sedang mengecek data Anda.',
      },
    ];
  }

  function saveQuickReplies() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_quick_replies', JSON.stringify(customQuickReplies));
    }
  }

  function handleSaveQr() {
    if (!canManage) {
      alert('Hanya Supervisor dan Admin yang memiliki akses menambahkan atau mengubah template balas cepat.');
      return;
    }

    if (!newQrShortcut.trim() || !newQrTitle.trim() || !newQrBody.trim()) {
      alert('Harap isi shortcut, judul, dan isi balasan cepat.');
      return;
    }

    let shortcutClean = newQrShortcut.trim();
    if (!shortcutClean.startsWith('/')) {
      shortcutClean = '/' + shortcutClean;
    }

    if (editingQrId) {
      customQuickReplies = customQuickReplies.map((q) =>
        q.id === editingQrId
          ? { ...q, shortcut: shortcutClean, title: newQrTitle.trim(), body: newQrBody.trim() }
          : q
      );
      editingQrId = null;
    } else {
      customQuickReplies.unshift({
        id: 'qr-' + Date.now(),
        shortcut: shortcutClean,
        title: newQrTitle.trim(),
        body: newQrBody.trim(),
      });
    }

    saveQuickReplies();
    showFormModal = false;
    newQrShortcut = '';
    newQrTitle = '';
    newQrBody = '';
  }

  function editQr(qr: QuickReplyItem) {
    if (!canManage) return;
    editingQrId = qr.id;
    newQrShortcut = qr.shortcut;
    newQrTitle = qr.title;
    newQrBody = qr.body;
    showFormModal = true;
  }

  function deleteQr(id: string) {
    if (!canManage) return;
    if (!confirm('Hapus balasan cepat ini?')) return;
    customQuickReplies = customQuickReplies.filter((q) => q.id !== id);
    saveQuickReplies();
  }

  function resetDefaultQr() {
    if (!canManage) return;
    if (!confirm('Kembalikan daftar ke template balasan cepat bawaan awal?')) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wa_crm_quick_replies');
    }
    loadQuickReplies();
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
  {#if filteredReplies.length === 0}
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
