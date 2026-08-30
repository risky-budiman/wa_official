// ===========================================
// Media Serving Routes (Inbound WhatsApp Media)
// ===========================================

import { Elysia, t } from 'elysia';
import { join } from 'path';
import { existsSync } from 'fs';

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
  );
