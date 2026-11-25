// ===========================================
// Phone number (WhatsApp channel) lifecycle
// ===========================================
//
// An organization has at most ONE active number (status != 'ARCHIVED').
// Old numbers are never deleted — conversations reference them (FK) and their
// history must stay readable. Switching or disconnecting a number archives it.

import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../config/database';
import { phoneNumbers, type PhoneNumber } from '../db/schema';

export const PHONE_STATUS_ARCHIVED = 'ARCHIVED';

/** NULL-safe "not archived" condition (rows with a NULL status count as active). */
export const notArchived = () => sql`COALESCE(${phoneNumbers.status}, '') <> ${PHONE_STATUS_ARCHIVED}`;

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class PhoneNumberInUseError extends Error {
  constructor() {
    super('Nomor WhatsApp ini sudah terhubung ke organisasi lain. Putuskan dulu dari organisasi tersebut.');
    this.name = 'PhoneNumberInUseError';
  }
}

/** The organization's current (non-archived) number, newest first. */
export async function getActivePhone(orgId: string, executor: Executor = db): Promise<PhoneNumber | null> {
  if (!orgId) return null;
  const [phone] = await executor
    .select()
    .from(phoneNumbers)
    .where(and(eq(phoneNumbers.organizationId, orgId), notArchived()))
    .orderBy(desc(phoneNumbers.createdAt))
    .limit(1);
  return phone ?? null;
}

/** Archive every non-archived number of an organization. */
export async function archiveOrgPhones(orgId: string, executor: Executor = db) {
  await executor
    .update(phoneNumbers)
    .set({ status: PHONE_STATUS_ARCHIVED })
    .where(and(eq(phoneNumbers.organizationId, orgId), notArchived()));
}

export interface ActivatePhoneInput {
  phoneNumberId: string; // Meta phone_number_id
  displayPhoneNumber?: string;
  verifiedName?: string | null;
  qualityRating?: string | null;
}

/**
 * Make `phoneNumberId` the organization's active number (atomic):
 *  - same number already active  → refresh its details
 *  - number archived in this org → re-activate it (keeps its history)
 *  - number archived in another org → free the unique slot, then create a new record
 *  - number ACTIVE in another org → refuse (prevents taking over another tenant's webhooks)
 * Any other active number of the organization is archived.
 */
export async function activatePhoneNumber(orgId: string, input: ActivatePhoneInput): Promise<PhoneNumber> {
  const targetId = input.phoneNumberId?.trim();
  if (!orgId || !targetId) throw new Error('Phone Number ID wajib diisi');

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(phoneNumbers).where(eq(phoneNumbers.phoneNumberId, targetId)).limit(1);

    if (existing && existing.organizationId !== orgId) {
      if (existing.status !== PHONE_STATUS_ARCHIVED) throw new PhoneNumberInUseError();
      // Keep the other org's archived history, but release the unique phone_number_id
      await tx
        .update(phoneNumbers)
        .set({ phoneNumberId: `${targetId}#archived-${nanoid(6)}` })
        .where(eq(phoneNumbers.id, existing.id));
    }

    const reuse = existing && existing.organizationId === orgId ? existing : null;

    // Archive every other active number of this org
    await tx
      .update(phoneNumbers)
      .set({ status: PHONE_STATUS_ARCHIVED })
      .where(
        and(
          eq(phoneNumbers.organizationId, orgId),
          notArchived(),
          ...(reuse ? [ne(phoneNumbers.id, reuse.id)] : [])
        )
      );

    const details = {
      displayPhoneNumber: input.displayPhoneNumber?.trim() || reuse?.displayPhoneNumber || 'Nomor WhatsApp Business',
      verifiedName: input.verifiedName?.trim() || reuse?.verifiedName || 'Akun WhatsApp Business Resmi',
      qualityRating: input.qualityRating || reuse?.qualityRating || 'UNKNOWN',
      status: 'CONNECTED',
    };

    if (reuse) {
      await tx.update(phoneNumbers).set(details).where(eq(phoneNumbers.id, reuse.id));
      return { ...reuse, ...details };
    }

    const record = { id: nanoid(), organizationId: orgId, phoneNumberId: targetId, ...details };
    await tx.insert(phoneNumbers).values(record);
    const [created] = await tx.select().from(phoneNumbers).where(eq(phoneNumbers.id, record.id)).limit(1);
    return created;
  });
}

/** Pick the Meta phone entry that matches our active number, else the first one. */
export function pickMetaPhone(metaPhones: any[] | null | undefined, preferredId?: string | null): any | null {
  if (!metaPhones || metaPhones.length === 0) return null;
  if (preferredId) {
    const match = metaPhones.find((p) => p.id === preferredId);
    if (match) return match;
  }
  return metaPhones[0];
}
