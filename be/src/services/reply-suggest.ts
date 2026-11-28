// ===========================================
// Reply suggestions for agents (inbox "Asisten Balasan Pintar AI")
// ===========================================
//
// Pure helpers: build the prompt from the real conversation and parse the model's answer.
// The model call itself lives in MessageService.generateAiSuggestions (uses the org's AI settings).

export type SuggestMode = 'SMART_REPLY' | 'POLISH_DRAFT';
export type ReplySuggestion = { title: string; text: string };
export type TranscriptLine = { direction: 'INBOUND' | 'OUTBOUND'; messageType?: string | null; body?: string | null };

const MAX_LINE_CHARS = 600;

/** One readable line per message; media without a caption becomes a short tag. */
export function formatTranscript(lines: TranscriptLine[]): string {
  return lines
    .map((m) => {
      const who = m.direction === 'INBOUND' ? 'Pelanggan' : 'Kami (CS)';
      let text = (m.body || '').trim();
      if (!text) text = m.messageType && m.messageType !== 'text' ? `[mengirim ${m.messageType}]` : '';
      if (!text) return '';
      if (text.length > MAX_LINE_CHARS) text = `${text.slice(0, MAX_LINE_CHARS)}…`;
      return `${who}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

export function buildSuggestSystemPrompt(orgName: string, companyGuide?: string) {
  const base = `Anda membantu agen customer service WhatsApp dari ${orgName} menyusun balasan untuk pelanggan.
Aturan:
- Balasan harus nyambung langsung dengan pesan TERAKHIR pelanggan dan konteks percakapan sebelumnya. Jangan mengulang hal yang sudah dijawab.
- Bahasa Indonesia yang natural, ramah, dan ringkas seperti chat WhatsApp (1-4 kalimat). Ikuti gaya bahasa yang sudah dipakai di percakapan.
- Format WhatsApp saja (*tebal*, _miring_); jangan pakai Markdown lain.
- JANGAN mengarang fakta: harga, stok, alamat, nomor rekening, jam buka, status pesanan, nomor resi, kebijakan. Gunakan hanya informasi dari panduan perusahaan atau percakapan. Jika data itu diperlukan tetapi tidak ada, tulis penanda dalam kurung siku, misalnya [isi harga] atau [isi nomor resi], agar agen melengkapinya.
- Jangan menjanjikan hal yang belum pasti.

Jawab HANYA dengan JSON array berisi tepat 3 objek, tanpa teks lain:
[{"title": "judul singkat 2-5 kata", "text": "isi balasan"}, ...]`;
  const guide = companyGuide?.trim();
  return guide ? `${base}\n\n[PANDUAN PERUSAHAAN]\n${guide}` : base;
}

export function buildSuggestUserPrompt(p: { transcript: string; contactName?: string; draft?: string }): string {
  const name = cleanContactName(p.contactName);
  const parts = [
    `Nama pelanggan: ${name || '(tidak diketahui, sapa dengan "Kak")'}`,
    '',
    'Percakapan (lama → baru):',
    p.transcript || '(belum ada pesan)',
    '',
  ];
  const draft = p.draft?.trim();
  if (draft) {
    parts.push(
      'Agen sudah menulis draf berikut:',
      `"""${draft}"""`,
      '',
      'Buat 3 versi perbaikan draf tersebut (pertahankan maksud dan semua informasinya, perbaiki ejaan dan nada, sesuaikan dengan percakapan): 1) ramah, 2) singkat & jelas, 3) formal.'
    );
  } else {
    parts.push(
      'Buat 3 pilihan balasan berbeda untuk pesan terakhir pelanggan. Bedakan pendekatannya (misalnya: menjawab langsung, menanyakan detail yang kurang, menawarkan langkah berikutnya) — bukan hanya beda nada dengan isi yang sama.'
    );
  }
  return parts.join('\n');
}

/** Phone numbers / placeholders are not names. */
export function cleanContactName(name?: string | null): string {
  const n = (name || '').trim();
  if (!n || /^[+\d\s-]+$/.test(n) || n.toLowerCase() === 'kak') return '';
  return n;
}

/** Pull the JSON array out of the model reply (tolerates ```json fences and surrounding text). */
export function parseSuggestions(raw: string): ReplySuggestion[] {
  const text = (raw || '').replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((item: any) => ({
      title: typeof item?.title === 'string' ? item.title.trim().slice(0, 60) : '',
      text: typeof item?.text === 'string' ? item.text.trim() : '',
    }))
    .filter((s) => s.text)
    .map((s, i) => ({ title: s.title || `Opsi ${i + 1}`, text: s.text }))
    .slice(0, 3);
}
