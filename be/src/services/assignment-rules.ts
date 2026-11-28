// ===========================================
// Chat distribution rules (pure) — like Qontak's agent allocation settings
// ===========================================

import type { AssignmentConfig } from '../db/schema/organizations';

export type AssignmentRules = Required<AssignmentConfig>;

/** Defaults keep the behaviour from before these settings existed. */
export const DEFAULT_ASSIGNMENT_RULES: AssignmentRules = {
  mode: 'AUTO',
  agentCanTakeUnassigned: true,
  agentCanTransfer: false,
  idleReassignMinutes: 0,
};

export const IDLE_REASSIGN_OPTIONS = [0, 5, 10, 15, 30, 60, 120] as const;

/** After this many idle moves without anyone replying, the chat stays where it is (Qontak: 3 attempts). */
export const MAX_IDLE_REASSIGNS = 3;

export function normalizeAssignmentRules(raw: unknown): AssignmentRules {
  let cfg: AssignmentConfig = {};
  if (typeof raw === 'string') {
    try {
      cfg = JSON.parse(raw) || {};
    } catch {
      cfg = {};
    }
  } else if (raw && typeof raw === 'object') {
    cfg = raw as AssignmentConfig;
  }
  const idle = Number(cfg.idleReassignMinutes);
  return {
    mode: cfg.mode === 'MANUAL' ? 'MANUAL' : 'AUTO',
    agentCanTakeUnassigned:
      typeof cfg.agentCanTakeUnassigned === 'boolean' ? cfg.agentCanTakeUnassigned : DEFAULT_ASSIGNMENT_RULES.agentCanTakeUnassigned,
    agentCanTransfer: typeof cfg.agentCanTransfer === 'boolean' ? cfg.agentCanTransfer : DEFAULT_ASSIGNMENT_RULES.agentCanTransfer,
    idleReassignMinutes: (IDLE_REASSIGN_OPTIONS as readonly number[]).includes(idle) ? idle : 0,
  };
}

/**
 * Is the customer kept waiting past the idle limit? The clock starts at the later of: the customer's
 * first unanswered message, and the moment the current owner got the chat (a new owner gets full time).
 */
export function isIdleTooLong(p: {
  minutes: number;
  firstUnansweredAt: Date | string | null;
  assignedAt?: Date | string | null;
  reassignCount: number;
  now?: number;
}): boolean {
  if (!p.minutes || p.minutes <= 0 || !p.firstUnansweredAt) return false;
  if (p.reassignCount >= MAX_IDLE_REASSIGNS) return false;
  const waiting = new Date(p.firstUnansweredAt).getTime();
  const assigned = p.assignedAt ? new Date(p.assignedAt).getTime() : 0;
  const start = Math.max(waiting, assigned);
  if (!Number.isFinite(start) || start <= 0) return false;
  return (p.now ?? Date.now()) - start >= p.minutes * 60 * 1000;
}
