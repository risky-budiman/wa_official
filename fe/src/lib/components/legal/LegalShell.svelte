<script lang="ts">
  import { page } from '$app/stores';
  import { LEGAL } from '$lib/legal';
  import { MessageSquare } from 'lucide-svelte';

  interface Props {
    titleId: string;
    titleEn: string;
    lang: 'id' | 'en';
    onlang: (l: 'id' | 'en') => void;
    children?: import('svelte').Snippet;
  }
  let { titleId, titleEn, lang, onlang, children }: Props = $props();

  const links = [
    { href: '/privacy', id: 'Kebijakan Privasi', en: 'Privacy Policy' },
    { href: '/terms', id: 'Ketentuan Layanan', en: 'Terms of Service' },
    { href: '/data-deletion', id: 'Penghapusan Data', en: 'Data Deletion' },
  ];
  const title = $derived(lang === 'en' ? titleEn : titleId);
</script>

<svelte:head>
  <title>{title} · {LEGAL.product}</title>
  <meta name="robots" content="index,follow" />
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
  <header class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <a href="/" class="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white"><MessageSquare class="h-4 w-4" /></span>
        {LEGAL.product}
      </a>
      <div class="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700" role="group" aria-label="Language">
        <button type="button" onclick={() => onlang('id')} aria-pressed={lang === 'id'} class="rounded-md px-2.5 py-1 font-semibold {lang === 'id' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}">Indonesia</button>
        <button type="button" onclick={() => onlang('en')} aria-pressed={lang === 'en'} class="rounded-md px-2.5 py-1 font-semibold {lang === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}">English</button>
      </div>
    </div>
    <nav class="mx-auto flex max-w-3xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
      {#each links as l}
        <a href={`${l.href}${lang === 'en' ? '?lang=en' : ''}`} class="whitespace-nowrap {$page.url.pathname === l.href ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}">{lang === 'en' ? l.en : l.id}</a>
      {/each}
    </nav>
  </header>

  <main class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
    <p class="mt-1 text-sm text-slate-500">{lang === 'en' ? 'Last updated' : 'Terakhir diperbarui'}: {LEGAL.updated}</p>
    <article class="legal mt-8 space-y-6 text-[15px] leading-relaxed">
      {@render children?.()}
    </article>
  </main>

  <footer class="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
    © {new Date().getFullYear()} {LEGAL.company} · {LEGAL.country}
  </footer>
</div>

<style>
  .legal :global(h2) { font-size: 1.1rem; font-weight: 700; margin-top: 1.75rem; color: inherit; }
  .legal :global(ul) { list-style: disc; padding-left: 1.25rem; }
  .legal :global(li) { margin: 0.25rem 0; }
  .legal :global(a) { color: rgb(4 120 87); text-decoration: underline; }
</style>
