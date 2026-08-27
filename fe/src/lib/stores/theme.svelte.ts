// ===========================================
// Theme Store — Light / Dark Mode Toggle
// ===========================================

export type Theme = 'dark' | 'light';

class ThemeStore {
  current = $state<Theme>('dark');

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wa_crm_theme') as Theme | null;
      if (saved === 'light' || saved === 'dark') {
        this.current = saved;
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.current = prefersDark ? 'dark' : 'light';
      }
      this.applyTheme();
    }
  }

  toggle() {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_theme', this.current);
      this.applyTheme();
    }
  }

  setTheme(theme: Theme) {
    this.current = theme;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_theme', theme);
      this.applyTheme();
    }
  }

  private applyTheme() {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (this.current === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }
    }
  }
}

export const themeStore = new ThemeStore();
