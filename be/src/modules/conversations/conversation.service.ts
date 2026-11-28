// ===========================================
// Conversation Service — Multi-Agent Collaboration
// ===========================================

import { eq, and, desc, sql, inArray, or, ne, isNull, gt } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  conversations,
  contacts,
  phoneNumbers,
  users,
  messages,
  activityLogs,
  conversationParticipants,
} from '../../db/schema';
import type { JwtPayload } from '../../middleware/auth';
import type { GetConversationsQuery, AssignConversationBody } from './conversation.types';
import type { ConversationStatus } from '../../db/schema/conversations';
import { nanoid } from 'nanoid';
import { organizations } from '../../db/schema';
import { normalizeAssignmentRules, type AssignmentRules } from '../../services/assignment-rules';

/**
 * The customer's 24-hour WhatsApp window is still open. Without a stored expiry (e.g. chats synced
 * from the WhatsApp Business app) fall back to last activity + 24h, like the inbox does.
 * Used by the idle rule: an expired chat only allows a template, so moving it to another agent does not help.
 * (Expired chats that are not resolved DO stay in the queue.)
 */
export function windowStillOpen(now = new Date()) {
  return or(
    gt(conversations.windowExpiresAt, now),
    and(isNull(conversations.windowExpiresAt), gt(conversations.lastMessageAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))
  )!;
}

export class ConversationService {
  /**
   * List conversations based on user's role:
   * - AGENT: Conversations where agent is PRIMARY assigned OR added as a COLLABORATOR
   * - SUPERVISOR: All conversations in organization / team
   * - ADMINISTRATOR: All conversations in organization
   */
  /** The organization's chat distribution settings (Pengaturan → Distribusi Chat). */
  static async rules(orgId: string): Promise<AssignmentRules> {
    const [org] = await db
      .select({ assignmentConfig: organizations.assignmentConfig })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return normalizeAssignmentRules(org?.assignmentConfig);
  }

