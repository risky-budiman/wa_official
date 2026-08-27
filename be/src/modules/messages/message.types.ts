// ===========================================
// Message Types & DTOs
// ===========================================

export interface SendMessageBody {
  conversationId: string;
  messageType?: 'text' | 'image' | 'document' | 'audio' | 'template';
  body: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  templateName?: string;
  templateComponents?: any[];
}

export interface InternalNoteBody {
  conversationId: string;
  body: string;
}

export interface GetMessagesQuery {
  limit?: number;
  offset?: number;
}
