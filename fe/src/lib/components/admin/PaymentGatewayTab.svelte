<script lang="ts">
  import { apiRequest } from "$lib/api/client";

  import {
    Shield,
    Key,
    Check,
    Eye,
    EyeOff,
    Copy,
    Settings,
    Wallet,
    Zap,
  } from "lucide-svelte";

  import { portal } from "$lib/admin/portal.svelte";

  let showMidtransServerKey = $state(false);

  async function handleSaveMidtrans(e: Event) {
    e.preventDefault();
    portal.isSubmitting = true;
    const res = await apiRequest("/super-admin/settings/payment", {
      method: "PUT",
      body: JSON.stringify(portal.midtrans),
    });
    portal.isSubmitting = false;

    if (res.success) {
      portal.feedbackMessage = {
        text: "Konfigurasi pembayaran Midtrans berhasil disimpan!",
        type: "success",
      };
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal menyimpan konfigurasi Midtrans",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 5000);
  }

  // ==========================================
  // TENANTS MANAGEMENT HANDLERS
  // ==========================================
</script>

  <div class="space-y-6 max-w-4xl">
    <div
      class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
    >
      <div
        class="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5"
      >
        <div>
          <h2
            class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
          >
            <Wallet class="w-5 h-5 text-indigo-500" />
            <span>Integrasi Payment Gateway Midtrans</span>
          </h2>
          <p
            class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed"
          >
            Hubungkan akun Midtrans Snap Anda untuk menerima pembayaran
            otomatis QRIS, Virtual Account (BCA, Mandiri, BNI, BRI), Kartu
            Kredit, dan e-Wallet dari klien saat berlangganan sewa.
          </p>
        </div>

        <!-- Enable/Disable Switch -->
        <label
          class="flex items-center gap-2 cursor-pointer shrink-0 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700"
        >
          <input
            type="checkbox"
            bind:checked={portal.midtrans.isEnabled}
            class="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
          />
          <span
            class="text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            {portal.midtrans.isEnabled ? "Channel Aktif" : "Nonaktif"}
          </span>
        </label>
      </div>

      <form onsubmit={handleSaveMidtrans} class="space-y-5">
        <!-- Environment Selection -->
        <div>
          <span
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2"
            >Mode Lingkungan Midtrans</span
          >
          <div class="grid grid-cols-2 gap-4">
            <label
              class="p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition {portal.midtrans.environment ===
              'sandbox'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}"
            >
              <input
                type="radio"
                name="midtrans_env"
                value="sandbox"
                bind:group={portal.midtrans.environment}
                class="text-amber-500"
              />
              <div>
                <div class="text-xs font-bold">
                  Sandbox (Testing / Simulasi)
                </div>
                <div class="text-[11px] opacity-80">
                  Untuk pengujian simulasi transaksi tanpa uang sungguhan
                </div>
              </div>
            </label>

            <label
              class="p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition {portal.midtrans.environment ===
              'production'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}"
            >
              <input
                type="radio"
                name="midtrans_env"
                value="production"
                bind:group={portal.midtrans.environment}
                class="text-emerald-600"
              />
              <div>
                <div class="text-xs font-bold">
                  Production (Resmi / Live)
                </div>
                <div class="text-[11px] opacity-80">
                  Untuk menerima pembayaran uang riil dari klien penyewa
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Server Key -->
        <div>
          <label
            for="mt_server_key"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Midtrans Server Key *
          </label>
          <div class="relative">
            <Key
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="mt_server_key"
              type={showMidtransServerKey ? "text" : "password"}
              bind:value={portal.midtrans.serverKey}
              placeholder={portal.midtrans.environment === "sandbox"
                ? "SB-Mid-server-..."
                : "Mid-server-..."}
              class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="button"
              onclick={() =>
                (showMidtransServerKey = !showMidtransServerKey)}
              class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {#if showMidtransServerKey}
                <EyeOff class="w-4 h-4" />
              {:else}
                <Eye class="w-4 h-4" />
              {/if}
            </button>
          </div>
          <span class="text-[11px] text-slate-400 mt-1 block"
            >Didapatkan dari menu: Midtrans Dashboard &rarr; Settings
            &rarr; Access Keys</span
          >
        </div>

        <!-- Client Key -->
        <div>
          <label
            for="mt_client_key"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Midtrans Client Key *
          </label>
          <div class="relative">
            <Shield
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="mt_client_key"
              type="text"
              bind:value={portal.midtrans.clientKey}
              placeholder={portal.midtrans.environment === "sandbox"
                ? "SB-Mid-client-..."
                : "Mid-client-..."}
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        <!-- Merchant ID -->
        <div>
          <label
            for="mt_merchant_id"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Midtrans Merchant ID (Opsional)
          </label>
          <input
            id="mt_merchant_id"
            type="text"
            bind:value={portal.midtrans.merchantId}
            placeholder="G123456789"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <!-- Webhook URL Display Card -->
        <div
          class="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5"
            >
              <Zap class="w-4 h-4 text-indigo-500" />
              Midtrans Payment Notification URL (Webhook)
            </span>
            <button
              type="button"
              onclick={() =>
                portal.copyToClipboard(
                  `${window.location.origin}/api/v1/billing/midtrans-webhook`,
                  "webhook_url",
                )}
              class="py-1 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
            >
              {#if portal.copiedText === "webhook_url"}
                <Check class="w-3 h-3" />
                <span>URL Tersalin!</span>
              {:else}
                <Copy class="w-3 h-3" />
                <span>Salin Webhook URL</span>
              {/if}
            </button>
          </div>
          <div
            class="font-mono text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900 text-slate-700 dark:text-slate-200 break-all select-all"
          >
            {typeof window !== "undefined"
              ? `${window.location.origin}/api/v1/billing/midtrans-webhook`
              : "https://domain-anda.com/api/v1/billing/midtrans-webhook"}
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            Tempel URL di atas pada dashboard Midtrans (<strong
              >Settings &rarr; Configuration &rarr; Payment Notification
              URL</strong
            >) agar sistem otomatis memperpanjang masa aktif tenant saat
            pembayaran berhasil.
          </p>
        </div>

        <div
          class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end"
        >
          {#if portal.canFinance}
          <button
            type="submit"
            disabled={portal.isSubmitting}
            class="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span
              >{portal.isSubmitting
                ? "Menyimpan..."
                : "Simpan Konfigurasi Midtrans"}</span
            >
          </button>
          {/if}
        </div>
      </form>
    </div>
  </div>
