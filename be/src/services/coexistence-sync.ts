// ===========================================
// WhatsApp Business app Coexistence
// ===========================================
//
// A number onboarded with Embedded Signup "WhatsApp Business app onboarding" stays active in the
// WhatsApp Business app on the phone while it is also on the Cloud API. Meta then sends:
//  - smb_message_echoes: a message the business sent FROM THE APP → stored as an outbound message
//  - history:            chats from the app (up to 6 months), once, after onboarding
//  - smb_app_state_sync: the app's address book (contact names)
// These three fields must be ticked in the Meta App Dashboard → WhatsApp → Configuration → Webhooks.

import { and, desc, eq, lte, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../config/database';
import { contacts, conversations, messages, type PhoneNumber } from '../db/schema';
import { extractMessageContent } from './message-content';

export interface CoexistenceContext {
  orgId: string;
  phone: PhoneNumber;
  accessToken: string;
}

type Direction = 'INBOUND' | 'OUTBOUND';
type Status = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface HistoryItem {
  customerWaId: string;
  direction: Direction;
  status: Status;
  msg: any;
}

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** history_context.status of an imported message → our message status. */
export function historyStatus(raw: unknown, direction: Direction): Status {
  if (direction === 'INBOUND') return 'READ'; // old chats: never count as unread
  const s = String(raw || '').toUpperCase();
  if (s === 'READ' || s === 'PLAYED') return 'READ';
  if (s === 'DELIVERED') return 'DELIVERED';
  if (s === 'ERROR' || s === 'FAILED') return 'FAILED';
  if (s === 'PENDING') return 'PENDING';
  return 'SENT';
}

/**
 * Flatten a `history` webhook value into messages, oldest first. A thread's id is the customer's
 * wa_id; a message whose `from` is not the customer was sent by the business.
 */
export function historyItems(value: any): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const chunk of Array.isArray(value?.history) ? value.history : []) {
    for (const thread of Array.isArray(chunk?.threads) ? chunk.threads : []) {
      const customerWaId = digits(thread?.id);
      if (!customerWaId) continue;
      for (const msg of Array.isArray(thread?.messages) ? thread.messages : []) {
        if (!msg?.id) continue;
        const direction: Direction = digits(msg.from) === customerWaId ? 'INBOUND' : 'OUTBOUND';
        items.push({ customerWaId, direction, status: historyStatus(msg.history_context?.status, direction), msg });
      }
    }
  }
  return items.sort((a, b) => Number(a.msg.timestamp || 0) - Number(b.msg.timestamp || 0));
}

/** `smb_app_state_sync` contact entries that add or update a contact. */
export function syncedContacts(value: any): { waId: string; name: string }[] {
  const out: { waId: string; name: string }[] = [];
  for (const s of Array.isArray(value?.state_sync) ? value.state_sync : []) {
    if (s?.type !== 'contact' || s?.action === 'remove') continue;
    const waId = digits(s.contact?.phone_number);
    const name = String(s.contact?.full_name || s.contact?.first_name || '').trim();
    if (waId) out.push({ waId, name });
  }
  return out;
}

