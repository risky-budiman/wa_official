<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    if (authStore.isAuthenticated) {
      goto('/inbox');
    } else {
      goto('/login');
    }
  });
</script>

<div class="h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
  <div class="flex items-center gap-2">
    <div class="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
    Memuat aplikasi WhatsApp CRM...
  </div>
</div>
