// ===========================================
// Contact Routes — CRUD & Management
// ===========================================

import { Elysia, t } from 'elysia';
import { db } from '../../config/database';
import { contacts, conversations, messages } from '../../db/schema';
import { eq, and, or, like, desc, sql, inArray } from 'drizzle-orm';
import { authPlugin } from '../../middleware/auth';
import { nanoid } from 'nanoid';

const canManageContacts = (role?: string) => role === 'ADMINISTRATOR' || role === 'SUPERVISOR';

/**
 * Normalise a WhatsApp number to international digits (62812…).
 * Accepts +62 812-…, 0812…, 812…; returns null when it cannot be a phone number.
 */
export function normalizeWaId(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d.length >= 8 && d.length <= 15 ? d : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Merge custom attributes; a null / empty value removes the key (e.g. clearing a tag). */
function mergeAttributes(current: unknown, patch: Record<string, any>) {
  const out: Record<string, any> = { ...((current as Record<string, any>) || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null || v === undefined || v === '') delete out[k];
    else out[k] = v;
  }
  return out;
}

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

  // ─── GET /contacts/export ─── (all contacts; the browser builds the CSV)
  .get('/export', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (!canManageContacts(user.role)) {
      set.status = 403;
      return { success: false, error: 'Ekspor kontak hanya untuk Admin/Supervisor' };
    }
    const rows = await db
      .select({
        waId: contacts.waId,
        name: contacts.name,
        email: contacts.email,
        customAttributes: contacts.customAttributes,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(eq(contacts.organizationId, user.orgId))
      .orderBy(desc(contacts.createdAt))
      .limit(100000);
    return { success: true, contacts: rows };
  })

  // ─── POST /contacts/import ───
  // rows: [{ waId, name?, email?, tag? }] — new numbers are added; existing ones are
  // updated only when updateExisting is true. Invalid rows are reported, never half-saved.
  .post(
    '/import',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (!canManageContacts(user.role)) {
        set.status = 403;
        return { success: false, error: 'Impor kontak hanya untuk Admin/Supervisor' };
      }
      const rows = body.rows || [];
      if (rows.length === 0) {
        set.status = 400;
        return { success: false, error: 'File tidak berisi baris kontak' };
      }
      if (rows.length > 5000) {
        set.status = 400;
        return { success: false, error: 'Maksimal 5.000 kontak per impor. Pecah file menjadi beberapa bagian.' };
      }

      const errors: { row: number; reason: string }[] = [];
      const byWaId = new Map<string, { name: string | null; email: string | null; tag: string | null }>();
      rows.forEach((raw: any, i: number) => {
        const rowNo = i + 2; // +1 header, +1 human counting
        const waId = normalizeWaId(raw?.waId);
        if (!waId) {
          errors.push({ row: rowNo, reason: `Nomor "${String(raw?.waId ?? '').slice(0, 30)}" tidak valid` });
          return;
        }
        const email = String(raw?.email ?? '').trim();
        if (email && !EMAIL_RE.test(email)) {
          errors.push({ row: rowNo, reason: `Email "${email.slice(0, 60)}" tidak valid` });
          return;
        }
        byWaId.set(waId, {
          name: String(raw?.name ?? '').trim().slice(0, 255) || null,
          email: email ? email.slice(0, 255) : null,
          tag: String(raw?.tag ?? '').trim().slice(0, 60) || null,
        });
      });

      const waIds = [...byWaId.keys()];
      const existing = new Map<string, { id: string; customAttributes: unknown }>();
      for (let i = 0; i < waIds.length; i += 500) {
        const chunk = waIds.slice(i, i + 500);
        const found = await db
          .select({ id: contacts.id, waId: contacts.waId, customAttributes: contacts.customAttributes })
          .from(contacts)
          .where(and(eq(contacts.organizationId, user.orgId), inArray(contacts.waId, chunk)));
        for (const f of found) existing.set(f.waId, { id: f.id, customAttributes: f.customAttributes });
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const toInsert: any[] = [];
      for (const [waId, v] of byWaId) {
        const ex = existing.get(waId);
        if (ex) {
          if (!body.updateExisting) {
            skipped++;
            continue;
          }
          const patch: Record<string, any> = {};
          if (v.name) patch.name = v.name;
          if (v.email) patch.email = v.email;
          if (v.tag) patch.customAttributes = mergeAttributes(ex.customAttributes, { tag: v.tag });
          if (Object.keys(patch).length) {
            await db.update(contacts).set(patch).where(eq(contacts.id, ex.id));
            updated++;
          } else skipped++;
        } else {
          toInsert.push({
            id: nanoid(),
            organizationId: user.orgId,
            waId,
            name: v.name || waId,
            email: v.email,
            customAttributes: v.tag ? { tag: v.tag } : {},
          });
        }
      }
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500);
        await db.insert(contacts).values(chunk);
        created += chunk.length;
      }

      return {
        success: true,
        created,
        updated,
        skipped,
        duplicatesInFile: rows.length - errors.length - byWaId.size,
        errors: errors.slice(0, 100),
        errorCount: errors.length,
      };
    },
    {
      body: t.Object({
        rows: t.Array(t.Any()),
        updateExisting: t.Optional(t.Boolean()),
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
      const cleanWaId = normalizeWaId(body.waId);
      if (!cleanWaId) {
        set.status = 400;
        return { success: false, error: 'Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxx atau +62 812xxxxxxx.' };
      }
      if (body.email?.trim() && !EMAIL_RE.test(body.email.trim())) {
        set.status = 400;
        return { success: false, error: 'Format email tidak valid' };
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
          customAttributes: mergeAttributes({}, body.customAttributes || {}),
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
        if (body.name !== undefined && body.name !== null) updatePayload.name = body.name.trim() || contact.waId;
        if (body.email !== undefined) {
          const email = (body.email || '').trim();
          if (email && !EMAIL_RE.test(email)) {
            set.status = 400;
            return { success: false, error: 'Format email tidak valid' };
          }
          updatePayload.email = email || null;
        }
        if (body.customAttributes !== undefined && body.customAttributes !== null) {
          updatePayload.customAttributes = mergeAttributes(contact.customAttributes, body.customAttributes);
        }
        if (Object.keys(updatePayload).length === 0) {
          return { success: true, contact, message: 'Tidak ada perubahan' };
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
        name: t.Optional(t.Union([t.String(), t.Null()])),
        email: t.Optional(t.Union([t.String(), t.Null()])),
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
