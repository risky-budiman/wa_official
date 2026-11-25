<script lang="ts">
  import { apiRequest } from "$lib/api/client";
  import { authStore } from "$lib/stores/auth.svelte";

  import { onMount } from "svelte";

  import {
    RefreshCw,
    Lock,
    Check,
    Activity,
    Globe,
    GitBranch,
    GitPullRequest,
    Terminal,
    ArrowUpCircle,
    FolderGit2,
    AlertCircle,
    Database,
  } from "lucide-svelte";
  import type { GitStatusData } from "$lib/admin/types";
  import { portal } from "$lib/admin/portal.svelte";

  let gitStatus = $state<GitStatusData | null>(null);
  let gitLoading = $state(false);
  let gitChecking = $state(false);
  let gitPulling = $state(false);

  let gitUpdateResult = $state<{
    currentBranch: string;
    behindCount: number;
    isUpToDate: boolean;
    incomingCommits: Array<{
      hash: string;
      message: string;
      author: string;
      date: string;
    }>;
  } | null>(null);

  let gitTerminalLogs = $state<string[]>([
    "WA CRM Engine Git Manager ready.",
    "Siap memeriksa pembaruan dari repository GitHub resmi.",
  ]);

  let showConfirmGitPullModal = $state(false);

  async function loadGitStatus() {
    if (!authStore.isSuperAdmin) return;
    gitLoading = true;
    try {
      const res = await apiRequest<any>("/super-admin/system/git-status");
      if (res && res.success) {
        gitStatus = res.data;
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Git branch: ${res.data.currentBranch} (${res.data.shortHash})`,
        );
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Gagal membaca status git: ${e?.message}`,
      );
    } finally {
      gitLoading = false;
    }
  }

  async function handleGitCheckUpdate() {
    if (!authStore.isSuperAdmin) return;
    gitChecking = true;
    gitTerminalLogs.push(
      `[${new Date().toLocaleTimeString()}] Menghubungi GitHub dan memeriksa commit terbaru...`,
    );
    try {
      const res = await apiRequest<any>("/super-admin/system/git-check-update", {
        method: "POST",
      });
      if (res && res.success) {
        gitUpdateResult = res.data;
        if (res.data.behindCount > 0) {
          gitTerminalLogs.push(
            `[${new Date().toLocaleTimeString()}] Ditemukan ${res.data.behindCount} commit baru dari GitHub!`,
          );
          portal.feedbackMessage = {
            text: `Ditemukan ${res.data.behindCount} commit pembaruan baru di GitHub yang siap diterapkan!`,
            type: "success",
          };
        } else {
          gitTerminalLogs.push(
            `[${new Date().toLocaleTimeString()}] Codebase sudah versi terbaru (up-to-date dengan origin/${res.data.currentBranch}).`,
          );
          portal.feedbackMessage = {
            text: "Codebase sistem sudah menggunakan versi paling mutakhir dari GitHub!",
            type: "success",
          };
        }
      } else {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Gagal cek update: ${res?.error}`,
        );
        portal.feedbackMessage = {
          text: res?.error || "Gagal memeriksa pembaruan di GitHub",
          type: "error",
        };
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Error: ${e?.message}`,
      );
      portal.feedbackMessage = {
        text: e?.message || "Terjadi kesalahan jaringan saat mengecek GitHub",
        type: "error",
      };
    } finally {
      gitChecking = false;
    }
  }

  async function handleGitPull() {
    if (!authStore.isSuperAdmin) return;
    showConfirmGitPullModal = false;
    gitPulling = true;
    gitTerminalLogs.push(
      `[${new Date().toLocaleTimeString()}] Menjalankan git pull origin ${gitStatus?.currentBranch || "main"}...`,
    );
    try {
      const res = await apiRequest<any>("/super-admin/system/git-pull", {
        method: "POST",
      });
      if (res && res.success) {
        gitTerminalLogs.push(`[${new Date().toLocaleTimeString()}] Output git pull:`);
        gitTerminalLogs.push(res.output || "Already up to date.");
        portal.feedbackMessage = {
          text:
            res.message || "Pembaruan GitHub berhasil ditarik dan diterapkan!",
          type: "success",
        };
        await Promise.all([loadGitStatus(), handleGitCheckUpdate()]);
      } else {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Gagal pull: ${res?.error}`,
        );
        if (res?.output) gitTerminalLogs.push(res.output);
        portal.feedbackMessage = {
          text: res?.error || "Gagal menarik update dari GitHub",
          type: "error",
        };
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Error: ${e?.message}`,
      );
      portal.feedbackMessage = {
        text: e?.message || "Terjadi kesalahan saat mengeksekusi git pull",
        type: "error",
      };
    } finally {
      gitPulling = false;
    }
  }

  let isDbSyncing = $state(false);

  async function handleDbSync() {
    if (!authStore.isSuperAdmin) return;
    isDbSyncing = true;
    gitTerminalLogs.push(
      `[${new Date().toLocaleTimeString()}] Menjalankan sinkronisasi skema & relasi database non-destructive...`,
    );
    try {
      const res = await apiRequest<any>("/super-admin/system/db-sync", {
        method: "POST",
      });
      if (res && res.success) {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Output sinkronisasi database:`,
        );
        gitTerminalLogs.push(res.output || "Database schema up-to-date.");
        portal.feedbackMessage = {
          text:
            res.message ||
            "Skema database terbaru berhasil disinkronkan aman tanpa menghapus data!",
          type: "success",
        };
      } else {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Gagal sinkronisasi DB: ${res?.error}`,
        );
        portal.feedbackMessage = {
          text: res?.error || "Gagal sinkronisasi database",
          type: "error",
        };
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Error: ${e?.message}`,
      );
      portal.feedbackMessage = {
        text: e?.message || "Terjadi kesalahan saat sinkronisasi database",
        type: "error",
      };
    } finally {
      isDbSyncing = false;
    }
  }

  // Load repository status whenever this tab is opened
  onMount(() => {
    loadGitStatus();
  });
</script>

  <div class="space-y-6 max-w-5xl">
    <!-- Role Guard Check: Role must be Administrator Utama (Primary Super Admin) -->
    {#if !authStore.isPrimaryAdmin}
      <div
        class="ui-card p-8 text-center space-y-4"
      >
        <div
          class="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto"
        >
          <Lock class="w-8 h-8 stroke-[2.2]" />
        </div>
        <div class="space-y-1.5 max-w-md mx-auto">
          <h3 class="text-base font-bold text-slate-900 dark:text-white">
            Akses Terbatas: Khusus Administrator Utama
          </h3>
          <p
            class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed"
          >
            Fitur penarikan kode dan pembaruan sistem langsung dari GitHub
            hanya dapat diakses dan dieksekusi oleh <strong>Administrator Utama</strong> demi menjaga stabilitas dan
            keamanan server. Co-Super Administrator dan staf lainnya tidak memiliki hak akses ini.
          </p>
        </div>
        <div class="pt-2">
          <button
            onclick={() => (portal.activeTab = "tenants")}
            class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
          >
            Kembali ke Manajemen Organisasi
          </button>
        </div>
      </div>
    {:else}
      <!-- Top Action Banner -->
      <div
        class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"
      >
        <div class="space-y-1">
          <div class="flex items-center gap-2.5 flex-wrap">
            <div
              class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            >
              <GitBranch class="w-5 h-5" />
            </div>
            <h2
              class="text-base font-bold text-slate-900 dark:text-white"
            >
              Pusat Pembaruan Sistem (GitHub Sync)
            </h2>
            <span
              class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 uppercase tracking-wider"
            >
              Role SUPER_ADMIN
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Periksa komit terbaru dari repositori GitHub resmi, unduh
            patch/fitur terbaru, dan sinkronkan codebase server secara
            aman tanpa perlu login terminal SSH manual.
          </p>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onclick={handleGitCheckUpdate}
            disabled={gitChecking || gitPulling}
            class="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              class="w-4 h-4 {gitChecking ? 'animate-spin' : ''}"
            />
            <span
              >{gitChecking
                ? "Memeriksa GitHub..."
                : "Cek Pembaruan di GitHub"}</span
            >
          </button>

          <!-- Button Sinkronkan Skema Database -->
          <button
            type="button"
            onclick={handleDbSync}
            disabled={isDbSyncing || gitPulling}
            class="py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer disabled:opacity-50"
            title="Sinkronkan struktur tabel, relasi, dan kolom baru secara aman tanpa menghapus data"
          >
            <Database
              class="w-4 h-4 {isDbSyncing ? 'animate-spin' : ''}"
            />
            <span
              >{isDbSyncing
                ? "Menyinkronkan DB..."
                : "Sinkronkan Skema Database"}</span
            >
          </button>

          <button
            type="button"
            onclick={() => (showConfirmGitPullModal = true)}
            disabled={gitPulling || gitChecking}
            class="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <ArrowUpCircle
              class="w-4 h-4 {gitPulling ? 'animate-bounce' : ''}"
            />
            <span
              >{gitPulling
                ? "Menerapkan Update..."
                : "Terapkan Update Sekarang"}</span
            >
          </button>
        </div>
      </div>

      <!-- Repository & Branch KPI Info Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Branch -->
        <div
          class="ui-card p-4 space-y-1.5"
        >
          <div
            class="flex items-center justify-between text-slate-400 text-xs"
          >
            <span class="font-semibold">Branch Aktif</span>
            <GitBranch class="w-4 h-4 text-indigo-500" />
          </div>
          <div
            class="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5"
          >
            <span>{gitStatus?.currentBranch || "main"}</span>
            <span
              class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
            ></span>
          </div>
          <div class="text-[11px] text-slate-400 truncate font-mono">
            origin/{gitStatus?.currentBranch || "main"}
          </div>
        </div>

        <!-- Commit Hash -->
        <div
          class="ui-card p-4 space-y-1.5"
        >
          <div
            class="flex items-center justify-between text-slate-400 text-xs"
          >
            <span class="font-semibold">Commit Saat Ini</span>
            <GitPullRequest class="w-4 h-4 text-purple-500" />
          </div>
          <div
            class="text-base font-bold text-slate-900 dark:text-white font-mono"
          >
            #{gitStatus?.shortHash || "Loading..."}
          </div>
          <div class="text-[11px] text-slate-400 truncate">
            Oleh: {gitStatus?.author || "Author"}
          </div>
        </div>

        <!-- Remote Sync Status -->
        <div
          class="ui-card p-4 space-y-1.5"
        >
          <div
            class="flex items-center justify-between text-slate-400 text-xs"
          >
            <span class="font-semibold">Status Update</span>
            <Activity class="w-4 h-4 text-emerald-500" />
          </div>
          <div class="text-base font-bold">
            {#if gitUpdateResult}
              {#if gitUpdateResult.behindCount > 0}
                <span class="text-amber-500 font-mono"
                  >{gitUpdateResult.behindCount} Commit Baru</span
                >
              {:else}
                <span class="text-emerald-500">Up to Date</span>
              {/if}
            {:else}
              <span
                class="text-slate-700 dark:text-slate-300 text-sm font-semibold"
                >Siap Diperiksa</span
              >
            {/if}
          </div>
          <div class="text-[11px] text-slate-400">
            {#if gitUpdateResult?.behindCount}
              Pembaruan siap ditarik dari GitHub
            {:else}
              Codebase sinkron dengan GitHub
            {/if}
          </div>
        </div>

        <!-- Remote Repository -->
        <div
          class="ui-card p-4 space-y-1.5"
        >
          <div
            class="flex items-center justify-between text-slate-400 text-xs"
          >
            <span class="font-semibold">Remote GitHub</span>
            <Globe class="w-4 h-4 text-blue-500" />
          </div>
          <div
            class="text-sm font-bold text-slate-900 dark:text-white truncate font-mono"
            title={gitStatus?.remoteUrl}
          >
            {gitStatus?.remoteUrl
              ? gitStatus.remoteUrl
                  .split("/")
                  .slice(-1)[0]
                  .replace(".git", "")
              : "wa_official"}
          </div>
          <div class="text-[11px] text-slate-400 truncate">
            {gitStatus?.remoteUrl || "https://github.com/..."}
          </div>
        </div>
      </div>

      <!-- Current Commit Message Details Card -->
      {#if gitStatus}
        <div
          class="ui-card p-5 space-y-3"
        >
          <div class="flex items-center justify-between text-xs">
            <span
              class="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"
            >
              <FolderGit2 class="w-4 h-4 text-indigo-500" />
              <span>Catatan Commit Terakhir yang Berjalan di Server</span>
            </span>
            <span class="text-[11px] text-slate-400 font-mono">
              {gitStatus.commitDate}
            </span>
          </div>
          <div
            class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 leading-relaxed break-words"
          >
            {gitStatus.commitMessage}
          </div>
        </div>
      {/if}

      <!-- Incoming Commits Preview (if behind) -->
      {#if gitUpdateResult && gitUpdateResult.behindCount > 0}
        <div
          class="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/30 shadow-xs space-y-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"
              ></span>
              <h3
                class="text-sm font-bold text-slate-900 dark:text-white"
              >
                Pembaruan Tersedia ({gitUpdateResult.behindCount} Komit di
                Belakang)
              </h3>
            </div>
            <button
              onclick={() => (showConfirmGitPullModal = true)}
              class="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-sm transition cursor-pointer"
            >
              Terapkan Sekarang
            </button>
          </div>

          <div class="space-y-2">
            {#each gitUpdateResult.incomingCommits as commit}
              <div
                class="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <div class="space-y-0.5">
                  <div class="font-bold text-slate-900 dark:text-white">
                    {commit.message}
                  </div>
                  <div class="text-[11px] text-slate-400">
                    Oleh: {commit.author} • {commit.date}
                  </div>
                </div>
                <span
                  class="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shrink-0"
                >
                  {commit.hash}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Terminal Output Log Console -->
      <div
        class="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg"
      >
        <div
          class="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between"
        >
          <div
            class="flex items-center gap-2 text-xs font-mono text-slate-300"
          >
            <Terminal class="w-4 h-4 text-emerald-400" />
            <span>Terminal Konsol Eksekusi Git</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          </div>
        </div>

        <div
          class="p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-64 overflow-y-auto"
        >
          {#each gitTerminalLogs as log}
            <div class="leading-relaxed whitespace-pre-wrap">{log}</div>
          {/each}
          {#if gitChecking}
            <div class="text-amber-400 animate-pulse">
              $ git fetch origin {gitStatus?.currentBranch || "main"}...
            </div>
          {:else if gitPulling}
            <div class="text-indigo-400 animate-pulse">
              $ git pull origin {gitStatus?.currentBranch || "main"}...
              (menarik data codebase)
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

<!-- ========================================================= -->
<!-- MODAL: KONFIRMASI GIT PULL UPDATE                         -->
<!-- ========================================================= -->
{#if showConfirmGitPullModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => {
      if (e.target === e.currentTarget) showConfirmGitPullModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 my-auto"
    >
      <div class="flex items-center gap-3">
        <div
          class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >
          <GitPullRequest class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Konfirmasi Terapkan Update GitHub
          </h3>
          <p class="text-xs text-slate-400">
            Tindakan ini akan menjalankan git pull origin {gitStatus?.currentBranch ||
              "main"}
          </p>
        </div>
      </div>

      <div
        class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1"
      >
        <div class="font-bold flex items-center gap-1.5">
          <AlertCircle class="w-4 h-4 text-amber-500" />
          <span>Perhatian Pembaruan Codebase</span>
        </div>
        <p class="text-[11px] leading-relaxed">
          Sistem akan menarik kode sumber terbaru dari GitHub. Jika proses
          selesai, server akan me-reload layanan secara otomatis untuk menerapkan
          patch baru.
        </p>
      </div>

      <div class="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          onclick={() => (showConfirmGitPullModal = false)}
          class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onclick={handleGitPull}
          class="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer flex items-center gap-2"
        >
          <ArrowUpCircle class="w-4 h-4" />
          <span>Ya, Jalankan Git Pull Sekarang</span>
        </button>
      </div>
    </div>
  </div>
{/if}
