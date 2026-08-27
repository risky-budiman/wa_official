<script lang="ts">
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  interface Props {
    children?: import('svelte').Snippet;
  }
  let { children }: Props = $props();

  onMount(() => {
    if (!authStore.isLoading && !authStore.isAuthenticated) {
      goto('/login');
    }
  });

  $effect(() => {
    if (!authStore.isLoading && !authStore.isAuthenticated) {
      goto('/login');
    }
  });
</script>

<div class="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
  <Sidebar />

  <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
    <Header />
    <main class="flex-1 overflow-y-auto min-h-0 bg-slate-50 dark:bg-slate-950">
      {@render children?.()}
    </main>
  </div>
</div>
