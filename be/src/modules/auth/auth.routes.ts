// ===========================================
// Auth Routes — Register & Login
// ===========================================

import { Elysia, t } from 'elysia';
import { authPlugin } from '../../middleware/auth';
import { AuthService } from './auth.service';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)

  // ─── POST /auth/register ───────────────────
  .post(
    '/register',
    async ({ body, jwt, set }) => {
      try {
        const user = await AuthService.register(body);

        // Generate JWT token
        const token = await jwt.sign({
          id: user.id,
          orgId: user.organizationId,
          role: user.role,
          email: user.email,
        });

        set.status = 201;
        return {
          success: true,
          token,
          user,
        };
      } catch (error: any) {
        set.status = 400;
        return {
          success: false,
          error: error.message || 'Registrasi gagal',
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        fullName: t.String({ minLength: 2 }),
        organizationName: t.Optional(t.String()),
        organizationId: t.Optional(t.String()),
        role: t.Optional(
          t.Union([
            t.Literal('ADMINISTRATOR'),
            t.Literal('SUPERVISOR'),
            t.Literal('AGENT'),
          ])
        ),
      }),
    }
  )

  // ─── POST /auth/login ─────────────────────
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      try {
        const user = await AuthService.login(body);

        // Generate JWT token
        const token = await jwt.sign({
          id: user.id,
          orgId: user.organizationId,
          role: user.role,
          email: user.email,
        });

        return {
          success: true,
          token,
          user,
        };
      } catch (error: any) {
        set.status = 401;
        return {
          success: false,
          error: error.message || 'Login gagal',
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String(),
        organizationId: t.Optional(t.String()),
      }),
    }
  )

  // ─── GET /auth/me — Current user profile ──
  .get('/me', ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    return {
      success: true,
      user,
    };
  })

  // ─── GET /auth/org/:id — Validate Organization ID (for Join Org Registration) ──
  .get(
    '/org/:id',
    async ({ params, set }) => {
      try {
        const org = await AuthService.lookupOrganization(params.id);
        if (!org) {
          set.status = 404;
          return { success: false, error: 'Organisasi tidak ditemukan' };
        }
        return {
          success: true,
          organization: org,
        };
      } catch (error: any) {
        set.status = 400;
        return { success: false, error: error.message };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
