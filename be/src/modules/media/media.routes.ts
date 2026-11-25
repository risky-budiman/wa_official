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

/** Extensions accepted for upload (WhatsApp-supported media & document types only) */
const ALLOWED_UPLOAD_EXT = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'mp4', '3gp',
  'mp3', 'ogg', 'opus', 'aac', 'amr', 'm4a',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar',
]);

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
        if (!ALLOWED_UPLOAD_EXT.has(ext)) {
          set.status = 415;
          return {
            success: false,
            error: `Tipe file .${ext || '?'} tidak didukung. Gunakan gambar, video, audio, PDF, atau dokumen Office.`,
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
        const mimeType = file.type || 'application/octet-stream';

        // Determine messageType category: IMAGE, DOCUMENT, VIDEO, AUDIO
        let category = 'DOCUMENT';
        if (mimeType.startsWith('image/')) category = 'IMAGE';
        else if (mimeType.startsWith('video/')) category = 'VIDEO';
        else if (mimeType.startsWith('audio/')) category = 'AUDIO';

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
