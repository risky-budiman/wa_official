<script lang="ts">
  import type { Snippet } from 'svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { MessageCircle, Sun, Moon, MessagesSquare, Users, BarChart3, ShieldCheck } from 'lucide-svelte';

  interface Props {
    title: string;
    subtitle?: string;
    /** Max width of the form column */
    width?: 'sm' | 'md';
    children: Snippet;
    footer?: Snippet;
  }
  let { title, subtitle, width = 'sm', children, footer }: Props = $props();

  const highlights = [
    { icon: MessagesSquare, text: 'Satu inbox untuk seluruh percakapan WhatsApp tim Anda' },
    { icon: Users, text: 'Bagi tugas otomatis ke agen, pantau beban kerja secara real-time' },
    { icon: BarChart3, text: 'Laporan waktu respons dan kampanye broadcast dalam satu tempat' },
    { icon: ShieldCheck, text: 'Terhubung resmi lewat Meta WhatsApp Cloud API' },
  ];
</script>

<div class="flex min-h-screen w-full bg-white dark:bg-slate-950">
  <!-- Brand panel (desktop) -->
  <aside class="sticky top-0 hidden h-screen w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-emerald-700 p-10 text-white lg:flex xl:p-14 dark:bg-emerald-900">
    <div class="pointer-events-none absolute inset-0 opacity-[0.12]" style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 22px 22px;" aria-hidden="true"></div>
    <div class="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-emerald-400/30 blur-3xl" aria-hidden="true"></div>

    <div class="relative flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700">
        <MessageCircle class="h-5 w-5" />
      </div>
      <span class="text-lg font-semibold tracking-tight">WhatsApp CRM</span>
    </div>

    <div class="relative space-y-8">
      <h2 class="max-w-md text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
        Layani pelanggan WhatsApp lebih cepat, bersama tim.
      </h2>
      <ul class="space-y-4">
        {#each highlights as h}
          <li class="flex items-start gap-3 text-[15px] text-emerald-50/90">
            <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
              <h.icon class="h-4 w-4" />
            </span>
            {h.text}
          </li>
        {/each}
      </ul>
    </div>

    <p class="relative text-xs text-emerald-100/70">© {new Date().getFullYear()} WhatsApp CRM</p>
  </aside>

  <!-- Form column -->
  <main class="relative flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 dark:bg-slate-950">
    <button
      onclick={() => themeStore.toggle()}
      class="ui-icon-btn absolute top-4 right-4 sm:top-6 sm:right-6"
      title="Ubah tema"
      aria-label="Ubah tema"
    >
      {#if themeStore.current === 'dark'}<Sun class="h-5 w-5" />{:else}<Moon class="h-5 w-5" />{/if}
    </button>

    <div class="w-full {width === 'md' ? 'max-w-lg' : 'max-w-sm'}">
      <!-- Mobile logo -->
      <div class="mb-8 flex items-center gap-2.5 lg:hidden">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <MessageCircle class="h-5 w-5" />
        </div>
        <span class="text-base font-semibold tracking-tight text-slate-900 dark:text-white">WhatsApp CRM</span>
      </div>

      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      {#if subtitle}<p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>{/if}

      <div class="mt-8">
        {@render children()}
      </div>

      {#if footer}
        <div class="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">{@render footer()}</div>
      {/if}

      <p class="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        <a href="/privacy" class="hover:text-slate-600 hover:underline dark:hover:text-slate-300">Kebijakan Privasi</a>
        ·
        <a href="/terms" class="hover:text-slate-600 hover:underline dark:hover:text-slate-300">Ketentuan Layanan</a>
        ·
        <a href="/data-deletion" class="hover:text-slate-600 hover:underline dark:hover:text-slate-300">Penghapusan Data</a>
      </p>
    </div>
  </main>
</div>
