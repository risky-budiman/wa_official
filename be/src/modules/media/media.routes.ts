// ===========================================
// Media Serving & Upload Routes
// ===========================================

import { Elysia, t } from 'elysia';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { nanoid } from 'nanoid';
import { authPlugin } from '../../middleware/auth';

/** Max upload size (WhatsApp Cloud API document limit is 100MB; nginx allows 50MB) */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type MediaCategory = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

/**
 * What WhatsApp Cloud API accepts, per file extension: how it is sent, its MIME type and
 * Meta's size limit. Anything else would be uploaded fine and then rejected by Meta.
 * GIF/WebP are not valid WhatsApp images (WebP is sticker-only), so they go as documents.
 */
const MEDIA_RULES: Record<string, { category: MediaCategory; mime: string; maxBytes: number }> = {
  jpg: { category: 'IMAGE', mime: 'image/jpeg', maxBytes: 5 * 1024 * 1024 },
  jpeg: { category: 'IMAGE', mime: 'image/jpeg', maxBytes: 5 * 1024 * 1024 },
  png: { category: 'IMAGE', mime: 'image/png', maxBytes: 5 * 1024 * 1024 },
  gif: { category: 'DOCUMENT', mime: 'image/gif', maxBytes: MAX_UPLOAD_BYTES },
  webp: { category: 'DOCUMENT', mime: 'image/webp', maxBytes: MAX_UPLOAD_BYTES },
  mp4: { category: 'VIDEO', mime: 'video/mp4', maxBytes: 16 * 1024 * 1024 },
  '3gp': { category: 'VIDEO', mime: 'video/3gpp', maxBytes: 16 * 1024 * 1024 },
  mp3: { category: 'AUDIO', mime: 'audio/mpeg', maxBytes: 16 * 1024 * 1024 },
  ogg: { category: 'AUDIO', mime: 'audio/ogg', maxBytes: 16 * 1024 * 1024 },
  opus: { category: 'AUDIO', mime: 'audio/ogg', maxBytes: 16 * 1024 * 1024 },
  aac: { category: 'AUDIO', mime: 'audio/aac', maxBytes: 16 * 1024 * 1024 },
  amr: { category: 'AUDIO', mime: 'audio/amr', maxBytes: 16 * 1024 * 1024 },
  m4a: { category: 'AUDIO', mime: 'audio/mp4', maxBytes: 16 * 1024 * 1024 },
  pdf: { category: 'DOCUMENT', mime: 'application/pdf', maxBytes: MAX_UPLOAD_BYTES },
  doc: { category: 'DOCUMENT', mime: 'application/msword', maxBytes: MAX_UPLOAD_BYTES },
  docx: { category: 'DOCUMENT', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', maxBytes: MAX_UPLOAD_BYTES },
  xls: { category: 'DOCUMENT', mime: 'application/vnd.ms-excel', maxBytes: MAX_UPLOAD_BYTES },
  xlsx: { category: 'DOCUMENT', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', maxBytes: MAX_UPLOAD_BYTES },
  ppt: { category: 'DOCUMENT', mime: 'application/vnd.ms-powerpoint', maxBytes: MAX_UPLOAD_BYTES },
  pptx: { category: 'DOCUMENT', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', maxBytes: MAX_UPLOAD_BYTES },
  txt: { category: 'DOCUMENT', mime: 'text/plain', maxBytes: MAX_UPLOAD_BYTES },
};

const CATEGORY_LABEL: Record<MediaCategory, string> = { IMAGE: 'gambar', VIDEO: 'video', AUDIO: 'audio', DOCUMENT: 'dokumen' };

/** Extensions that are safe for the browser to render inline */
const INLINE_SAFE_EXT = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'mp4', '3gp',
  'mp3', 'ogg', 'opus', 'aac', 'amr', 'm4a',
  'pdf',
]);

export const mediaRoutes = new Elysia({ prefix: '/media' })
  .get(
    '/:filename',
    async ({ params: { filename }, set }) => {
      const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
      const filePath = join(process.cwd(), 'uploads', 'media', safeFilename);

      if (!existsSync(filePath)) {
        set.status = 404;
        return { success: false, error: 'File media tidak ditemukan' };
      }

      // Return native Bun File handle with automatic MIME type streaming and caching headers
      set.headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      set.headers['X-Content-Type-Options'] = 'nosniff';

      // 🔒 Anything that is not plain media/PDF (e.g. old .html/.svg uploads) is forced to download
      // inside a sandbox, so it can never run scripts on this origin (stored XSS protection).
      const ext = (safeFilename.split('.').pop() || '').toLowerCase();
      if (!INLINE_SAFE_EXT.has(ext)) {
        set.headers['Content-Disposition'] = 'attachment';
        set.headers['Content-Security-Policy'] = "sandbox; default-src 'none'";
      }

      return Bun.file(filePath);
    },
    {
      params: t.Object({
        filename: t.String(),
      }),
    }
  )
  .use(authPlugin)
  .post(
    '/upload',
    async ({ user, body, set }) => {
      // 🔒 Upload requires a logged-in user
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized: Harap login terlebih dahulu' };
      }

      try {
        const file = body.file as File;
        if (!file) {
          set.status = 400;
          return { success: false, error: 'File tidak ditemukan' };
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          set.status = 413;
          return { success: false, error: `Ukuran file maksimal ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB` };
        }

        // Sanitize & validate extension (whitelist only)
        const originalName = file.name || 'file';
        const ext = originalName.includes('.') ? (originalName.split('.').pop() || '').toLowerCase() : '';
        const rule = MEDIA_RULES[ext];
        if (!rule) {
          set.status = 415;
          return {
            success: false,
            error: `Tipe file .${ext || '?'} tidak didukung WhatsApp. Gunakan JPG/PNG, MP4, MP3/OGG/AAC/M4A, PDF, TXT, atau dokumen Office.`,
          };
        }
        if (file.size > rule.maxBytes) {
          set.status = 413;
          return {
            success: false,
            error: `Ukuran ${CATEGORY_LABEL[rule.category]} maksimal ${Math.round(rule.maxBytes / 1024 / 1024)}MB menurut aturan WhatsApp.`,
          };
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Unguessable filename (media URLs are public because Meta must be able to fetch them)
        const filename = `${Date.now()}_${nanoid(24)}.${ext}`;
        const uploadDir = join(process.cwd(), 'uploads', 'media');

        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = join(uploadDir, filename);
        await Bun.write(filePath, buffer);

        const mediaUrl = `/api/v1/media/${filename}`;
        // Type comes from the (validated) extension, not from what the browser claims
        const mimeType = rule.mime;
        const category = rule.category;

        return {
          success: true,
          mediaUrl,
          filename: originalName,
          mimeType,
          size: file.size,
          category,
        };
      } catch (err: any) {
        set.status = 500;
        return { success: false, error: err.message || 'Gagal mengunggah file' };
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  );
