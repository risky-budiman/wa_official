// ===========================================
// UI Store — layout state shared by the app shell
// ===========================================

class UiStore {
  /** Mobile/tablet sidebar drawer (desktop sidebar is always visible) */
  sidebarOpen = $state(false);

  openSidebar() {
    this.sidebarOpen = true;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }
}

export const uiStore = new UiStore();
