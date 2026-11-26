// Readable text for inbound WhatsApp messages that carry no downloadable media
// (pure function, unit-tested). Media types (image, video, audio, document, sticker)
// are handled by the webhook processor because they need a download.

export interface InboundDescription {
  /** Text shown in the Inbox / conversation preview */
  body: string;
  /** Treat like a typed message: may trigger the chatbot keyword menu / AI */
  textLike: boolean;
  /** Not worth opening a new ticket for (e.g. a reaction to an old message) */
  onlyInActiveConversation: boolean;
}

const clip = (s: unknown, n = 300) => String(s ?? '').trim().slice(0, n);

export function describeInbound(msg: any): InboundDescription {
  const type = String(msg?.type || '').toLowerCase();
  switch (type) {
    case 'text':
      return { body: String(msg?.text?.body ?? ''), textLike: true, onlyInActiveConversation: false };

    // Customer tapped a quick-reply button of a template (e.g. a broadcast)
    case 'button':
      return { body: clip(msg?.button?.text || msg?.button?.payload) || '[Tombol]', textLike: true, onlyInActiveConversation: false };

    // Customer picked a reply button / list row of an interactive message
    case 'interactive': {
      const i = msg?.interactive || {};
      const picked = i.button_reply || i.list_reply;
      if (picked) {
        const title = clip(picked.title);
        const desc = clip(picked.description, 200);
        return { body: desc ? `${title} — ${desc}` : title || '[Pilihan]', textLike: true, onlyInActiveConversation: false };
      }
      if (i.nfm_reply) return { body: '[Formulir WhatsApp dikirim]', textLike: false, onlyInActiveConversation: false };
      return { body: '[Pesan interaktif]', textLike: false, onlyInActiveConversation: false };
    }

    case 'location': {
      const l = msg?.location || {};
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      const place = [clip(l.name, 120), clip(l.address, 200)].filter(Boolean).join(', ');
      const map = Number.isFinite(lat) && Number.isFinite(lng) ? `https://maps.google.com/?q=${lat},${lng}` : '';
      return { body: ['📍 Lokasi', place, map].filter(Boolean).join('\n'), textLike: false, onlyInActiveConversation: false };
    }

    case 'contacts': {
      const list: any[] = Array.isArray(msg?.contacts) ? msg.contacts : [];
      const lines = list.slice(0, 5).map((c) => {
        const name = clip(c?.name?.formatted_name || c?.name?.first_name, 80) || 'Tanpa nama';
        const phones = (Array.isArray(c?.phones) ? c.phones : []).map((p: any) => clip(p?.phone || p?.wa_id, 30)).filter(Boolean);
        return `• ${name}${phones.length ? ` (${phones.join(', ')})` : ''}`;
      });
      return { body: ['👤 Kartu kontak', ...lines].join('\n'), textLike: false, onlyInActiveConversation: false };
    }

    case 'reaction': {
      const emoji = clip(msg?.reaction?.emoji, 16);
      return {
        body: emoji ? `Bereaksi ${emoji} pada pesan` : 'Menghapus reaksi',
        textLike: false,
        onlyInActiveConversation: true,
      };
    }

    case 'order':
      return { body: `🛒 Pesanan katalog (${(msg?.order?.product_items || []).length} item)`, textLike: false, onlyInActiveConversation: false };

    case 'unsupported':
      return { body: '[Jenis pesan ini belum didukung WhatsApp Cloud API]', textLike: false, onlyInActiveConversation: false };

    default:
      return { body: `[${type.toUpperCase() || 'PESAN'}]`, textLike: false, onlyInActiveConversation: false };
  }
}

/** File extension for a downloaded media MIME type (specific types before generic ones). */
export function extensionForMime(mime: string): string {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  const table: [string, string][] = [
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif'],
    ['audio/mp4', 'm4a'],
    ['audio/aac', 'aac'],
    ['audio/amr', 'amr'],
    ['audio/ogg', 'ogg'],
    ['audio/opus', 'ogg'],
    ['audio/mpeg', 'mp3'],
    ['audio/mp3', 'mp3'],
    ['video/mp4', 'mp4'],
    ['video/3gpp', '3gp'],
    ['application/pdf', 'pdf'],
    ['text/plain', 'txt'],
    ['application/msword', 'doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
    ['application/vnd.ms-excel', 'xls'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
    ['application/vnd.ms-powerpoint', 'ppt'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  ];
  return table.find(([k]) => m === k)?.[1] || 'bin';
}
