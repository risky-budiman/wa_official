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

<LegalShell titleId="Petunjuk Penghapusan Data" titleEn="Data Deletion Instructions" {lang} onlang={(l) => (lang = l)}>
  {#if lang === 'en'}
    <p>You can ask us to delete the data held in {LEGAL.product} at any time.</p>

    <h2>Business accounts and users</h2>
    <ol class="list-decimal space-y-1 pl-5">
      <li>An administrator can disconnect WhatsApp in <em>Settings → WhatsApp channel</em> and remove users in <em>Team</em> at any time.</li>
      <li>To delete the whole organisation (users, contacts, conversations, media, templates and settings), send an e-mail from the administrator's registered address to <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a> with the subject <strong>"Data deletion request"</strong> and the organisation name.</li>
      <li>We confirm the request and complete the deletion within 30 days, then reply with a confirmation.</li>
    </ol>

    <h2>If you connected with Facebook</h2>
    <p>Remove the app from your Facebook account: <em>Facebook → Settings &amp; privacy → Settings → Business Integrations</em>, select <strong>{LEGAL.metaAppName}</strong> and choose <em>Remove</em>. Then send the e-mail above so we also delete the stored data (access token, WhatsApp Business Account and phone number IDs).</p>

    <h2>Customers who chatted with a business</h2>
    <p>Your messages are processed on behalf of the business you contacted. Ask that business to delete your data; you may also e-mail us with your WhatsApp number and the business name, and we will forward and assist with the request.</p>

    <h2>What is deleted</h2>
    <p>Account data, contacts, conversations and media, templates, settings and connection tokens. Records we must keep by law (e.g. invoices) are kept only for the required period.</p>
  {:else}
    <p>Anda dapat meminta kami menghapus data yang tersimpan di {LEGAL.product} kapan saja.</p>

    <h2>Akun bisnis dan pengguna</h2>
    <ol class="list-decimal space-y-1 pl-5">
      <li>Administrator dapat memutus koneksi WhatsApp di <em>Pengaturan → Saluran WhatsApp</em> dan menghapus pengguna di menu <em>Tim</em> kapan saja.</li>
      <li>Untuk menghapus seluruh organisasi (pengguna, kontak, percakapan, media, template, dan pengaturan), kirim email dari alamat administrator yang terdaftar ke <a href={`mailto:${legalContact.email}`}>{legalContact.email}</a> dengan subjek <strong>"Permintaan penghapusan data"</strong> dan sebutkan nama organisasinya.</li>
      <li>Kami mengonfirmasi permintaan dan menyelesaikan penghapusan paling lambat 30 hari, lalu mengirim konfirmasi.</li>
    </ol>

    <h2>Jika Anda terhubung melalui Facebook</h2>
    <p>Hapus aplikasi dari akun Facebook Anda: <em>Facebook → Pengaturan &amp; privasi → Pengaturan → Integrasi Bisnis</em>, pilih <strong>{LEGAL.metaAppName}</strong>, lalu <em>Hapus</em>. Setelah itu kirim email di atas agar data yang tersimpan (token akses, ID Akun WhatsApp Business, dan ID nomor telepon) juga kami hapus.</p>

    <h2>Pelanggan yang pernah chat dengan sebuah bisnis</h2>
    <p>Pesan Anda diproses atas nama bisnis yang Anda hubungi. Mintalah bisnis tersebut menghapus data Anda; Anda juga dapat mengirim email kepada kami berisi nomor WhatsApp Anda dan nama bisnisnya, dan kami akan meneruskan serta membantu permintaan tersebut.</p>

    <h2>Data yang dihapus</h2>
    <p>Data akun, kontak, percakapan dan media, template, pengaturan, serta token koneksi. Catatan yang wajib disimpan menurut hukum (mis. faktur) hanya disimpan selama jangka waktu yang diwajibkan.</p>
  {/if}
</LegalShell>
