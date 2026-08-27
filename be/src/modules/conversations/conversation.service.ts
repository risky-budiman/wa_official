// ===========================================
// Conversation Service — Multi-Agent Collaboration
// ===========================================

import { eq, and, desc, sql, inArray } from 'drizzle-orm';
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

export class ConversationService {
  /**
   * List conversations based on user's role:
   * - AGENT: Conversations where agent is PRIMARY assigned OR added as a COLLABORATOR
   * - SUPERVISOR: All conversations in organization / team
   * - ADMINISTRATOR: All conversations in organization
   */
  static async list(user: JwtPayload, query: GetConversationsQuery = {}) {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    let convIdsForAgent: string[] = [];

    if (user.role === 'AGENT') {
      // 1. Get IDs where user is assigned
      const primaryConvs = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, user.orgId),
            eq(conversations.assignedUserId, user.id)
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
        phoneNumber: {
          id: phoneNumbers.id,
          displayPhoneNumber: phoneNumbers.displayPhoneNumber,
          verifiedName: phoneNumbers.verifiedName,
        },
      })
      .from(conversations)
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .innerJoin(phoneNumbers, eq(conversations.phoneNumberId, phoneNumbers.id))
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
        ...item,
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

    // 🔒 RBAC Guard: If AGENT, ensure conversation is assigned to this agent OR agent is in participants
    if (user.role === 'AGENT') {
      const isAssigned = conv.assignedUserId === user.id;
      const isParticipant = participants.some((p) => p.id === user.id);
      if (!isAssigned && !isParticipant) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke percakapan ini.');
      }
    }

    return {
      ...conv,
      participants,
    };
  }

  /**
   * Add a secondary agent / collaborator to conversation
   */
  static async addParticipant(user: JwtPayload, conversationId: string, targetUserId: string) {
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
        organizationId: user.orgId,
        conversationId,
        senderType: 'SYSTEM',
        senderId: user.id,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        body: `👥 ${targetUser.fullName} (${targetUser.role}) ditambahkan ke obrolan oleh ${user.fullName || user.email}`,
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
   * Remove a collaborator agent from conversation
   */
  static async removeParticipant(user: JwtPayload, conversationId: string, targetUserId: string) {
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

    if (user.role === 'AGENT' && body.assignedUserId !== user.id) {
      throw new Error('Agen hanya dapat mengambil tiket untuk diri sendiri atau mengajukan transfer.');
    }

    await db
      .update(conversations)
      .set({
        assignedUserId: body.assignedUserId,
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
    const [nextConv] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, user.orgId),
          sql`(${conversations.status} = 'UNASSIGNED' OR ${conversations.assignedUserId} IS NULL)`
        )
      )
      .orderBy(conversations.createdAt)
      .limit(1);

    if (!nextConv) {
      return { success: false, error: 'Tidak ada pesan dalam antrean saat ini.' };
    }

    await db
      .update(conversations)
      .set({
        assignedUserId: user.id,
        status: 'OPEN',
      })
      .where(eq(conversations.id, nextConv.id));

    // Insert internal log
    await db.insert(messages).values({
      id: nanoid(),
      organizationId: user.orgId,
      conversationId: nextConv.id,
      senderType: 'SYSTEM',
      senderId: user.id,
      direction: 'OUTBOUND',
      messageType: 'TEXT',
      body: `📥 Percakapan ditarik dari antrean oleh ${user.fullName || user.email}`,
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
