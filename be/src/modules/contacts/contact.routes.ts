// ===========================================
// Contact Routes — CRUD & Management
// ===========================================

import { Elysia, t } from 'elysia';
import { db } from '../../config/database';
import { contacts, conversations, messages } from '../../db/schema';
import { eq, and, or, like, desc, sql } from 'drizzle-orm';
import { authPlugin } from '../../middleware/auth';
import { nanoid } from 'nanoid';

export const contactRoutes = new Elysia({ prefix: '/contacts' })
  .use(authPlugin)

  // ─── GET /contacts ───
  // List all contacts for the user's organization with search & pagination
  .get(
    '/',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = user.orgId;
      const search = query?.search?.trim() || '';
      const page = Math.max(1, parseInt(query?.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query?.limit || '50', 10)));
      const offset = (page - 1) * limit;

      try {
        let whereCondition = eq(contacts.organizationId, orgId);

        if (search) {
          const searchPattern = `%${search}%`;
          whereCondition = and(
            eq(contacts.organizationId, orgId),
            or(
              like(contacts.name, searchPattern),
              like(contacts.waId, searchPattern),
              like(contacts.email, searchPattern)
            )
          ) as any;
        }

        // Fetch contacts
        const contactList = await db
          .select()
          .from(contacts)
          .where(whereCondition)
          .orderBy(desc(contacts.createdAt))
          .limit(limit)
          .offset(offset);

        // Fetch total count
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(contacts)
          .where(whereCondition);

        return {
          success: true,
          contacts: contactList,
          pagination: {
            page,
            limit,
            total: Number(count),
            totalPages: Math.ceil(Number(count) / limit),
          },
        };
      } catch (err: any) {
        console.error('Error fetching contacts:', err);
        set.status = 500;
        return { success: false, error: 'Gagal memuat daftar kontak' };
      }
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )

  // ─── GET /contacts/:id ───
  // Get contact details with conversation stats
  .get('/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, params.id),
            eq(contacts.organizationId, user.orgId)
          )
        )
        .limit(1);

      if (!contact) {
        set.status = 404;
        return { success: false, error: 'Kontak tidak ditemukan' };
      }

      // Get conversation history associated with this contact
      const contactConversations = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.contactId, contact.id),
            eq(conversations.organizationId, user.orgId)
          )
        )
        .orderBy(desc(conversations.createdAt));

      return {
        success: true,
        contact,
        conversations: contactConversations,
      };
    } catch (err: any) {
      console.error('Error fetching contact details:', err);
      set.status = 500;
      return { success: false, error: 'Gagal memuat detail kontak' };
    }
  })

  // ─── POST /contacts ───
  // Create a new contact manually
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = user.orgId;
      let cleanWaId = body.waId.replace(/\D/g, ''); // Keep only numbers
      if (cleanWaId.startsWith('0')) {
        cleanWaId = '62' + cleanWaId.slice(1);
      }

      if (!cleanWaId) {
        set.status = 400;
        return { success: false, error: 'Nomor WhatsApp wajib diisi' };
      }

      try {
        // Check if contact already exists in this organization
        const [existingContact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.organizationId, orgId),
              eq(contacts.waId, cleanWaId)
            )
          )
          .limit(1);

        if (existingContact) {
          set.status = 409;
          return { success: false, error: `Kontak dengan nomor WhatsApp ${cleanWaId} sudah terdaftar` };
        }

        const newId = nanoid();
        await db.insert(contacts).values({
          id: newId,
          organizationId: orgId,
          waId: cleanWaId,
          name: body.name?.trim() || cleanWaId,
          email: body.email?.trim() || null,
          customAttributes: body.customAttributes || {},
        });

        const [createdContact] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, newId));

        return {
          success: true,
          contact: createdContact,
          message: 'Kontak baru berhasil ditambahkan',
        };
      } catch (err: any) {
        console.error('Error creating contact:', err);
        set.status = 500;
        return { success: false, error: 'Gagal menambahkan kontak' };
      }
    },
    {
      body: t.Object({
        waId: t.String(),
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
        customAttributes: t.Optional(t.Any()),
      }),
    }
  )

  // ─── PATCH /contacts/:id ───
  // Update contact information
  .patch(
    '/:id',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.id, params.id),
              eq(contacts.organizationId, user.orgId)
            )
          )
          .limit(1);

        if (!contact) {
          set.status = 404;
          return { success: false, error: 'Kontak tidak ditemukan' };
        }

        const updatePayload: Record<string, any> = {};
        if (body.name !== undefined) updatePayload.name = body.name.trim();
        if (body.email !== undefined) updatePayload.email = body.email ? body.email.trim() : null;
        if (body.customAttributes !== undefined) {
          updatePayload.customAttributes = {
            ...(contact.customAttributes as Record<string, any> || {}),
            ...body.customAttributes,
          };
        }

        await db
          .update(contacts)
          .set(updatePayload)
          .where(eq(contacts.id, params.id));

        const [updatedContact] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, params.id));

        return {
          success: true,
          contact: updatedContact,
          message: 'Informasi kontak berhasil diperbarui',
        };
      } catch (err: any) {
        console.error('Error updating contact:', err);
        set.status = 500;
        return { success: false, error: 'Gagal memperbarui kontak' };
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
        customAttributes: t.Optional(t.Any()),
      }),
    }
  )

  // ─── DELETE /contacts/:id ───
  // Delete contact (cascade removes conversations)
  .delete('/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    if (user.role !== 'ADMINISTRATOR' && user.role !== 'SUPERVISOR') {
      set.status = 403;
      return { success: false, error: 'Akses dibatasi untuk Admin/Supervisor' };
    }

    try {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, params.id),
            eq(contacts.organizationId, user.orgId)
          )
        )
        .limit(1);

      if (!contact) {
        set.status = 404;
        return { success: false, error: 'Kontak tidak ditemukan' };
      }

      await db.delete(contacts).where(eq(contacts.id, params.id));

      return {
        success: true,
        message: 'Kontak berhasil dihapus',
      };
    } catch (err: any) {
      console.error('Error deleting contact:', err);
      set.status = 500;
      return { success: false, error: 'Gagal menghapus kontak' };
    }
  });
