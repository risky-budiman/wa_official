<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { formatWhatsAppMarkdown } from '$lib/utils/whatsapp-formatter';
  import { Send, X, AlertCircle, CheckCircle2, Smartphone, Sparkles, Image, FileText, User, Loader2 } from 'lucide-svelte';

  export interface TemplateItem {
    id: string;
    name: string;
    category: string;
    language: string;
    status: string;
    components: any[];
  }

  let {
    isOpen = $bindable(false),
    templates = [],
    initialTemplate = null,
    initialPhoneNumber = '',
    initialContactName = '',
    onSuccess = () => {},
    onClose = () => {},
  }: {
    isOpen: boolean;
    templates: TemplateItem[];
    initialTemplate?: TemplateItem | null;
    initialPhoneNumber?: string;
    initialContactName?: string;
    onSuccess?: () => void;
    onClose?: () => void;
  } = $props();

  let selectedTemplateId = $state('');
  let recipientWaId = $state('');
  let contactName = $state('');
  let isSending = $state(false);
  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  // Dynamic variable parameters map
  let bodyVars = $state<Record<string, string>>({});
  let headerVar = $state('');
  let headerMediaUrl = $state('');
  let initializedForTemplateId = $state('');

  // Auto-sync initial phone and contact name on open
  $effect(() => {
    if (isOpen) {
      if (initialPhoneNumber) recipientWaId = initialPhoneNumber;
      if (initialContactName) contactName = initialContactName;
      if (initialTemplate) {
        selectedTemplateId = initialTemplate.id;
      }
    }
  });

  // Selected template object (fallback to first approved or first available)
  let selectedTemplate = $derived.by(() => {
    if (selectedTemplateId) {
      const found = templates.find((t) => t.id === selectedTemplateId);
      if (found) return found;
    }
    const approved = templates.find((t) => t.status === 'APPROVED');
    return approved || (templates.length > 0 ? templates[0] : null);
  });

  // Keep selectedTemplateId in sync once template is resolved
  $effect(() => {
    if (selectedTemplate && selectedTemplate.id !== selectedTemplateId) {
      selectedTemplateId = selectedTemplate.id;
    }
  });

  // Find components
  let headerComponent = $derived.by(() => {
    return selectedTemplate?.components?.find((c: any) => c.type === 'HEADER') || null;
  });

  let bodyComponent = $derived.by(() => {
    return selectedTemplate?.components?.find((c: any) => c.type === 'BODY') || null;
  });

  let footerComponent = $derived.by(() => {
    return selectedTemplate?.components?.find((c: any) => c.type === 'FOOTER') || null;
  });

  // Check if header needs dynamic parameters
  let headerNeedsParam = $derived.by(() => {
    if (!headerComponent) return false;
    const format = (headerComponent.format || '').toUpperCase();
    if (format === 'IMAGE' || format === 'DOCUMENT' || format === 'VIDEO') return true;
    if (format === 'TEXT') {
      return (headerComponent.text || '').includes('{{');
    }
    return false;
  });

  // Extract variable indices in BODY e.g. {{1}}, {{2}}
  let bodyVarIndices = $derived.by(() => {
    const text = bodyComponent?.text || '';
    const matches = Array.from(text.matchAll(/\{\{(\d+)\}\}/g));
    if (matches.length === 0) return [];
    return Array.from(new Set(matches.map((m) => parseInt(m[1], 10)))).sort((a, b) => a - b);
  });

  // Safely initialize variable inputs when selectedTemplate changes (no infinite loops)
  $effect(() => {
    const tpl = selectedTemplate;
    if (tpl && tpl.id !== initializedForTemplateId) {
      initializedForTemplateId = tpl.id;
      const initialMap: Record<string, string> = {};
      const text = tpl.components?.find((c: any) => c.type === 'BODY')?.text || '';
      const matches = Array.from(text.matchAll(/\{\{(\d+)\}\}/g));
      const indices = Array.from(new Set(matches.map((m) => parseInt(m[1], 10)))).sort((a, b) => a - b);
      indices.forEach((idx) => {
        initialMap[String(idx)] = (idx === 1 && contactName) ? contactName : '';
      });
      bodyVars = initialMap;
      headerVar = '';
      headerMediaUrl = '';
    }
  });

  // Rendered Live Body Preview
  let renderedBodyText = $derived.by(() => {
    let text = bodyComponent?.text || '';
    bodyVarIndices.forEach((idx) => {
      const val = bodyVars[String(idx)] || `{{${idx}}}`;
      text = text.replaceAll(`{{${idx}}}`, val);
    });
    return text;
  });

  function handleClose() {
    isOpen = false;
    successMsg = null;
    errorMsg = null;
    if (onClose) onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      handleClose();
    }
  }

  async function handleSend(e: Event) {
    e.preventDefault();
    if (!recipientWaId.trim()) {
      errorMsg = 'Nomor WhatsApp tujuan wajib diisi';
      return;
    }
    if (!selectedTemplate) {
      errorMsg = 'Pilihlah salah satu template Meta yang aktif';
      return;
    }

    isSending = true;
    successMsg = null;
    errorMsg = null;

    try {
      // Build Meta API components structure
      const formattedComponents: any[] = [];

      // 1. HEADER parameters (only if header is dynamic)
      if (headerComponent && headerNeedsParam) {
        const format = (headerComponent.format || '').toUpperCase();
        if (format === 'TEXT' && headerVar.trim()) {
          formattedComponents.push({
            type: 'header',
            parameters: [{ type: 'text', text: headerVar.trim() }],
          });
        } else if (format === 'IMAGE' && headerMediaUrl.trim()) {
          formattedComponents.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: headerMediaUrl.trim() } }],
          });
        } else if (format === 'DOCUMENT' && headerMediaUrl.trim()) {
          formattedComponents.push({
            type: 'header',
            parameters: [{ type: 'document', document: { link: headerMediaUrl.trim(), filename: 'Dokumen.pdf' } }],
          });
        }
      }

      // 2. BODY parameters
      if (bodyVarIndices.length > 0) {
        const bodyParams = bodyVarIndices.map((idx) => ({
          type: 'text',
          text: (bodyVars[String(idx)] || '').trim() || `-`,
        }));
        formattedComponents.push({
          type: 'body',
          parameters: bodyParams,
        });
      }

      const res = await apiRequest<any>('/templates/send-individual', {
        method: 'POST',
        body: JSON.stringify({
          recipientWaId: recipientWaId.trim(),
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language || 'id',
          components: formattedComponents.length > 0 ? formattedComponents : undefined,
          contactName: contactName.trim() || undefined,
        }),
      });

      isSending = false;

      if (res.success) {
        successMsg = res.message || 'Pesan template personal berhasil dikirim!';
        if (onSuccess) onSuccess();
        setTimeout(() => {
          handleClose();
        }, 1800);
      } else {
        errorMsg = res.error || 'Gagal mengirim pesan template';
      }
    } catch (err: any) {
      isSending = false;
      errorMsg = err.message || 'Terjadi kesalahan sistem saat mengirim pesan';
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
  >
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden my-6 space-y-0 flex flex-col max-h-[92vh]">
      <!-- Modal Header -->
      <div class="p-5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <Send class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Kirim Pesan Template Personal</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Kirim pesan WhatsApp resmi Meta secara instan ke 1 nomor tujuan</p>
          </div>
        </div>

        <button
          type="button"
          onclick={handleClose}
          class="w-8 h-8 rounded-xl bg-slate-200/60 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition cursor-pointer"
          title="Tutup Modal"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Notification Alerts -->
      {#if successMsg}
        <div class="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      {/if}
      {#if errorMsg}
        <div class="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2.5 text-xs font-bold text-rose-800 dark:text-rose-300">
          <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <!-- Form & Body (Scrollable) -->
      <form onsubmit={handleSend} class="flex flex-col flex-1 overflow-hidden">
        <div class="p-6 space-y-4 overflow-y-auto flex-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Nomor WhatsApp Tujuan -->
            <div>
              <label for="wa_dest" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Smartphone class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Nomor WhatsApp Tujuan <span class="text-rose-500">*</span>
              </label>
              <input
                id="wa_dest"
                type="text"
                bind:value={recipientWaId}
                placeholder="081234567890 atau +6281234567890"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <!-- Nama Pelanggan (Optional) -->
            <div>
              <label for="c_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Nama Pelanggan (Opsional)
              </label>
              <input
                id="c_name"
                type="text"
                bind:value={contactName}
                placeholder="e.g. Budi Santoso"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <!-- Pilih Template Meta -->
          <div>
            <label for="tpl_sel" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-amber-500" />
              Pilih Template WhatsApp Resmi
            </label>
            {#if templates.length === 0}
              <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-500 text-xs flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin text-emerald-500" />
                <span>Memuat daftar template resmi...</span>
              </div>
            {:else}
              <select
                id="tpl_sel"
                bind:value={selectedTemplateId}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              >
                {#each templates as tpl}
                  <option value={tpl.id}>
                    {tpl.name} ({tpl.category}) [{tpl.status}]
                  </option>
                {/each}
              </select>
            {/if}
          </div>

          <!-- Variabel Form (jika ada variable {{1}}, {{2}} dll) -->
          {#if selectedTemplate}
            {#if headerComponent && headerNeedsParam}
              <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <span class="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Variabel Header ({headerComponent.format}):
                </span>
                {#if headerComponent.format === 'TEXT'}
                  <input
                    type="text"
                    bind:value={headerVar}
                    placeholder="Isi teks variabel header..."
                    class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  />
                {:else if headerComponent.format === 'IMAGE' || headerComponent.format === 'DOCUMENT'}
                  <input
                    type="url"
                    bind:value={headerMediaUrl}
                    placeholder="Masukkan URL Media (https://...)"
                    class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                {/if}
              </div>
            {/if}

            {#if bodyVarIndices.length > 0}
              <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <span class="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Variabel Pesan ({bodyVarIndices.length} Variabel):
                </span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {#each bodyVarIndices as idx}
                    <div>
                      <label for={`var_${idx}`} class="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Variabel `&#123;&#123;{idx}&#125;&#125;`:
                      </label>
                      <input
                        id={`var_${idx}`}
                        type="text"
                        bind:value={bodyVars[String(idx)]}
                        placeholder={`Nilai untuk {{${idx}}}...`}
                        class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Live WhatsApp Bubble Preview -->
            <div class="space-y-1.5">
              <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Pratinjau Pesan WhatsApp (Live Preview):
              </span>
              <div class="p-4 rounded-2xl bg-[#E5DDD5] dark:bg-[#0b141a] border border-slate-300 dark:border-slate-800">
                <div class="max-w-md ml-auto bg-white dark:bg-[#202c33] rounded-2xl rounded-tr-none p-3.5 shadow-sm space-y-2 text-slate-900 dark:text-slate-100">
                  {#if headerComponent}
                    <div class="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1">
                      {#if headerComponent.format === 'TEXT'}
                        {headerVar || headerComponent.text || 'Header WhatsApp'}
                      {:else if headerComponent.format === 'IMAGE'}
                        <div class="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"><Image class="w-4 h-4" /> [Gambar Header]</div>
                      {:else if headerComponent.format === 'DOCUMENT'}
                        <div class="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400"><FileText class="w-4 h-4" /> [Dokumen PDF]</div>
                      {/if}
                    </div>
                  {/if}

                  <div class="text-xs leading-relaxed font-sans whitespace-pre-wrap">
                    {@html formatWhatsAppMarkdown(renderedBodyText)}
                  </div>

                  {#if footerComponent?.text}
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      {footerComponent.text}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Sticky Submit Footer Buttons -->
        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onclick={handleClose}
            class="py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={isSending || !selectedTemplate}
            class="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-60"
          >
            {#if isSending}
              <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              <span>Mengirim...</span>
            {:else}
              <Send class="w-4 h-4" />
              <span>Kirim Template Sekarang</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
