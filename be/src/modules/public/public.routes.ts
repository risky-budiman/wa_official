// ===========================================
// Public (no login) information for the legal pages
// ===========================================
import { Elysia } from 'elysia';
import { env } from '../../config/env';

export const publicRoutes = new Elysia({ prefix: '/public' })
  // Contact address shown on /privacy, /terms and /data-deletion (LEGAL_CONTACT_EMAIL in .env)
  .get('/legal-info', ({ set }) => {
    set.headers['Cache-Control'] = 'public, max-age=300';
    return { success: true, contactEmail: env.LEGAL_CONTACT_EMAIL || null };
  });