  static async list(user: JwtPayload, query: GetConversationsQuery = {}) {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    let convIdsForAgent: string[] = [];

    if (user.role === 'AGENT') {
      // 1. Get IDs where user is assigned or is unassigned
      const primaryConvs = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, user.orgId),
            or(
              eq(conversations.assignedUserId, user.id),
              eq(conversations.status, 'UNASSIGNED'),
              // handed off by the chatbot, waiting for any agent
              and(eq(conversations.status, 'PENDING'), isNull(conversations.assignedUserId))
            )
          )
        );

      // 2. Get IDs where user is a participant/collaborator
      const collabConvs = await db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, user.id));

      const setIds = new Set<string>();
      primaryConvs.forEach((p) => setIds.add(p.id));
      collabConvs.forEach((c) => setIds.add(c.conversationId));
      convIdsForAgent = Array.from(setIds);

      if (convIdsForAgent.length === 0) {
        return { items: [], count: 0, limit, offset };
      }
    }

    const conditions = [eq(conversations.organizationId, user.orgId)];

    if (user.role === 'AGENT') {
      conditions.push(inArray(conversations.id, convIdsForAgent));
    }

    if (query.status) {
      conditions.push(eq(conversations.status, query.status));
    }

    const rawItems = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        windowExpiresAt: conversations.windowExpiresAt,
        lastMessagePreview: conversations.lastMessagePreview,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        contactId: conversations.contactId,
        contactName: contacts.name,
        contactWaId: contacts.waId,
        contactEmail: contacts.email,
        contactCustomAttributes: contacts.customAttributes,
        assignedUserId: users.id,
        assignedFullName: users.fullName,
        assignedEmail: users.email,
        assignedRole: users.role,
        phoneId: phoneNumbers.id,
        displayPhoneNumber: phoneNumbers.displayPhoneNumber,
        verifiedName: phoneNumbers.verifiedName,
        // Who spoke last (customer vs. our side) — drives notifications and the unread state
        lastSenderType: sql<string | null>`(
          SELECT m.sender_type FROM messages m
          WHERE m.conversation_id = ${conversations.id} AND COALESCE(m.is_internal_note, 0) = 0
          ORDER BY m.created_at DESC LIMIT 1
        )`,
        unreadCount: sql<number>`(
          SELECT COUNT(*) FROM messages m
          WHERE m.conversation_id = ${conversations.id} AND m.direction = 'INBOUND' AND m.status <> 'READ'
        )`,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(phoneNumbers, eq(conversations.phoneNumberId, phoneNumbers.id))
      .leftJoin(users, eq(conversations.assignedUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    // Fetch all participants for these conversations
    const convIds = rawItems.map((i) => i.id);
    let allParticipants: Array<{
      conversationId: string;
      id: string;
      userId: string;
      fullName: string;
      email: string;
      role: string;
      roleInChat: string;
    }> = [];

    if (convIds.length > 0) {
      allParticipants = await db
        .select({
          conversationId: conversationParticipants.conversationId,
          id: conversationParticipants.id,
          userId: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          roleInChat: conversationParticipants.roleInChat,
        })
        .from(conversationParticipants)
        .innerJoin(users, eq(conversationParticipants.userId, users.id))
        .where(inArray(conversationParticipants.conversationId, convIds));
    }

    const items = rawItems.map((item) => {
      const participants = allParticipants
        .filter((p) => p.conversationId === item.id)
        .map((p) => ({
          id: p.userId,
          fullName: p.fullName,
          email: p.email,
          role: p.role,
          roleInChat: p.roleInChat,
        }));

      return {
        id: item.id,
        status: item.status,
        windowExpiresAt: item.windowExpiresAt,
        lastMessagePreview: item.lastMessagePreview,
        lastMessageAt: item.lastMessageAt,
        lastMessageFromCustomer: item.lastSenderType === 'CONTACT',
        unreadCount: Number(item.unreadCount || 0),
        createdAt: item.createdAt,
        contact: {
          id: item.contactId,
          waId: item.contactWaId || item.contactId || '628000000000',
          name: item.contactName || item.contactWaId || 'Pelanggan WhatsApp',
          email: item.contactEmail || undefined,
          customAttributes: item.contactCustomAttributes || {},
        },
        assignedUser: item.assignedUserId
          ? {
              id: item.assignedUserId,
              fullName: item.assignedFullName || '',
              email: item.assignedEmail || '',
              role: item.assignedRole || '',
            }
          : null,
        phoneNumber: item.phoneId
          ? {
              id: item.phoneId,
              displayPhoneNumber: item.displayPhoneNumber || '',
              verifiedName: item.verifiedName || '',
            }
          : null,
        participants,
      };
    });

    return {
      items,
      count: items.length,
      limit,
      offset,
    };
  }

  /**
   * Get single conversation with detail verification
   */
  static async getById(user: JwtPayload, conversationId: string) {
    const [conv] = await db
      .select({
        id: conversations.id,
        organizationId: conversations.organizationId,
        phoneNumberId: conversations.phoneNumberId,
        contactId: conversations.contactId,
        assignedUserId: conversations.assignedUserId,
        teamId: conversations.teamId,
        status: conversations.status,
        windowExpiresAt: conversations.windowExpiresAt,
        lastMessagePreview: conversations.lastMessagePreview,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        contact: {
          id: contacts.id,
          waId: contacts.waId,
          name: contacts.name,
          email: contacts.email,
          customAttributes: contacts.customAttributes,
        },
        assignedUser: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
        },
      })
      .from(conversations)
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.assignedUserId, users.id))
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.organizationId, user.orgId)
        )
      )
      .limit(1);

    if (!conv) {
      throw new Error('Percakapan tidak ditemukan');
    }

    // Get participants
    const participants = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        roleInChat: conversationParticipants.roleInChat,
      })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .where(eq(conversationParticipants.conversationId, conversationId));

    // 🔒 RBAC Guard: If AGENT, ensure conversation is assigned to this agent, agent is participant, OR ticket is UNASSIGNED (for claiming)
    if (user.role === 'AGENT') {
      const isAssigned = conv.assignedUserId === user.id;
      const isParticipant = participants.some((p) => p.id === user.id);
      const isUnassigned = conv.status === 'UNASSIGNED' || !conv.assignedUserId;
      if (!isAssigned && !isParticipant && !isUnassigned) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke percakapan ini.');
      }
    }

    return {
      ...conv,
      participants,
    };
  }

  /**
   * The contact's other conversations (earlier sessions / tickets), newest first. Whoever may open
   * the current conversation may also read the customer's earlier sessions, like the contact history
   * in other CRMs — an agent needs that context to continue the conversation.
   */
  static async history(user: JwtPayload, conversationId: string) {
    const current = await this.getById(user, conversationId);
    const items = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        createdAt: conversations.createdAt,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: conversations.lastMessagePreview,
        assignedUserName: users.fullName,
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM messages m
          WHERE m.conversation_id = ${conversations.id} AND COALESCE(m.is_internal_note, 0) = 0
        )`,
      })
      .from(conversations)
      .leftJoin(users, eq(conversations.assignedUserId, users.id))
      .where(
        and(
          eq(conversations.organizationId, user.orgId),
          eq(conversations.contactId, current.contactId),
          ne(conversations.id, conversationId)
        )
      )
      .orderBy(desc(conversations.createdAt))
      .limit(100);
    return items.map((i) => ({ ...i, messageCount: Number(i.messageCount || 0) }));
  }

  /** One earlier session of the same contact, for reading from the current conversation. */
  static async historySession(user: JwtPayload, conversationId: string, sessionId: string) {
    const current = await this.getById(user, conversationId);
    const [session] = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        createdAt: conversations.createdAt,
        lastMessageAt: conversations.lastMessageAt,
        assignedUserName: users.fullName,
      })
      .from(conversations)
      .leftJoin(users, eq(conversations.assignedUserId, users.id))
      .where(
        and(
          eq(conversations.id, sessionId),
          eq(conversations.organizationId, user.orgId),
          eq(conversations.contactId, current.contactId)
        )
      )
      .limit(1);
    if (!session) throw new Error('Sesi percakapan tidak ditemukan untuk kontak ini.');
    return session;
  }

  /**
   * Add a secondary agent / collaborator to conversation
   */
  static async addParticipant(user: JwtPayload, conversationId: string, targetUserId: string) {
    if (user.role === 'AGENT') {
      throw new Error('Hanya Administrator atau Supervisor yang dapat menambah anggota ke percakapan.');
    }
    const conv = await this.getById(user, conversationId);

    // Check if target user exists in same organization
    const [targetUser] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.id, targetUserId), eq(users.organizationId, user.orgId)))
      .limit(1);

    if (!targetUser) {
      throw new Error('Agen tujuan tidak ditemukan dalam organisasi Anda');
    }

    // Check if already in participants
    const [existing] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, targetUserId)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(conversationParticipants).values({
        id: nanoid(),
        conversationId,
        userId: targetUserId,
        roleInChat: 'COLLABORATOR',
        addedByUserId: user.id,
      });

      // Insert system notification message in conversation
      await db.insert(messages).values({
        id: nanoid(),
        conversationId,
        senderType: 'SYSTEM',
        senderId: user.id,
        direction: 'OUTBOUND',
        messageType: 'text',
        body: `👥 ${targetUser.fullName} (${targetUser.role}) ditambahkan ke obrolan oleh ${user.email}`,
        isInternalNote: true,
        status: 'SENT',
      });

      // Audit log
      await db.insert(activityLogs).values({
        id: nanoid(),
        organizationId: user.orgId,
        userId: user.id,
        action: 'ASSIGN_CHAT',
        details: {
          conversationId,
          actionType: 'ADD_COLLABORATOR',
          addedUser: targetUser.email,
          addedBy: user.email,
        },
      });
    }

    return { success: true, user: targetUser };
  }

  /**
   * Called after a team member replies to the customer: the first person to reply becomes the owner
   * (no manual "Ambil" needed); anyone else who replies later is added as a collaborator.
   * The ownership update is conditional, so two people replying at the same moment cannot both win.
   */
  static async claimOnReply(
    user: JwtPayload,
    conv: { id: string; assignedUserId: string | null; participants: { id: string }[] }
  ): Promise<{
    assignedUser?: { id: string; fullName: string; email: string; role: string };
    addedParticipant?: { id: string; fullName: string; email: string; role: string; roleInChat: 'COLLABORATOR' };
    note?: { id: string; body: string };
  }> {
    if (!['AGENT', 'SUPERVISOR', 'ADMINISTRATOR'].includes(user.role)) return {};
    if (conv.assignedUserId === user.id || conv.participants.some((p) => p.id === user.id)) return {};

    const [me] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.id, user.id), eq(users.organizationId, user.orgId)))
      .limit(1);
    if (!me) return {};

    const addNote = async (body: string) => {
      const id = nanoid();
      await db.insert(messages).values({
        id,
        conversationId: conv.id,
        senderType: 'SYSTEM',
        senderId: user.id,
        direction: 'OUTBOUND',
        messageType: 'text',
        body,
        isInternalNote: true,
        status: 'SENT',
      });
      return { id, body };
    };

    if (!conv.assignedUserId) {
      const res: any = await db
        .update(conversations)
        .set({ assignedUserId: user.id, assignedAt: new Date(), idleReassignCount: 0 })
        .where(and(eq(conversations.id, conv.id), isNull(conversations.assignedUserId)));
      if (Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0) > 0) {
        const note = await addNote(`📥 Percakapan otomatis dipegang ${me.fullName} karena membalas pelanggan`);
        await db.insert(activityLogs).values({
          id: nanoid(),
          organizationId: user.orgId,
          userId: user.id,
          action: 'ASSIGN_CHAT',
          details: { conversationId: conv.id, actionType: 'AUTO_ASSIGN_ON_REPLY', assignedTo: user.email },
        });
        return { assignedUser: me, note };
      }
      // Someone else claimed it a moment earlier → fall through and join as collaborator
    }

    const [existing] = await db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, conv.id), eq(conversationParticipants.userId, user.id)))
      .limit(1);
    if (existing) return {};

    await db.insert(conversationParticipants).values({
      id: nanoid(),
      conversationId: conv.id,
      userId: user.id,
      roleInChat: 'COLLABORATOR',
      addedByUserId: user.id,
    });
    const note = await addNote(`👥 ${me.fullName} otomatis ditambahkan ke obrolan karena ikut membalas`);
    await db.insert(activityLogs).values({
      id: nanoid(),
      organizationId: user.orgId,
      userId: user.id,
      action: 'ASSIGN_CHAT',
      details: { conversationId: conv.id, actionType: 'AUTO_COLLABORATOR_ON_REPLY', addedUser: user.email },
    });
    return { addedParticipant: { ...me, roleInChat: 'COLLABORATOR' }, note };
  }

  /**
   * Remove a collaborator agent from conversation
   */
  static async removeParticipant(user: JwtPayload, conversationId: string, targetUserId: string) {
    if (user.role === 'AGENT') {
      throw new Error('Hanya Administrator atau Supervisor yang dapat mengeluarkan anggota dari percakapan.');
    }
    await this.getById(user, conversationId);

    await db
      .delete(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, targetUserId)
        )
      );

    return { success: true };
  }

  /**
   * Assign / Re-assign Primary Agent
   */
  static async assign(user: JwtPayload, conversationId: string, body: AssignConversationBody) {
    const conv = await this.getById(user, conversationId);

    if (user.role === 'AGENT') {
      const rules = await this.rules(user.orgId);
      if (body.assignedUserId === user.id) {
        // Taking a chat: only from the queue (or it is already yours), and only when allowed
        if (conv.assignedUserId && conv.assignedUserId !== user.id) {
          throw new Error('Percakapan ini sudah dipegang agen lain.');
        }
        if (!conv.assignedUserId && !rules.agentCanTakeUnassigned) {
          throw new Error('Agen tidak diizinkan mengambil chat sendiri. Minta supervisor untuk menugaskan.');
        }
      } else {
        // Handing over: only your own chat, and only when the organization allows it
        if (!rules.agentCanTransfer) {
          throw new Error('Agen tidak diizinkan memindahkan chat ke agen lain. Hubungi supervisor.');
        }
        if (conv.assignedUserId !== user.id) {
          throw new Error('Anda hanya dapat memindahkan chat yang Anda pegang.');
        }
      }
    }

    // The new owner must be an active member of THIS organization
    const [target] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(eq(users.id, body.assignedUserId), eq(users.organizationId, user.orgId)))
      .limit(1);
    if (!target) {
      throw new Error('Agen tujuan tidak ditemukan dalam organisasi Anda');
    }
    if (target.status && target.status !== 'ACTIVE') {
      throw new Error('Agen tujuan sedang tidak aktif');
    }

    await db
      .update(conversations)
      .set({
        assignedUserId: body.assignedUserId,
        ...(body.assignedUserId !== conv.assignedUserId ? { assignedAt: new Date(), idleReassignCount: 0 } : {}),
        teamId: body.teamId ?? conv.teamId,
        status: 'OPEN',
      })
      .where(eq(conversations.id, conversationId));

    await db.insert(activityLogs).values({
      id: nanoid(),
      organizationId: user.orgId,
      userId: user.id,
      action: 'ASSIGN_CHAT',
      details: {
        conversationId,
        assignedTo: body.assignedUserId,
        assignedBy: user.email,
      },
    });

    return { success: true, message: 'Percakapan berhasil di-assign' };
  }

  /**
   * Update conversation status (e.g. RESOLVE ticket)
   */
  static async updateStatus(user: JwtPayload, conversationId: string, status: ConversationStatus) {
    await this.getById(user, conversationId);

    await db
      .update(conversations)
      .set({ status })
      .where(eq(conversations.id, conversationId));

    if (status === 'RESOLVED') {
      // Mark the customer's messages as read; never touch the delivery status of OUR messages
      // (a FAILED outbound message must stay FAILED)
      await db
        .update(messages)
        .set({ status: 'READ' })
        .where(and(eq(messages.conversationId, conversationId), eq(messages.direction, 'INBOUND')));
    }

    await db.insert(activityLogs).values({
      id: nanoid(),
      organizationId: user.orgId,
      userId: user.id,
      action: status === 'RESOLVED' ? 'RESOLVE_CHAT' : 'UPDATE_STATUS',
      details: {
        conversationId,
        status,
        updatedBy: user.email,
      },
    });

    return { success: true, status };
  }

  /**
   * Get real-time queue count of unassigned conversations in organization
   */
  static async getQueueStats(user: JwtPayload) {
    const [unassignedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, user.orgId),
          ne(conversations.status, 'RESOLVED'),
          sql`(${conversations.status} = 'UNASSIGNED' OR ${conversations.assignedUserId} IS NULL)`
        )
      );

    const [myActiveResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, user.orgId),
          eq(conversations.assignedUserId, user.id),
          sql`${conversations.status} IN ('OPEN', 'PENDING')`
        )
      );

    return {
      unassignedCount: Number(unassignedResult?.count || 0),
      myActiveCount: Number(myActiveResult?.count || 0),
    };
  }

  /**
   * Claim next conversation from unassigned queue (FIFO: oldest unassigned first)
   */
  static async claimNext(user: JwtPayload) {
    if (user.role === 'AGENT' && !(await this.rules(user.orgId)).agentCanTakeUnassigned) {
      return { success: false, error: 'Agen tidak diizinkan mengambil chat sendiri. Minta supervisor untuk menugaskan.' };
    }
    const [nextConv] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, user.orgId),
          ne(conversations.status, 'RESOLVED'),
          sql`(${conversations.status} = 'UNASSIGNED' OR ${conversations.assignedUserId} IS NULL)`
        )
      )
      // Chats that can still be answered normally first (oldest first), expired ones after
      .orderBy(sql`CASE WHEN ${windowStillOpen()} THEN 0 ELSE 1 END`, conversations.createdAt)
      .limit(1);

    if (!nextConv) {
      return { success: false, error: 'Tidak ada pesan dalam antrean saat ini.' };
    }

    await db
      .update(conversations)
      .set({
        assignedUserId: user.id,
        assignedAt: new Date(),
        idleReassignCount: 0,
        status: 'OPEN',
      })
      .where(eq(conversations.id, nextConv.id));

    // Insert internal log
    await db.insert(messages).values({
      id: nanoid(),
      conversationId: nextConv.id,
      senderType: 'SYSTEM',
      senderId: user.id,
      direction: 'OUTBOUND',
      messageType: 'text',
      body: `📥 Percakapan ditarik dari antrean oleh ${user.email}`,
      isInternalNote: true,
      status: 'SENT',
    });

    await db.insert(activityLogs).values({
      id: nanoid(),
      organizationId: user.orgId,
      userId: user.id,
      action: 'ASSIGN_CHAT',
      details: {
        conversationId: nextConv.id,
        claimedBy: user.email,
        type: 'CLAIM_FROM_QUEUE',
      },
    });

    return { success: true, conversationId: nextConv.id };
  }
}