async function findOrCreateContact(orgId: string, waId: string, name?: string) {
  const find = async () =>
    (await db.select().from(contacts).where(and(eq(contacts.organizationId, orgId), eq(contacts.waId, waId))).limit(1))[0];
  const existing = await find();
  if (existing) return existing;
  try {
    await db.insert(contacts).values({
      id: nanoid(),
      organizationId: orgId,
      waId,
      name: name || waId,
      email: null,
      customAttributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch {
    // concurrent insert (uq_org_wa) — fall through to re-read
  }
  return find();
}

/**
 * Conversation that app messages belong to: the open one, else the latest one. Without any, a
 * RESOLVED one is created so chats handled on the phone do not land in the agents' queue.
 */
async function conversationFor(ctx: CoexistenceContext, contactId: string, at: Date) {
  const base = and(eq(conversations.organizationId, ctx.orgId), eq(conversations.contactId, contactId));
  const [active] = await db.select().from(conversations).where(and(base, ne(conversations.status, 'RESOLVED'))).orderBy(desc(conversations.createdAt)).limit(1);
  if (active) return active;
  const [latest] = await db.select().from(conversations).where(base).orderBy(desc(conversations.createdAt)).limit(1);
  if (latest) return latest;

  const id = nanoid();
  await db.insert(conversations).values({
    id,
    organizationId: ctx.orgId,
    phoneNumberId: ctx.phone.id,
    contactId,
    assignedUserId: null,
    status: 'RESOLVED',
    windowExpiresAt: null,
    lastMessagePreview: null,
    lastMessageAt: at,
    createdAt: at,
  });
  return (await db.select().from(conversations).where(eq(conversations.id, id)).limit(1))[0];
}

/** Store one app message (deduplicated by wamid). Returns where it was stored, or null when it already was. */
async function storeMessage(
  ctx: CoexistenceContext,
  item: HistoryItem,
  contactName?: string
): Promise<{ conversationId: string; at: Date } | null> {
  const wamId = String(item.msg.id);
  const [dup] = await db.select({ id: messages.id }).from(messages).where(eq(messages.wamId, wamId)).limit(1);
  if (dup) return null;

  const contact = await findOrCreateContact(ctx.orgId, item.customerWaId, contactName);
  if (!contact) return null;
  const at = item.msg.timestamp ? new Date(Number(item.msg.timestamp) * 1000) : new Date();
  const conv = await conversationFor(ctx, contact.id, at);
  if (!conv) return null;

  const { body, mediaUrl, mediaMimeType } = await extractMessageContent(item.msg, ctx.accessToken);
  try {
    await db.insert(messages).values({
      id: nanoid(),
      conversationId: conv.id,
      wamId,
      direction: item.direction,
      // AGENT without a user = sent from the WhatsApp Business app on the phone
      senderType: item.direction === 'INBOUND' ? 'CONTACT' : 'AGENT',
      senderId: null,
      messageType: String(item.msg.type || 'text'),
      body,
      mediaUrl,
      mediaMimeType,
      isInternalNote: false,
      status: item.status,
      errorDetails: null,
      createdAt: at,
    });
  } catch {
    return null; // stored concurrently (uq_wamid)
  }

  // Only move the conversation preview forward in time (history arrives in chunks)
  if (!conv.lastMessageAt || at >= new Date(conv.lastMessageAt)) {
    await db.update(conversations).set({ lastMessagePreview: body, lastMessageAt: at }).where(eq(conversations.id, conv.id));
  }
  return { conversationId: conv.id, at };
}

/**
 * The business answered on the phone, so the customer's messages up to that reply were seen there:
 * clear them from the CRM's unread count (it counts INBOUND messages whose status is not READ).
 */
export async function markAnsweredOnPhone(conversationId: string, at: Date) {
  await db
    .update(messages)
    .set({ status: 'READ' })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.direction, 'INBOUND'),
        ne(messages.status, 'READ'),
        // webhook timestamps are whole seconds
        lte(messages.createdAt, new Date(at.getTime() + 999))
      )
    );
}

export class CoexistenceSync {
  /** Messages the business sent from the WhatsApp Business app. */
  static async handleEchoes(ctx: CoexistenceContext, value: any) {
    for (const msg of Array.isArray(value?.message_echoes) ? value.message_echoes : []) {
      const customerWaId = digits(msg?.to);
      if (!msg?.id || !customerWaId) continue;
      const saved = await storeMessage(ctx, { customerWaId, direction: 'OUTBOUND', status: 'SENT', msg });
      if (!saved) continue;
      await markAnsweredOnPhone(saved.conversationId, saved.at);
      console.log(`📱 Balasan dari aplikasi WA Business ke ${customerWaId} disimpan.`);
    }
  }

  /** Chat history shared from the app after onboarding. */
  static async handleHistory(ctx: CoexistenceContext, value: any) {
    for (const chunk of Array.isArray(value?.history) ? value.history : []) {
      for (const err of Array.isArray(chunk?.errors) ? chunk.errors : []) {
        console.warn(`⚠️ Riwayat chat WA Business tidak dibagikan (${err?.code}): ${err?.title || err?.message || '-'}`);
      }
    }
    let saved = 0;
    for (const item of historyItems(value)) {
      if (await storeMessage(ctx, item)) saved++;
    }
    const progress = value?.history?.[0]?.metadata?.progress;
    console.log(`🗂️ Riwayat chat WA Business: ${saved} pesan diimpor${progress != null ? ` (progres ${progress}%)` : ''}.`);
  }

  /** Contact names from the app's address book. CRM contacts are never deleted from here. */
  static async handleContactSync(ctx: CoexistenceContext, value: any) {
    let count = 0;
    for (const { waId, name } of syncedContacts(value)) {
      const contact = await findOrCreateContact(ctx.orgId, waId, name);
      if (!contact || !name) continue;
      const attrs = { ...((contact.customAttributes as Record<string, unknown>) || {}), waBusinessAppName: name };
      const keepName = contact.name && contact.name !== contact.waId;
      await db
        .update(contacts)
        .set({ customAttributes: attrs, ...(keepName ? {} : { name }), updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));
      count++;
    }
    if (count) console.log(`👥 ${count} kontak dari aplikasi WA Business disinkronkan.`);
  }
}
