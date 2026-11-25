<script lang="ts">
  interface Props {
    role?: 'SUPER_ADMIN' | 'CO_SUPER_ADMIN' | 'ADMIN_FINANCE' | 'ADMIN_SUPPORT' | 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT' | null;
    isPrimaryAdmin?: boolean;
    size?: 'sm' | 'md';
  }
  let { role = 'AGENT', isPrimaryAdmin = false, size = 'md' }: Props = $props();

  // label + color per role (readable contrast in both light and dark mode)
  const config = $derived.by(() => {
    switch (role) {
      case 'SUPER_ADMIN':
        return isPrimaryAdmin
          ? { label: 'Administrator Utama', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20', dot: 'bg-amber-500' }
          : { label: 'Super Admin', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20', dot: 'bg-indigo-500' };
      case 'CO_SUPER_ADMIN':
        return { label: 'Co-Super Admin', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20', dot: 'bg-indigo-500' };
      case 'ADMIN_FINANCE':
        return { label: 'Finance', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20', dot: 'bg-emerald-500' };
      case 'ADMIN_SUPPORT':
        return { label: 'Support', cls: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-400/20', dot: 'bg-cyan-500' };
      case 'ADMINISTRATOR':
        return { label: 'Administrator', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20', dot: 'bg-rose-500' };
      case 'SUPERVISOR':
        return { label: 'Supervisor', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20', dot: 'bg-amber-500' };
      default:
        return { label: 'Agent', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20', dot: 'bg-emerald-500' };
    }
  });
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset {config.cls} {size === 'sm'
    ? 'px-2 py-px text-[10px]'
    : 'px-2.5 py-0.5 text-xs'}"
>
  <span class="h-1.5 w-1.5 rounded-full {config.dot}"></span>
  {config.label}
</span>
