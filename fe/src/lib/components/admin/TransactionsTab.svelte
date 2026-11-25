<script lang="ts">
  import { apiRequest } from "$lib/api/client";

  import {
    Search,
    RefreshCw,
    Clock,
    XCircle,
    Trash2,
    Check,
    Wallet,
    CheckCircle,
    Receipt,
  } from "lucide-svelte";
  import type { AdminTransactionItem } from "$lib/admin/types";
  import { portal } from "$lib/admin/portal.svelte";

  let transactionStatusFilter = $state<string>("ALL");
  let transactionSearchQuery = $state<string>("");
  let orderToConfirmManual = $state<AdminTransactionItem | null>(null);
  let showConfirmPaymentModal = $state(false);

  let filteredTransactions = $derived(
    portal.transactionsList.filter((tx) => {
      const q = transactionSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (tx.orderNumber && tx.orderNumber.toLowerCase().includes(q)) ||
        (tx.organizationName &&
          tx.organizationName.toLowerCase().includes(q)) ||
        (tx.planName && tx.planName.toLowerCase().includes(q)) ||
        (tx.userEmail && tx.userEmail.toLowerCase().includes(q));
      const matchesStatus =
        transactionStatusFilter === "ALL" ||
        tx.paymentStatus === transactionStatusFilter;
      return matchesSearch && matchesStatus;
    }),
  );

  async function handleConfirmManualPayment(order: AdminTransactionItem) {
    portal.isSubmitting = true;
    try {
      const res = await apiRequest<any>(
        `/super-admin/transactions/${order.id}/confirm-manual`,
        {
          method: "POST",
        },
      );
      if (res && res.success) {
        portal.feedbackMessage = {
          text: `Pembayaran ${order.orderNumber} (${order.organizationName}) berhasil dikonfirmasi! Paket telah aktif.`,
          type: "success",
        };
        showConfirmPaymentModal = false;
        orderToConfirmManual = null;
        await Promise.all([portal.loadTransactions(), portal.loadData()]);
      } else {
        portal.feedbackMessage = {
          text: res?.error || "Gagal mengonfirmasi pembayaran",
          type: "error",
        };
      }
    } catch (e: any) {
      portal.feedbackMessage = {
        text: e?.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      portal.isSubmitting = false;
    }
  }

  async function handleCancelTransaction(order: AdminTransactionItem) {
    if (!confirm(`Batalkan transaksi ${order.orderNumber}?`)) return;
    try {
      const res = await apiRequest<any>(
        `/super-admin/transactions/${order.id}/cancel`,
        {
          method: "POST",
        },
      );
      if (res && res.success) {
        portal.feedbackMessage = {
          text: `Transaksi ${order.orderNumber} berhasil dibatalkan.`,
          type: "success",
        };
        await portal.loadTransactions();
      } else {
        portal.feedbackMessage = {
          text: res?.error || "Gagal membatalkan transaksi",
          type: "error",
        };
      }
    } catch (e: any) {
      portal.feedbackMessage = {
        text: e?.message || "Terjadi kesalahan",
        type: "error",
      };
    }
  }

  // ─── CHANGE PLAN STATE & HANDLERS ─────────────────────────
</script>

  <!-- Top Action Banner -->
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
  >
    <div class="space-y-1">
      <div class="flex items-center gap-2 flex-wrap">
        <h2
          class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
        >
          <Receipt class="w-5 h-5 text-indigo-500" />
          <span>Pusat Transaksi & Pembayaran Langganan SaaS</span>
          <span class="text-xs font-normal text-slate-500"
            >({portal.transactionsList.length} Transaksi)</span
          >
        </h2>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Pencatatan riwayat pesanan paket seluruh penyewa (tenant),
        monitoring omset, dan konfirmasi manual transfer bank.
      </p>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        onclick={portal.loadTransactions}
        disabled={portal.transactionsLoading}
        class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-60"
      >
        <RefreshCw
          class="w-4 h-4 {portal.transactionsLoading ? 'animate-spin' : ''}"
        />
        <span>Refresh</span>
      </button>
    </div>
  </div>

  <!-- Financial Summary KPI Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
      >
        <Wallet class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Total Omset (Lunas)
        </div>
        <div
          class="text-base font-extrabold text-slate-900 dark:text-white font-mono"
        >
          {portal.formatRupiah(portal.transactionSummary.totalRevenue)}
        </div>
      </div>
    </div>

    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
      >
        <CheckCircle class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Transaksi Lunas (PAID)
        </div>
        <div
          class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
        >
          {portal.transactionSummary.paidCount}
        </div>
      </div>
    </div>

    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"
      >
        <Clock class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Menunggu Bayar (PENDING)
        </div>
        <div
          class="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono"
        >
          {portal.transactionSummary.pendingCount}
        </div>
      </div>
    </div>

    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"
      >
        <XCircle class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Gagal / Kadaluarsa
        </div>
        <div
          class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
        >
          {portal.transactionSummary.failedCount}
        </div>
      </div>
    </div>
  </div>

  <!-- Filter & Search Bar -->
  <div
    class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
  >
    <div class="relative w-full sm:w-80">
      <Search
        class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        bind:value={transactionSearchQuery}
        placeholder="Cari no invoice, tenant, atau paket..."
        class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
      />
    </div>

    <div class="flex items-center gap-2 w-full sm:w-auto">
      <label
        for="tx_status_filter"
        class="text-xs font-semibold text-slate-500 shrink-0"
        >Status:</label
      >
      <select
        id="tx_status_filter"
        bind:value={transactionStatusFilter}
        class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
      >
        <option value="ALL"
          >Semua Status ({portal.transactionsList.length})</option
        >
        <option value="PENDING">PENDING (Menunggu Pembayaran)</option>
        <option value="PAID">PAID (Lunas & Aktif)</option>
        <option value="EXPIRED">EXPIRED (Kadaluarsa)</option>
        <option value="FAILED">FAILED (Gagal)</option>
        <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
      </select>
    </div>
  </div>

  <!-- Transaction Table -->
  <div
    class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
  >
    {#if portal.transactionsLoading && portal.transactionsList.length === 0}
      <div class="p-12 text-center space-y-3">
        <div
          class="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"
        ></div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Memuat data transaksi platform...
        </p>
      </div>
    {:else if filteredTransactions.length === 0}
      <div class="p-12 text-center space-y-3">
        <div
          class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto"
        >
          <Receipt class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">
          Tidak Ada Transaksi Ditemukan
        </h3>
        <p
          class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto"
        >
          {transactionSearchQuery
            ? "Tidak ada transaksi yang cocok dengan kriteria pencarian."
            : "Belum ada transaksi pemesanan paket dari tenant."}
        </p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead
            class="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]"
          >
            <tr>
              <th class="px-5 py-3.5">No. Invoice & Waktu</th>
              <th class="px-4 py-3.5">Organisasi Klien</th>
              <th class="px-4 py-3.5">Paket & Durasi</th>
              <th class="px-4 py-3.5">Nominal Tagihan</th>
              <th class="px-4 py-3.5">Metode Bayar</th>
              <th class="px-4 py-3.5">Status</th>
              <th class="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            {#each filteredTransactions as tx (tx.id)}
              <tr
                class="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition"
              >
                <td class="px-5 py-3.5">
                  <div
                    class="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5"
                  >
                    <Receipt
                      class="w-3.5 h-3.5 text-slate-400 shrink-0"
                    />
                    <span>{tx.orderNumber}</span>
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    {new Date(tx.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </td>

                <td class="px-4 py-3.5">
                  <div class="font-bold text-slate-900 dark:text-white">
                    {tx.organizationName || "Organisasi Terhapus"}
                  </div>
                  <div
                    class="text-[11px] text-slate-500 dark:text-slate-400 font-mono"
                  >
                    {tx.userEmail || tx.userName || "-"}
                  </div>
                </td>

                <td class="px-4 py-3.5">
                  <div class="font-bold text-slate-900 dark:text-white">
                    {tx.planName}
                  </div>
                  <span
                    class="inline-block px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider border {portal.getPlanBadgeClass(
                      tx.planCode,
                    )}"
                  >
                    {tx.planCode} ({tx.durationDays === 0
                      ? "Permanen"
                      : `${tx.durationDays} Hari`})
                  </span>
                </td>

                <td
                  class="px-4 py-3.5 font-bold font-mono text-slate-900 dark:text-white"
                >
                  {portal.formatRupiah(tx.amount)}
                </td>

                <td
                  class="px-4 py-3.5 text-slate-600 dark:text-slate-300 capitalize text-[11px]"
                >
                  {tx.paymentMethod
                    ? tx.paymentMethod.replace(/_/g, " ")
                    : "Online / Midtrans"}
                </td>

                <td class="px-4 py-3.5">
                  {#if tx.paymentStatus === "PAID"}
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    >
                      <CheckCircle class="w-3.5 h-3.5" />
                      <span>LUNAS (Aktif)</span>
                    </span>
                  {:else if tx.paymentStatus === "PENDING"}
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                    >
                      <Clock class="w-3.5 h-3.5" />
                      <span>Menunggu Pembayaran</span>
                    </span>
                  {:else if tx.paymentStatus === "CANCELLED"}
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                    >
                      <span>Dibatalkan</span>
                    </span>
                  {:else}
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    >
                      <XCircle class="w-3.5 h-3.5" />
                      <span>{tx.paymentStatus}</span>
                    </span>
                  {/if}
                </td>

                <td class="px-5 py-3.5 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    {#if tx.paymentStatus === "PENDING"}
                      {#if portal.canFinance}
                      <button
                        type="button"
                        onclick={() => {
                          orderToConfirmManual = tx;
                          showConfirmPaymentModal = true;
                        }}
                        class="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition cursor-pointer"
                        title="Konfirmasi Pembayaran Manual & Aktifkan Paket"
                      >
                        <Check class="w-3.5 h-3.5 stroke-[3]" />
                        <span>Konfirmasi Lunas</span>
                      </button>
                      {/if}

                      {#if portal.canFinance}
                      <button
                        type="button"
                        onclick={() => handleCancelTransaction(tx)}
                        class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                        title="Batalkan Pesanan"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                      {/if}
                    {:else if tx.paymentStatus === "PAID"}
                      <span
                        class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                      >
                        <Check class="w-3.5 h-3.5 stroke-[3]" />
                        <span>Lunas</span>
                      </span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

<!-- ========================================================= -->
<!-- MODAL: KONFIRMASI PEMBAYARAN MANUAL OLEH SUPER ADMIN      -->
<!-- ========================================================= -->
{#if showConfirmPaymentModal && orderToConfirmManual}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showConfirmPaymentModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
        >
          <CheckCircle class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">
            Konfirmasi Pembayaran Manual
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {orderToConfirmManual.orderNumber}
          </p>
        </div>
      </div>

      <div
        class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
      >
        <div class="flex justify-between">
          <span class="text-slate-400">Organisasi:</span>
          <strong class="text-slate-800 dark:text-slate-200"
            >{orderToConfirmManual.organizationName}</strong
          >
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Paket yang Dibeli:</span>
          <strong class="text-slate-800 dark:text-slate-200"
            >{orderToConfirmManual.planName} ({orderToConfirmManual.durationDays}
            Hari)</strong
          >
        </div>
        <div
          class="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2"
        >
          <span class="text-slate-400">Total Nominal:</span>
          <strong
            class="text-emerald-600 dark:text-emerald-400 font-mono text-sm"
            >{portal.formatRupiah(orderToConfirmManual.amount)}</strong
          >
        </div>
      </div>

      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Apakah Anda yakin ingin mengonfirmasi pembayaran untuk invoice <strong
          >{orderToConfirmManual.orderNumber}</strong
        >? Paket organisasi klien akan <strong>langsung aktif seketika</strong> dan
        masa aktifnya akan diperpanjang otomatis.
      </p>

      <div
        class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          onclick={() => {
            showConfirmPaymentModal = false;
            orderToConfirmManual = null;
          }}
          class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onclick={() => handleConfirmManualPayment(orderToConfirmManual!)}
          disabled={portal.isSubmitting}
          class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
        >
          <Check class="w-4 h-4 stroke-[3]" />
          <span
            >{portal.isSubmitting
              ? "Memproses..."
              : "Konfirmasi & Aktifkan Paket"}</span
          >
        </button>
      </div>
    </div>
  </div>
{/if}
