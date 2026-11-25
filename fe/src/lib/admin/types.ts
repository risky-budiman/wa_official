// Types for the platform administrator portal (extracted from routes/administrator/+page.svelte)

export interface TenantItem {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL" | "EXPIRED";
  plan: string;
  maxAgents: number;
  maxBroadcastPerMonth: number;
  expiresAt: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  notes: string | null;
  wabaId: string | null;
  appId: string | null;
  hasAccessToken: boolean;
  maskedToken?: string | null;
  createdAt: string;
  updatedAt: string;
  users?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
    isOnline?: boolean;
  }>;
  phoneNumbers?: Array<{
    id: string;
    phoneNumberId?: string;
    phoneNumber?: string;
    displayPhoneNumber?: string;
    displayName?: string;
    qualityRating?: string;
    verifiedName?: string;
    codeVerificationStatus?: string;
  }>;
  stats?: {
    userCount: number;
    agentCount: number;
    conversationCount: number;
    contactCount: number;
  };
}


export interface PlatformStaffItem {
  id: string;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "CO_SUPER_ADMIN" | "ADMIN_FINANCE" | "ADMIN_SUPPORT";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  isOnline?: boolean;
  isPrimaryAdmin?: boolean;
  createdAt: string;
  updatedAt?: string;
}


export interface PlatformOverview {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  suspendedOrganizations: number;
  expiredOrganizations: number;
  totalUsers: number;
  totalAgents: number;
  totalConversations: number;
  totalMessages: number;
  totalContacts: number;
  expiringSoonCount: number;
  expiringSoonTenants: Array<{
    id: string;
    name: string;
    plan: string;
    expiresAt: string;
    ownerPhone?: string;
    ownerEmail?: string;
  }>;
}


export interface SaaSPlan {
  id: string;
  name: string;
  code: string; // Bebas / custom, e.g. "STARTER", "PROMO14", "UMKM_GOLD"
  price: number;
  period: string;
  durationType?: "PERMANENT" | "MONTHLY" | "DAYS";
  durationDays?: number;
  maxAgents: number;
  maxBroadcastPerMonth: number;
  description: string;
  features: string[];
  isPopular?: boolean;
  isPublic?: boolean; // true: Tampil di katalog tenant, false: Khusus Super Admin
  isActive: boolean;
}


export interface MidtransSetting {
  isEnabled: boolean;
  environment: "sandbox" | "production";
  serverKey: string;
  clientKey: string;
  merchantId?: string;
}

// Active Tab

export interface AdminTransactionItem {
  id: string;
  orderNumber: string;
  organizationId: string;
  organizationName: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  planCode: string;
  planName: string;
  amount: number;
  durationDays: number;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
  paymentMethod: string | null;
  snapToken: string | null;
  snapRedirectUrl: string | null;
  paidAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}


export interface TransactionSummary {
  totalRevenue: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  totalOrders: number;
}


export interface GitStatusData {
  currentBranch: string;
  commitHash: string;
  shortHash: string;
  commitMessage: string;
  author: string;
  authorEmail: string;
  commitDate: string;
  remoteUrl: string;
  hasLocalChanges: boolean;
}

