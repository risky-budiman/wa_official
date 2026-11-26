<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import LegalShell from '$lib/components/legal/LegalShell.svelte';
  import { LEGAL } from '$lib/legal';
  import { legalContact } from '$lib/legal-contact.svelte';
  import { initialLegalLang } from '$lib/legal-lang';

  let lang = $state<'id' | 'en'>(($page.url.searchParams.get('lang') as 'id' | 'en') === 'en' ? 'en' : 'id');
  onMount(() => {
    lang = initialLegalLang($page.url);
    legalContact.load();
  });
</script>

<LegalShell titleId="Kebijakan Privasi" titleEn="Privacy Policy" {lang} onlang={(l) => (lang = l)}>
  {#if lang === 'en'}
    <p>This Privacy Policy explains how {LEGAL.company} ("we") collects, uses and protects data in {LEGAL.product} (the "Service", {LEGAL.site}), a customer-service and messaging platform that lets businesses communicate with their customers through the WhatsApp Business Platform.</p>

    <h2>1. Our role</h2>
    <p>Businesses that subscribe to the Service ("Business Customers") decide which of their customers they message and what they store. For that customer and conversation data, the Business Customer is the controller and we act as a processor on its behalf. For the accounts of the people who use the Service (administrators, supervisors, agents) we are the controller.</p>

    <h2>2. Data we collect</h2>
    <ul>
      <li><strong>Account data:</strong> name, e-mail address, password (stored only as a one-way hash), role, organisation name and login activity.</li>
      <li><strong>WhatsApp Business connection:</strong> when a Business Customer connects its WhatsApp Business Account through Facebook Login for Business / Embedded Signup, we receive an access token and the IDs of its WhatsApp Business Account, phone numbers and business name, using the permissions <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code>. These are used only to send and receive messages, manage message templates and phone numbers, and receive webhooks for that business.</li>
      <li><strong>Conversation data processed for Business Customers:</strong> end customers' WhatsApp phone numbers and profile names, message content and media, delivery/read status, message templates, conversation assignment, internal notes, contact tags and attributes, quick replies and broadcast campaigns.</li>
      <li><strong>Billing data:</strong> plan, order and payment status. Card or bank details are processed by our payment provider (Midtrans) and are not stored by us.</li>
      <li><strong>Technical data:</strong> IP address (used temporarily for security rate limiting) and data stored in the browser (session token and display preferences). We do not use advertising cookies.</li>
    </ul>

    <h2>3. How we use data</h2>
    <ul>
      <li>To provide the Service: deliver and receive WhatsApp messages, show conversations to the right agents, run automatic replies configured by the Business Customer, and produce reports.</li>
      <li>To secure the Service, prevent abuse and comply with WhatsApp Business policies.</li>
      <li>To manage subscriptions, invoices and support.</li>
    </ul>
    <p>We do not sell personal data and do not use conversation data for advertising.</p>

    <h2>4. Sharing</h2>
    <ul>
      <li><strong>Meta Platforms</strong> (WhatsApp Business Platform) to send and receive messages.</li>
      <li><strong>AI providers (optional):</strong> only if a Business Customer enables the AI assistant, the text of relevant incoming messages is sent to the provider it selects (e.g. Google Gemini, OpenAI or Anthropic) using that business's own API key.</li>
      <li><strong>Payment provider</strong> (Midtrans) to process subscription payments.</li>
      <li>Hosting providers that run our servers, and authorities when required by law.</li>
    </ul>

    <h2>5. Retention and deletion</h2>
    <p>Data is kept while the account is active. A Business Customer can disconnect WhatsApp at any time and request deletion of its organisation. We delete account and conversation data within 30 days of a verified request, except where the law requires us to keep it. See <a href="/data-deletion?lang=en">Data Deletion</a>.</p>

    <h2>6. Security</h2>
    <p>Data is transmitted over HTTPS, passwords are hashed, access is restricted by role and organisation, and WhatsApp webhooks are verified with a cryptographic signature.</p>

    <h2>7. Your rights</h2>
    <p>Under applicable law, including Indonesia's Personal Data Protection Law (UU No. 27/2022), you may request access to, correction of, export or deletion of your personal data, and withdraw consent. End customers of a business should first contact that business; we will assist it.</p>

    <h2>8. Children</h2>
    <p>The Service is intended for businesses and is not directed at children.</p>

    <h2>9. Changes</h2>
    <p>We may update this policy; the date above shows the latest version.</p>

    <h2>10. Contact</h2>
    <p>{LEGAL.company}, {LEGAL.country} — <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a></p>
  {:else}
    <p>Kebijakan Privasi ini menjelaskan bagaimana {LEGAL.company} ("kami") mengumpulkan, memakai, dan melindungi data di {LEGAL.product} ("Layanan", {LEGAL.site}), platform layanan pelanggan dan perpesanan yang memungkinkan bisnis berkomunikasi dengan pelanggannya melalui WhatsApp Business Platform.</p>

    <h2>1. Peran kami</h2>
    <p>Bisnis yang berlangganan Layanan ("Pelanggan Bisnis") menentukan pelanggan mana yang dihubungi dan data apa yang disimpan. Untuk data pelanggan dan percakapan tersebut, Pelanggan Bisnis adalah pengendali data dan kami bertindak sebagai pemroses atas namanya. Untuk akun pengguna Layanan (administrator, supervisor, agen), kami adalah pengendali data.</p>

    <h2>2. Data yang kami kumpulkan</h2>
    <ul>
      <li><strong>Data akun:</strong> nama, alamat email, kata sandi (hanya disimpan dalam bentuk hash satu arah), peran, nama organisasi, dan aktivitas login.</li>
      <li><strong>Koneksi WhatsApp Business:</strong> saat Pelanggan Bisnis menghubungkan Akun WhatsApp Business melalui Facebook Login for Business / Embedded Signup, kami menerima token akses serta ID Akun WhatsApp Business, nomor telepon, dan nama bisnisnya, menggunakan izin <code>whatsapp_business_management</code> dan <code>whatsapp_business_messaging</code>. Data ini hanya dipakai untuk mengirim dan menerima pesan, mengelola template pesan dan nomor telepon, serta menerima webhook bisnis tersebut.</li>
      <li><strong>Data percakapan yang diproses untuk Pelanggan Bisnis:</strong> nomor WhatsApp dan nama profil pelanggan akhir, isi pesan dan media, status terkirim/dibaca, template pesan, penugasan percakapan, catatan internal, tag dan atribut kontak, balas cepat, serta kampanye broadcast.</li>
      <li><strong>Data penagihan:</strong> paket, pesanan, dan status pembayaran. Data kartu atau rekening diproses oleh penyedia pembayaran kami (Midtrans) dan tidak kami simpan.</li>
      <li><strong>Data teknis:</strong> alamat IP (dipakai sementara untuk pembatasan percobaan demi keamanan) dan data di browser (token sesi dan preferensi tampilan). Kami tidak memakai cookie iklan.</li>
    </ul>

    <h2>3. Penggunaan data</h2>
    <ul>
      <li>Menyediakan Layanan: mengirim dan menerima pesan WhatsApp, menampilkan percakapan ke agen yang tepat, menjalankan balasan otomatis yang diatur Pelanggan Bisnis, dan menyusun laporan.</li>
      <li>Mengamankan Layanan, mencegah penyalahgunaan, dan mematuhi kebijakan WhatsApp Business.</li>
      <li>Mengelola langganan, tagihan, dan dukungan.</li>
    </ul>
    <p>Kami tidak menjual data pribadi dan tidak memakai data percakapan untuk iklan.</p>

    <h2>4. Berbagi data</h2>
    <ul>
      <li><strong>Meta Platforms</strong> (WhatsApp Business Platform) untuk mengirim dan menerima pesan.</li>
      <li><strong>Penyedia AI (opsional):</strong> hanya jika Pelanggan Bisnis mengaktifkan asisten AI, teks pesan masuk yang relevan dikirim ke penyedia yang dipilihnya (mis. Google Gemini, OpenAI, atau Anthropic) memakai API key milik bisnis tersebut.</li>
      <li><strong>Penyedia pembayaran</strong> (Midtrans) untuk memproses pembayaran langganan.</li>
      <li>Penyedia hosting yang menjalankan server kami, dan otoritas bila diwajibkan hukum.</li>
    </ul>

    <h2>5. Penyimpanan dan penghapusan</h2>
    <p>Data disimpan selama akun aktif. Pelanggan Bisnis dapat memutus koneksi WhatsApp kapan saja dan meminta penghapusan organisasinya. Kami menghapus data akun dan percakapan paling lambat 30 hari setelah permintaan terverifikasi, kecuali hukum mewajibkan penyimpanan. Lihat <a href="/data-deletion">Penghapusan Data</a>.</p>

    <h2>6. Keamanan</h2>
    <p>Data dikirim melalui HTTPS, kata sandi di-hash, akses dibatasi menurut peran dan organisasi, dan webhook WhatsApp diverifikasi dengan tanda tangan kriptografis.</p>

    <h2>7. Hak Anda</h2>
    <p>Sesuai hukum yang berlaku, termasuk UU Pelindungan Data Pribadi (UU No. 27 Tahun 2022), Anda dapat meminta akses, perbaikan, ekspor, atau penghapusan data pribadi Anda, serta menarik persetujuan. Pelanggan akhir sebuah bisnis sebaiknya menghubungi bisnis tersebut terlebih dahulu; kami akan membantu bisnis tersebut.</p>

    <h2>8. Anak-anak</h2>
    <p>Layanan ditujukan untuk bisnis dan tidak ditujukan kepada anak-anak.</p>

    <h2>9. Perubahan</h2>
    <p>Kami dapat memperbarui kebijakan ini; tanggal di atas menunjukkan versi terbaru.</p>

    <h2>10. Kontak</h2>
    <p>{LEGAL.company}, {LEGAL.country} — <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a></p>
  {/if}
</LegalShell>
