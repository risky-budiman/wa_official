// ===========================================
// Barrel Export — All Database Schemas
// ===========================================

export { organizations } from './organizations';
export type { Organization, NewOrganization } from './organizations';

export { teams } from './teams';
export type { Team, NewTeam } from './teams';

export { users, userRoleEnum, userStatusEnum } from './users';
export type { User, NewUser, UserRole, UserStatus } from './users';

export { phoneNumbers } from './phone-numbers';
export type { PhoneNumber, NewPhoneNumber } from './phone-numbers';

export { contacts } from './contacts';
export type { Contact, NewContact } from './contacts';

export { conversations, conversationStatusEnum } from './conversations';
export type { Conversation, NewConversation, ConversationStatus } from './conversations';

export { messages, messageDirectionEnum, messageSenderTypeEnum, messageStatusEnum } from './messages';
export type { Message, NewMessage, MessageDirection, MessageSenderType, MessageStatus } from './messages';

export { messageTemplates, templateCategoryEnum, templateStatusEnum } from './message-templates';
export type { MessageTemplate, NewMessageTemplate, TemplateCategory, TemplateStatus } from './message-templates';

export { broadcastCampaigns, campaignStatusEnum } from './broadcast-campaigns';
export type { BroadcastCampaign, NewBroadcastCampaign, CampaignStatus } from './broadcast-campaigns';

export { activityLogs } from './activity-logs';
export type { ActivityLog, NewActivityLog } from './activity-logs';

export { conversationParticipants, participantRoleEnum } from './conversation-participants';
export type { ConversationParticipant, NewConversationParticipant } from './conversation-participants';

