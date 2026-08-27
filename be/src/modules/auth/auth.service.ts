// ===========================================
// Auth Service — Register, Login, Token
// ===========================================

import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hash, verify } from 'argon2';
import { db } from '../../config/database';
import { users, organizations } from '../../db/schema';
import type { RegisterBody, LoginBody } from './auth.types';
import type { UserRole } from '../../db/schema/users';

export class AuthService {
  /**
   * Register a new user (optionally creates a new organization)
   */
  static async register(body: RegisterBody) {
    // Check if org exists or create new one
    let orgId = body.organizationId;
    let orgName = '';

    if (!orgId && body.organizationName) {
      // Create new organization
      orgId = nanoid();
      await db.insert(organizations).values({
        id: orgId,
        name: body.organizationName,
      });
      orgName = body.organizationName;
    } else if (orgId) {
      // Verify org exists
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (!org) {
        throw new Error('Organisasi tidak ditemukan');
      }
      orgName = org.name;
    } else {
      throw new Error('organizationName atau organizationId wajib diisi');
    }

    // Check if email already exists in this org
    const [existingUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.organizationId, orgId),
          eq(users.email, body.email)
        )
      )
      .limit(1);

    if (existingUser) {
      throw new Error('Email sudah terdaftar di organisasi ini');
    }

    // Hash password with Argon2
    const passwordHash = await hash(body.password);

    // Determine role: first user in org becomes ADMINISTRATOR
    const [userCount] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, orgId))
      .limit(1);

    const role: UserRole = !userCount ? 'ADMINISTRATOR' : (body.role || 'AGENT');

    // Create user
    const userId = nanoid();
    await db.insert(users).values({
      id: userId,
      organizationId: orgId,
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      role,
    });

    return {
      id: userId,
      email: body.email,
      fullName: body.fullName,
      role,
      organizationId: orgId,
      organizationName: orgName,
    };
  }

  /**
   * Login with email + password
   */
  static async login(body: LoginBody) {
    // Find user by email (if orgId provided, scope to that org)
    const conditions = [eq(users.email, body.email)];
    if (body.organizationId) {
      conditions.push(eq(users.organizationId, body.organizationId));
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        passwordHash: users.passwordHash,
        organizationId: users.organizationId,
        status: users.status,
      })
      .from(users)
      .where(and(...conditions))
      .limit(1);

    if (!user) {
      throw new Error('Email atau password salah');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Akun Anda tidak aktif. Hubungi administrator.');
    }

    // Verify password
    const isPasswordValid = await verify(user.passwordHash, body.password);
    if (!isPasswordValid) {
      throw new Error('Email atau password salah');
    }

    // Get org name
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    // Update online status
    await db
      .update(users)
      .set({ isOnline: true })
      .where(eq(users.id, user.id));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: org?.name || '',
    };
  }

  /**
   * Lookup organization by ID (for join-org registration flow)
   */
  static async lookupOrganization(orgId: string) {
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return null;

    // Count members for display
    const [memberCount] = await db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.organizationId, orgId))
      .limit(1);

    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      memberCount: memberCount ? 1 : 0, // simplified count
    };
  }
}
