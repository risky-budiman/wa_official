// ===========================================
// Conversation Types & DTOs
// ===========================================

import type { ConversationStatus } from '../../db/schema/conversations';

export interface GetConversationsQuery {
  status?: ConversationStatus;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AssignConversationBody {
  assignedUserId: string;
  teamId?: string;
}

export interface UpdateConversationStatusBody {
  status: ConversationStatus;
}
