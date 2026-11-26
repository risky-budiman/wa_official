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

<LegalShell titleId="Ketentuan Layanan" titleEn="Terms of Service" {lang} onlang={(l) => (lang = l)}>
  {#if lang === 'en'}
    <p>These Terms govern the use of {LEGAL.product} ({LEGAL.site}), provided by {LEGAL.company}. By creating an account or using the Service you agree to them on behalf of yourself and the business you represent.</p>

    <h2>1. The Service</h2>
    <p>A web platform to manage WhatsApp Business conversations: shared inbox, contacts, message templates, broadcasts, automatic replies and reports, connected to the WhatsApp Business Platform operated by Meta.</p>

    <h2>2. Accounts</h2>
    <ul>
      <li>You must provide accurate information and keep your login credentials confidential.</li>
      <li>An organisation's administrators are responsible for the users they invite and for the roles they assign.</li>
    </ul>

    <h2>3. WhatsApp and Meta</h2>
    <ul>
      <li>You must comply with the WhatsApp Business Terms, the WhatsApp Business Messaging Policy and the WhatsApp Commerce Policy.</li>
      <li>You may only message people who have given you permission (opt-in) and must honour opt-out requests.</li>
      <li>Conversation charges for WhatsApp messages are billed by Meta to the WhatsApp Business Account owner and are separate from our subscription.</li>
      <li>Meta may restrict, limit or suspend accounts or phone numbers; we are not responsible for decisions made by Meta.</li>
    </ul>

    <h2>4. Acceptable use</h2>
    <p>You may not use the Service for spam, fraud, illegal content, harassment, or to violate anyone's rights or privacy, nor attempt to disrupt or gain unauthorised access to the Service.</p>

    <h2>5. Plans and payment</h2>
    <ul>
      <li>Paid plans give access for the period purchased and within the plan's limits (e.g. number of agents and broadcast messages).</li>
      <li>A free trial can be used once per organisation.</li>
      <li>Payments are processed by our payment provider; questions about invoices can be sent to the contact below.</li>
    </ul>

    <h2>6. Your data</h2>
    <p>You keep ownership of your data and are responsible for having a lawful basis to process your customers' data. We process it as described in the <a href="/privacy?lang=en">Privacy Policy</a>.</p>

    <h2>7. Availability</h2>
    <p>We work to keep the Service available and secure but do not guarantee uninterrupted operation. Maintenance and third-party outages (including WhatsApp) may affect it.</p>

    <h2>8. Suspension and termination</h2>
    <p>You may stop using the Service at any time. We may suspend or terminate access for breaches of these Terms or of Meta's policies, or when required by law.</p>

    <h2>9. Liability</h2>
    <p>To the extent permitted by law, our liability is limited to the fees you paid in the three months before the event giving rise to the claim, and we are not liable for indirect or consequential losses.</p>

    <h2>10. Governing law</h2>
    <p>These Terms are governed by the laws of the Republic of Indonesia.</p>

    <h2>11. Changes and contact</h2>
    <p>We may update these Terms; the date above shows the latest version. Contact: <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a>.</p>
  {:else}
    <p>Ketentuan ini mengatur penggunaan {LEGAL.product} ({LEGAL.site}) yang disediakan oleh {LEGAL.company}. Dengan membuat akun atau memakai Layanan, Anda menyetujuinya untuk diri Anda dan bisnis yang Anda wakili.</p>

    <h2>1. Layanan</h2>
    <p>Platform web untuk mengelola percakapan WhatsApp Business: inbox bersama, kontak, template pesan, broadcast, balasan otomatis, dan laporan, yang terhubung ke WhatsApp Business Platform yang dioperasikan Meta.</p>

    <h2>2. Akun</h2>
    <ul>
      <li>Anda wajib memberikan informasi yang benar dan menjaga kerahasiaan data login.</li>
      <li>Administrator organisasi bertanggung jawab atas pengguna yang diundang dan peran yang diberikan.</li>
    </ul>

    <h2>3. WhatsApp dan Meta</h2>
    <ul>
      <li>Anda wajib mematuhi WhatsApp Business Terms, WhatsApp Business Messaging Policy, dan WhatsApp Commerce Policy.</li>
      <li>Anda hanya boleh mengirim pesan kepada orang yang telah memberi izin (opt-in) dan wajib menghormati permintaan berhenti (opt-out).</li>
      <li>Biaya percakapan WhatsApp ditagihkan oleh Meta kepada pemilik Akun WhatsApp Business dan terpisah dari biaya langganan kami.</li>
      <li>Meta dapat membatasi atau menangguhkan akun maupun nomor telepon; kami tidak bertanggung jawab atas keputusan Meta.</li>
    </ul>

    <h2>4. Penggunaan yang dilarang</h2>
    <p>Layanan tidak boleh dipakai untuk spam, penipuan, konten ilegal, pelecehan, pelanggaran hak atau privasi orang lain, maupun upaya mengganggu atau mengakses Layanan tanpa izin.</p>

    <h2>5. Paket dan pembayaran</h2>
    <ul>
      <li>Paket berbayar memberi akses selama periode yang dibeli dan dalam batas paket (mis. jumlah agen dan pesan broadcast).</li>
      <li>Uji coba gratis hanya dapat dipakai satu kali per organisasi.</li>
      <li>Pembayaran diproses oleh penyedia pembayaran kami; pertanyaan tagihan dapat dikirim ke kontak di bawah.</li>
    </ul>

    <h2>6. Data Anda</h2>
    <p>Data tetap milik Anda, dan Anda bertanggung jawab memiliki dasar hukum untuk memproses data pelanggan Anda. Kami memprosesnya sesuai <a href="/privacy">Kebijakan Privasi</a>.</p>

    <h2>7. Ketersediaan</h2>
    <p>Kami berupaya menjaga Layanan tetap tersedia dan aman, namun tidak menjamin berjalan tanpa gangguan. Pemeliharaan dan gangguan pihak ketiga (termasuk WhatsApp) dapat memengaruhi Layanan.</p>

    <h2>8. Penangguhan dan pengakhiran</h2>
    <p>Anda dapat berhenti memakai Layanan kapan saja. Kami dapat menangguhkan atau mengakhiri akses jika terjadi pelanggaran Ketentuan ini atau kebijakan Meta, atau bila diwajibkan hukum.</p>

    <h2>9. Tanggung jawab</h2>
    <p>Sejauh diizinkan hukum, tanggung jawab kami terbatas pada biaya yang Anda bayarkan dalam tiga bulan sebelum kejadian yang menjadi dasar klaim, dan kami tidak bertanggung jawab atas kerugian tidak langsung.</p>

    <h2>10. Hukum yang berlaku</h2>
    <p>Ketentuan ini tunduk pada hukum Republik Indonesia.</p>

    <h2>11. Perubahan dan kontak</h2>
    <p>Kami dapat memperbarui Ketentuan ini; tanggal di atas menunjukkan versi terbaru. Kontak: <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a>.</p>
  {/if}
</LegalShell>
