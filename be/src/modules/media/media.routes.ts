// ===========================================
// Media Serving & Upload Routes
// ===========================================

import { Elysia, t } from 'elysia';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { authPlugin } from '../../middleware/auth';

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
    async ({ body, set }) => {
      try {
        const file = body.file as File;
        if (!file) {
          set.status = 400;
          return { success: false, error: 'File tidak ditemukan' };
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize & generate unique filename
        const originalName = file.name || 'file';
        const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
        const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
