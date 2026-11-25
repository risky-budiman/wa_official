<script lang="ts">
  import { apiRequest } from "$lib/api/client";

  import {
    Plus,
    Users,
    Calendar,
    Clock,
    Edit3,
    Trash2,
    Lock,
    Key,
    X,
    Check,
    Radio,
    Package,
    CheckCircle,
    Gift,
    Globe,
  } from "lucide-svelte";
  import type { SaaSPlan } from "$lib/admin/types";
  import { portal } from "$lib/admin/portal.svelte";

  let showPlanModal = $state(false);
  let editingPlan = $state<SaaSPlan | null>(null);
  let planName = $state("");
  let planCode = $state<string>("STARTER");
  let planPrice = $state(199000);
  let planPeriod = $state("bulan");
  let planDurationType = $state<"PERMANENT" | "MONTHLY" | "DAYS">("MONTHLY");
  let planDurationDays = $state(30);
  let planMaxAgents = $state(5);
  let planMaxBroadcast = $state(5000);
  let planDescription = $state("");
  let planFeaturesText = $state("");
  let planIsPopular = $state(false);
  let planIsPublic = $state(true);
  let planIsActive = $state(true);

  function openCreatePlan(isPromo = false) {
    editingPlan = null;
    if (isPromo) {
      planName = "Promo Spesial";
      planCode = "PROMO";
      planPrice = 0;
      planPeriod = "14 hari";
      planDurationType = "DAYS";
      planDurationDays = 14;
      planMaxAgents = 3;
      planMaxBroadcast = 1000;
      planDescription = "Paket promo khusus dari Super Admin.";
      planFeaturesText =
        "3 Kursi Agen CS\n1.000 Broadcast / Bulan\nLive Inbox & Kontak\nTemplate Pesan";
      planIsPopular = false;
      planIsPublic = false; // Default: Khusus Super Admin
      planIsActive = true;
    } else {
      planName = "";
      planCode = "STARTER";
      planPrice = 299000;
      planPeriod = "bulan";
      planDurationType = "MONTHLY";
      planDurationDays = 30;
      planMaxAgents = 10;
      planMaxBroadcast = 15000;
      planDescription = "";
      planFeaturesText =
        "10 Kursi Agen CS\n15.000 Broadcast / Bulan\nLive Chat & SLA Report\nAPI Key Webhook";
      planIsPopular = false;
      planIsPublic = true; // Default: Publik
      planIsActive = true;
    }
    showPlanModal = true;
  }

  function openEditPlan(plan: SaaSPlan) {
    editingPlan = plan;
    planName = plan.name;
    planCode = plan.code;
    planPrice = plan.price;
    planPeriod = plan.period || "bulan";
    planDurationType =
      plan.durationType ||
      (plan.price === 0
        ? plan.durationDays === 0
          ? "PERMANENT"
          : "DAYS"
        : "MONTHLY");
    planDurationDays =
      plan.durationDays !== undefined
        ? plan.durationDays
        : planDurationType === "PERMANENT"
          ? 0
          : 30;
    planMaxAgents = plan.maxAgents;
    planMaxBroadcast = plan.maxBroadcastPerMonth;
    planDescription = plan.description;
    planFeaturesText = (plan.features || []).join("\n");
    planIsPopular = !!plan.isPopular;
    planIsPublic = plan.isPublic !== false;
    planIsActive = plan.isActive !== false;
    showPlanModal = true;
  }

  async function handleSavePlan(e: Event) {
    e.preventDefault();
    if (!planName.trim()) {
      portal.feedbackMessage = { text: "Nama paket wajib diisi!", type: "error" };
      return;
    }

    const featuresArray = planFeaturesText
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const actualDurationDays =
      planDurationType === "PERMANENT" ? 0 : Number(planDurationDays);
    const actualPeriod =
      planDurationType === "PERMANENT"
        ? "selamanya"
        : planDurationType === "DAYS"
          ? `${actualDurationDays} hari`
          : "bulan";

    let updatedPlans = [...portal.saasPlans];

    if (editingPlan) {
      // Update existing
      updatedPlans = updatedPlans.map((p) =>
        p.id === editingPlan!.id
          ? {
              ...p,
              name: planName.trim(),
              code: planCode,
              price: Number(planPrice),
              period: actualPeriod,
              durationType: planDurationType,
              durationDays: actualDurationDays,
              maxAgents: Number(planMaxAgents),
              maxBroadcastPerMonth: Number(planMaxBroadcast),
              description: planDescription.trim(),
              features: featuresArray,
              isPopular: planIsPopular,
              isPublic: planIsPublic,
              isActive: planIsActive,
            }
          : p,
      );
    } else {
      // Add new
      const newPlan: SaaSPlan = {
        id: `plan_${Date.now()}`,
        name: planName.trim(),
        code: planCode,
        price: Number(planPrice),
        period: actualPeriod,
        durationType: planDurationType,
        durationDays: actualDurationDays,
        maxAgents: Number(planMaxAgents),
        maxBroadcastPerMonth: Number(planMaxBroadcast),
        description: planDescription.trim(),
        features: featuresArray,
        isPopular: planIsPopular,
        isPublic: planIsPublic,
        isActive: planIsActive,
      };
      updatedPlans.push(newPlan);
    }

    portal.isSubmitting = true;
    const res = await apiRequest("/super-admin/settings/plans", {
      method: "PUT",
      body: JSON.stringify({ plans: updatedPlans }),
    });
    portal.isSubmitting = false;

    if (res.success) {
      portal.saasPlans = updatedPlans;
      showPlanModal = false;
      portal.feedbackMessage = {
        text: "Daftar paket & harga SaaS berhasil disimpan!",
        type: "success",
      };
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal menyimpan paket",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 4000);
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus paket sewa ini?")) return;

    const updatedPlans = portal.saasPlans.filter((p) => p.id !== planId);
    portal.isSubmitting = true;
    const res = await apiRequest("/super-admin/settings/plans", {
      method: "PUT",
      body: JSON.stringify({ plans: updatedPlans }),
    });
    portal.isSubmitting = false;

    if (res.success) {
      portal.saasPlans = updatedPlans;
      portal.feedbackMessage = { text: "Paket berhasil dihapus!", type: "success" };
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal menghapus paket",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 4000);
  }

  // ==========================================
  // MIDTRANS PAYMENT GATEWAY HANDLERS
  // ==========================================
</script>

  <div class="space-y-6">
    <div
      class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"
    >
      <div>
        <h2
          class="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
        >
          <Package class="w-5 h-5 text-indigo-500" />
          <span>Katalog Paket Sewa & Paket Promosi SaaS</span>
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Atur harga langganan bulanan, paket promosi gratis (Rp 0), kuota
          agen CS, limit broadcast, dan benefit klien.
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        {#if portal.canFinance}
        <button
          onclick={() => openCreatePlan(true)}
          class="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
        >
          <Gift class="w-4 h-4" />
          <span>Buat Paket Promo (Gratis)</span>
        </button>
        {/if}

        {#if portal.canFinance}
        <button
          onclick={() => openCreatePlan(false)}
          class="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          <span>Buat Paket Sewa Baru</span>
        </button>
        {/if}
      </div>
    </div>

    <!-- Plans Grid Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each portal.saasPlans as plan (plan.id)}
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl border transition relative flex flex-col p-6 shadow-sm {plan.isPopular
            ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}"
        >
          {#if plan.isPopular}
            <span
              class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-md"
            >
              Paling Populer
            </span>
          {/if}

          {#if plan.price === 0}
            <span
              class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md flex items-center gap-1"
            >
              <Gift class="w-3 h-3" />
              Promo / Gratis
            </span>
          {/if}

          <!-- Card Header -->
          <div
            class="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4"
          >
            <div
              class="flex items-center justify-between gap-2 flex-wrap"
            >
              <span
                class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border {portal.getPlanBadgeClass(
                  plan.code,
                )}"
              >
                {plan.code}
              </span>
              <div class="flex items-center gap-1.5">
                {#if plan.isPublic === false}
                  <span
                    class="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1"
                    title="Hanya tampil untuk Super Admin (Tidak muncul di katalog tenant)"
                  >
                    <Lock class="w-3 h-3 text-amber-500" />
                    Khusus Admin
                  </span>
                {:else}
                  <span
                    class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1"
                    title="Tampil di menu langganan seluruh tenant"
                  >
                    <Globe class="w-3 h-3 text-emerald-500" />
                    Publik
                  </span>
                {/if}

                {#if !plan.isActive}
                  <span
                    class="text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded"
                    >Nonaktif</span
                  >
                {/if}
              </div>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              {plan.name}
            </h3>
            <p
              class="text-xs text-slate-500 dark:text-slate-400 min-h-[36px] line-clamp-2"
            >
              {plan.description || "Tidak ada deskripsi"}
            </p>
          </div>

          <!-- Price -->
          <div class="mb-5">
            <div class="flex items-baseline gap-1">
              <span
                class="text-2xl font-bold text-slate-900 dark:text-white"
                >{portal.formatRupiah(plan.price)}</span
              >
              <span class="text-xs text-slate-400"
                >/{plan.period || "bulan"}</span
              >
            </div>
            <div
              class="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
            >
              <Users class="w-3.5 h-3.5" />
              <span>Maksimal {plan.maxAgents} Kursi Agen CS</span>
            </div>
            <div
              class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5"
            >
              <Radio class="w-3.5 h-3.5" />
              <span
                >{plan.maxBroadcastPerMonth.toLocaleString("id-ID")} Broadcast
                / Bulan</span
              >
            </div>
          </div>

          <!-- Feature List -->
          <div class="space-y-2.5 flex-1 mb-6">
            <span
              class="text-[11px] font-bold uppercase tracking-wider text-slate-400"
              >Fitur Termasuk:</span
            >
            {#each plan.features as feat}
              <div
                class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
              >
                <CheckCircle
                  class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"
                />
                <span>{feat}</span>
              </div>
            {/each}
          </div>

          <!-- Card Footer Actions -->
          <div
            class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
          >
            {#if portal.canFinance}
            <button
              onclick={() => openEditPlan(plan)}
              class="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 class="w-3.5 h-3.5" />
              <span>Edit Paket</span>
            </button>
            {/if}
            {#if portal.canFinance}
            <button
              onclick={() => handleDeletePlan(plan.id)}
              class="p-2 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition cursor-pointer"
              title="Hapus Paket"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

<!-- ========================================================= -->
<!-- MODAL: TAMBAH / EDIT PAKET SEWA SAAS                      -->
<!-- ========================================================= -->
{#if showPlanModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showPlanModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <Package class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              {editingPlan ? "Ubah Pengaturan Paket" : "Buat Paket Sewa Baru"}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Tentukan harga, kapasitas agen CS, dan benefit untuk klien
            </p>
          </div>
        </div>
        <button
          onclick={() => (showPlanModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form
        onsubmit={handleSavePlan}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="plan_name"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Nama Paket *</label
              >
              <input
                id="plan_name"
                type="text"
                bind:value={planName}
                placeholder="e.g. Starter Bisnis / Promo Launching"
                class="ui-input"
                required
              />
            </div>

            <div>
              <label
                for="plan_code"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Kode / Label Paket <span class="text-slate-400 font-normal"
                  >(Bebas, e.g. PROMO14, STARTER, VIP)</span
                >
              </label>
              <input
                id="plan_code"
                type="text"
                bind:value={planCode}
                placeholder="e.g. PROMO14 / UMKM / GOLD"
                class="ui-input font-mono uppercase"
              />
            </div>

            <!-- Model Durasi / Masa Berlaku Paket -->
            <div
              class="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <span
                class="block text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                Masa Berlaku / Skema Durasi Paket *
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType ===
                  'PERMANENT'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_duration_type"
                    value="PERMANENT"
                    bind:group={planDurationType}
                    onchange={() => {
                      planPrice = 0;
                      planPeriod = "selamanya";
                      planDurationDays = 0;
                    }}
                    class="text-amber-500 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Gift class="w-3.5 h-3.5 text-amber-500" />
                      <span>Gratis Selamanya</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Tanpa kadaluarsa / no expiry (Tidak perlu perpanjangan)
                    </div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType ===
                  'MONTHLY'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-900 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_duration_type"
                    value="MONTHLY"
                    bind:group={planDurationType}
                    onchange={() => {
                      if (planPrice === 0) planPrice = 199000;
                      planPeriod = "bulan";
                      planDurationDays = 30;
                    }}
                    class="text-indigo-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Clock class="w-3.5 h-3.5 text-indigo-500" />
                      <span>Bulanan (30 Hari)</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Perpanjangan sewa rutin setiap bulan
                    </div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType ===
                  'DAYS'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_duration_type"
                    value="DAYS"
                    bind:group={planDurationType}
                    onchange={() => {
                      if (planDurationDays === 0 || planDurationDays === 30)
                        planDurationDays = 14;
                      planPeriod = `${planDurationDays} hari`;
                    }}
                    class="text-emerald-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Calendar class="w-3.5 h-3.5 text-emerald-500" />
                      <span>Batas Hari Khusus</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Promo berbatas waktu (misal 7, 14, atau 60 hari)
                    </div>
                  </div>
                </label>
              </div>

              {#if planDurationType === "DAYS"}
                <div
                  class="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
                >
                  <label
                    for="plan_custom_days"
                    class="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0"
                  >
                    Jumlah Hari Masa Aktif:
                  </label>
                  <input
                    id="plan_custom_days"
                    type="number"
                    min="1"
                    max="365"
                    bind:value={planDurationDays}
                    oninput={() => (planPeriod = `${planDurationDays} hari`)}
                    class="w-24 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <span class="text-xs text-slate-400"
                    >hari (Setelah lewat, status tenant otomatis EXPIRED)</span
                  >
                </div>
              {/if}
            </div>

            <div>
              <label
                for="plan_price"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Harga Sewa (IDR) * <span class="text-amber-500 font-normal"
                  >(Isi 0 untuk Gratis/Promo)</span
                >
              </label>
              <input
                id="plan_price"
                type="number"
                min="0"
                step="1000"
                bind:value={planPrice}
                class="ui-input font-mono"
                required
              />
            </div>

            <div>
              <label
                for="plan_period"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Label Periode Tagihan</label
              >
              <input
                id="plan_period"
                type="text"
                bind:value={planPeriod}
                placeholder="e.g. bulan / 14 hari / selamanya"
                class="ui-input"
              />
            </div>

            <div>
              <label
                for="plan_agents"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Maksimal Kursi Agen (CS)</label
              >
              <input
                id="plan_agents"
                type="number"
                min="1"
                max="500"
                bind:value={planMaxAgents}
                class="ui-input font-mono"
              />
            </div>

            <div>
              <label
                for="plan_bcast"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Kuota Broadcast Pesan / Bulan</label
              >
              <input
                id="plan_bcast"
                type="number"
                min="0"
                step="500"
                bind:value={planMaxBroadcast}
                class="ui-input font-mono"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="plan_desc"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Deskripsi Singkat</label
              >
              <input
                id="plan_desc"
                type="text"
                bind:value={planDescription}
                placeholder="e.g. Solusi ideal untuk UMKM dan tim kecil"
                class="ui-input"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="plan_features"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Daftar Fitur / Benefit (1 Baris = 1 Fitur)
              </label>
              <textarea
                id="plan_features"
                rows="4"
                bind:value={planFeaturesText}
                placeholder="5 Kursi Agen CS&#10;5.000 Broadcast / Bulan&#10;Live Chat Terpadu"
                class="ui-input"
              ></textarea>
            </div>

            <!-- Pengaturan Visibilitas Paket (Publik vs Khusus Admin) -->
            <div
              class="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
            >
              <span
                class="block text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                Visibilitas & Hak Akses Order Paket *
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planIsPublic
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_visibility"
                    value={true}
                    checked={planIsPublic}
                    onchange={() => (planIsPublic = true)}
                    class="text-emerald-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Globe class="w-3.5 h-3.5 text-emerald-500" />
                      <span>Publik (Klien Bisa Order Mandiri)</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Tampil di menu <em>Paket & Langganan</em> seluruh tenant sehingga
                      mereka bisa memilih dan mengajukan perpanjangan/upgrade secara
                      langsung.
                    </div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {!planIsPublic
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_visibility"
                    value={false}
                    checked={!planIsPublic}
                    onchange={() => (planIsPublic = false)}
                    class="text-amber-500 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Lock class="w-3.5 h-3.5 text-amber-500" />
                      <span>Khusus / Spesial Administrator</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      <strong>Paket Khusus/Rahasia</strong>: Tidak muncul di
                      katalog tenant. Hanya dapat diberikan secara manual oleh
                      Super Admin dari portal administrator.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div
              class="sm:col-span-2 flex items-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-800"
            >
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={planIsPopular}
                  class="w-4 h-4 text-indigo-600 rounded"
                />
                <span
                  class="text-xs font-bold text-slate-800 dark:text-slate-200"
                  >Tandai sebagai Paket Paling Populer</span
                >
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={planIsActive}
                  class="w-4 h-4 text-emerald-600 rounded"
                />
                <span
                  class="text-xs font-bold text-slate-800 dark:text-slate-200"
                  >Paket Aktif (Bisa Dipilih)</span
                >
              </label>
            </div>
          </div>
        </div>

        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            type="button"
            onclick={() => (showPlanModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{portal.isSubmitting ? "Menyimpan..." : "Simpan Paket"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
