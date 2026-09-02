// ===========================================
// Auth Types
// ===========================================

import type { UserRole } from '../../db/schema/users';

/** Request body for POST /auth/register */
export interface RegisterBody {
  email: string;
  password: string;
  fullName: string;
  organizationName?: string;  // If creating a new org
  organizationId?: string;    // If joining existing org
  role?: UserRole;
}

/** Request body for POST /auth/login */
export interface LoginBody {
  email: string;
  password: string;
  organizationId?: string;
  portalType?: 'TENANT' | 'PLATFORM';
}

/** Response from successful auth */
export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    organizationId: string | null;
    organizationName: string;
    isPrimaryAdmin?: boolean;
  };
}
