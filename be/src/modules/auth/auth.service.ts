// ===========================================
// Auth Service — Register, Login, Token
// ===========================================

import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hash, verify } from 'argon2';
import { db } from '../../config/database';
import { users, organizations, superAdmins } from '../../db/schema';
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
      // Create new organization with default TRIAL profile (14 days active trial, 2 agent seats, 500 broadcast quota)
      orgId = nanoid();
      const trialExpiryDate = new Date();
      trialExpiryDate.setDate(trialExpiryDate.getDate() + 14);

      await db.insert(organizations).values({
        id: orgId,
        name: body.organizationName,
        status: 'TRIAL',
        plan: 'TRIAL',
        maxAgents: 2,
        maxBroadcastPerMonth: 500,
        expiresAt: trialExpiryDate,
        ownerName: body.fullName,
        ownerEmail: body.email,
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
   * Login with email + password (isolated by portalType)
   */
  static async login(body: LoginBody) {
    const portalType = body.portalType || 'TENANT';

    // 1. Platform Portal Login -> Query super_admins table
    if (portalType === 'PLATFORM') {
      const [saUser] = await db
        .select({
          id: superAdmins.id,
          email: superAdmins.email,
          fullName: superAdmins.fullName,
          role: superAdmins.role,
          passwordHash: superAdmins.passwordHash,
          status: superAdmins.status,
          isPrimaryAdmin: superAdmins.isPrimaryAdmin,
        })
        .from(superAdmins)
        .where(eq(superAdmins.email, body.email))
        .limit(1);

      if (!saUser) {
        throw new Error('Email atau password salah');
      }

      if (saUser.status !== 'ACTIVE') {
        throw new Error('Akun Anda tidak aktif. Hubungi administrator.');
      }

      let isPasswordValid = false;
      try {
        isPasswordValid = await verify(saUser.passwordHash, body.password);
      } catch (_) {}
      if (!isPasswordValid) {
        try {
          isPasswordValid = await Bun.password.verify(body.password, saUser.passwordHash);
        } catch (_) {}
      }

      if (!isPasswordValid) {
        throw new Error('Email atau password salah');
      }

      return {
        id: saUser.id,
        email: saUser.email,
        fullName: saUser.fullName,
        role: saUser.role,
        organizationId: null,
        organizationName: 'Platform Administrator (Independen)',
        isPrimaryAdmin: Boolean(saUser.isPrimaryAdmin || saUser.email === 'admin@perusahaan.com' || saUser.email === 'riskybudiman1@gmail.com'),
      };
    }

    // 2. Tenant Portal Login -> Query users table
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
        isPrimaryAdmin: users.isPrimaryAdmin,
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

    let isPasswordValid = false;
    try {
      isPasswordValid = await verify(user.passwordHash, body.password);
    } catch (_) {}
    if (!isPasswordValid) {
      try {
        isPasswordValid = await Bun.password.verify(body.password, user.passwordHash);
      } catch (_) {}
    }

    if (!isPasswordValid) {
      throw new Error('Email atau password salah');
    }

    // Get org name
    let orgName = '';
    if (user.organizationId) {
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);
      if (org?.name) orgName = org.name;
    }

    // Update online status for tenant agent
    await db
      .update(users)
      .set({ isOnline: true })
      .where(eq(users.id, user.id));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId || null,
      organizationName: orgName,
      isPrimaryAdmin: false,
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
