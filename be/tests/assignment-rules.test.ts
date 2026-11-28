// Unit tests for chat distribution rules (pure, no database).
import { describe, expect, test } from 'bun:test';
import { DEFAULT_ASSIGNMENT_RULES, isIdleTooLong, MAX_IDLE_REASSIGNS, normalizeAssignmentRules } from '../src/services/assignment-rules';

describe('normalizeAssignmentRules', () => {
  test('missing config keeps the old behaviour', () => {
    expect(normalizeAssignmentRules(null)).toEqual(DEFAULT_ASSIGNMENT_RULES);
    expect(normalizeAssignmentRules('not json')).toEqual(DEFAULT_ASSIGNMENT_RULES);
    expect(DEFAULT_ASSIGNMENT_RULES).toEqual({ mode: 'AUTO', agentCanTakeUnassigned: true, agentCanTransfer: false, idleReassignMinutes: 0 });
  });

  test('reads saved values (object or JSON string)', () => {
    const saved = { mode: 'MANUAL', agentCanTakeUnassigned: false, agentCanTransfer: true, idleReassignMinutes: 15 };
    expect(normalizeAssignmentRules(saved)).toEqual(saved as any);
    expect(normalizeAssignmentRules(JSON.stringify(saved))).toEqual(saved as any);
  });

  test('rejects unknown mode and idle values', () => {
    const r = normalizeAssignmentRules({ mode: 'ROUND_ROBIN', idleReassignMinutes: 7, agentCanTransfer: 'yes' });
    expect(r.mode).toBe('AUTO');
    expect(r.idleReassignMinutes).toBe(0);
    expect(r.agentCanTransfer).toBe(false);
  });
});

describe('isIdleTooLong', () => {
  const now = new Date('2026-11-28T10:00:00Z').getTime();
  const minsAgo = (m: number) => new Date(now - m * 60_000);

  test('off when minutes is 0 or the customer is not waiting', () => {
    expect(isIdleTooLong({ minutes: 0, firstUnansweredAt: minsAgo(99), reassignCount: 0, now })).toBe(false);
    expect(isIdleTooLong({ minutes: 10, firstUnansweredAt: null, reassignCount: 0, now })).toBe(false);
  });

  test('counts from the first unanswered customer message', () => {
    expect(isIdleTooLong({ minutes: 10, firstUnansweredAt: minsAgo(11), reassignCount: 0, now })).toBe(true);
    expect(isIdleTooLong({ minutes: 10, firstUnansweredAt: minsAgo(9), reassignCount: 0, now })).toBe(false);
  });

  test('a new owner gets the full time', () => {
    expect(isIdleTooLong({ minutes: 10, firstUnansweredAt: minsAgo(30), assignedAt: minsAgo(4), reassignCount: 1, now })).toBe(false);
    expect(isIdleTooLong({ minutes: 10, firstUnansweredAt: minsAgo(30), assignedAt: minsAgo(12), reassignCount: 1, now })).toBe(true);
  });

  test('stops after the maximum number of moves', () => {
    expect(isIdleTooLong({ minutes: 10, firstUnansweredAt: minsAgo(60), reassignCount: MAX_IDLE_REASSIGNS, now })).toBe(false);
  });
});
