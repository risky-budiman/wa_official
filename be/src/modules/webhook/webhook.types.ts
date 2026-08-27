// ===========================================
// Meta WhatsApp Webhook Payload Types
// ===========================================

export interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: 'whatsapp';
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: 'text' | 'image' | 'document' | 'audio' | 'interactive' | 'location' | 'button';
        text?: {
          body: string;
        };
        image?: {
          id: string;
          mime_type: string;
          sha256: string;
          caption?: string;
        };
        interactive?: any;
      }>;
      statuses?: Array<{
        id: string;
        status: 'delivered' | 'read' | 'failed' | 'sent';
        timestamp: string;
        recipient_id: string;
        errors?: any[];
      }>;
    };
    field: string;
  }>;
}

export interface MetaWebhookBody {
  object: string;
  entry: MetaWebhookEntry[];
}
