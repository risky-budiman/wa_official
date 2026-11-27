// Body text + downloaded media for a WhatsApp message object, as it appears in a `messages`
// webhook, a WhatsApp Business app echo (`smb_message_echoes`) or an imported chat (`history`).

import { MetaApiService } from './meta-api.service';
import { describeInbound, type InboundDescription } from './inbound-message';

const MEDIA_TYPES = ['image', 'document', 'audio', 'video', 'sticker'] as const;

const MEDIA_LABEL: Record<string, string> = {
  image: '[Foto/Gambar]',
  audio: '[Pesan Suara / Audio]',
  video: '[Video]',
  sticker: '[Stiker]',
};

const DEFAULT_MIME: Record<string, string> = {
  image: 'image/jpeg',
  document: 'application/pdf',
  audio: 'audio/ogg',
  video: 'video/mp4',
  sticker: 'image/webp',
};

export interface MessageContent {
  body: string;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  described: InboundDescription;
}

export async function extractMessageContent(msg: any, accessToken: string): Promise<MessageContent> {
  const described = describeInbound(msg);
  const type = String(msg?.type || '');
  const media = (MEDIA_TYPES as readonly string[]).includes(type) ? msg?.[type] : null;

  if (type === 'text' && msg?.text) {
    return { body: String(msg.text.body ?? ''), mediaUrl: null, mediaMimeType: null, described };
  }
  if (!media) {
    return { body: described.body, mediaUrl: null, mediaMimeType: null, described };
  }

  let body: string;
  if (type === 'document') {
    const filename = media.filename || 'dokumen.pdf';
    body = media.caption ? `${media.caption} (${filename})` : `[Dokumen: ${filename}]`;
  } else {
    body = (type === 'image' || type === 'video' ? media.caption : '') || MEDIA_LABEL[type];
  }

  let mediaUrl: string | null = null;
  let mediaMimeType: string | null = media.mime_type || DEFAULT_MIME[type];
  if (media.id) {
    const downloaded = await MetaApiService.downloadMedia(media.id, accessToken);
    if (downloaded) {
      mediaUrl = downloaded.localUrl;
      mediaMimeType = downloaded.mimeType;
    }
  }
  return { body, mediaUrl, mediaMimeType, described };
}
