// ===========================================
// Bot Engine — pure decision logic (no I/O)
// ===========================================
//
// Decides how the automatic assistant answers one inbound WhatsApp message.
// Used by the real webhook flow (ChatbotService) AND by the settings simulator,
// so what admins test is exactly what customers get.

import type { AiAgentConfig, ChatbotConfig, ChatbotRule } from '../db/schema/organizations';

export type BotDecision =
  | { kind: 'GREETING'; reply: string }
  | { kind: 'RULE'; reply: string; rule: ChatbotRule; handoff: boolean; thenAi: boolean }
  | { kind: 'AI' }
  | { kind: 'STATIC'; reply: string }
  | { kind: 'SILENT'; reason: string };

export const DEFAULT_GREETING_KEYWORDS = ['halo', 'hai', 'hi', 'hello', 'hallo', 'menu', 'mulai', 'start', 'p', 'pagi', 'siang', 'sore', 'malam'];

export const DEFAULT_STATIC_MESSAGE =
  'Halo {{contactName}}, terima kasih telah menghubungi {{businessName}}. Pesan Anda sudah kami terima dan akan segera dibalas oleh tim kami. 🙏';

/** Normalised view of the stored configs (older saved shapes keep working). */
export interface BotSettings {
  /** Master switch: the assistant answers at all */
  enabled: boolean;
  /** Keyword menu on/off (older configs never ran the menu in production → default off) */
  menuEnabled: boolean;
  greetingText: string;
  greetingKeywords: string[];
  greetOnNewConversation: boolean;
  rules: ChatbotRule[];
  /** What happens when no keyword matches */
  fallback: 'AI' | 'STATIC' | 'NONE';
  staticMessage: string;
}

export function normalizeBotSettings(ai?: Partial<AiAgentConfig> | null, chatbot?: Partial<ChatbotConfig> | null): BotSettings {
  const a: any = ai || {};
  const c: any = chatbot || {};
  const fallback: BotSettings['fallback'] =
    a.mode === 'STATIC_MESSAGE' ? 'STATIC' : a.mode === 'NONE' ? 'NONE' : 'AI';
  return {
    enabled: Boolean(a.enabled),
    menuEnabled: c.enabled === true,
    greetingText: typeof c.greetingText === 'string' ? c.greetingText : '',
    greetingKeywords:
      Array.isArray(c.greetingKeywords) && c.greetingKeywords.length > 0
        ? c.greetingKeywords.map((k: any) => String(k)).filter(Boolean)
        : DEFAULT_GREETING_KEYWORDS,
    greetOnNewConversation: c.greetOnNewConversation === true,
    rules: Array.isArray(c.rules)
      ? c.rules.filter((r: any) => r && Array.isArray(r.keywords) && (r.replyText || r.action !== 'REPLY'))
      : [],
    fallback,
    staticMessage: typeof a.staticMessage === 'string' && a.staticMessage.trim() ? a.staticMessage : DEFAULT_STATIC_MESSAGE,
  };
}

/** Lowercase, strip accents/emoji/punctuation, collapse spaces. */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Keyword match that avoids false positives:
 *  - numbers / very short keywords ("1", "cs", "p") must be the whole message
 *  - other keywords match whole words or a whole phrase ("cek resi"), never inside another word
 */
export function keywordMatches(message: string, keyword: string): boolean {
  const msg = normalizeText(message);
  const kw = normalizeText(keyword);
  if (!msg || !kw) return false;
  if (/^\d+$/.test(kw) || kw.length <= 2) return msg === kw;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'u').test(msg);
}

export function fillTemplate(text: string, vars: { contactName?: string; businessName?: string }): string {
  return (text || '')
    .replace(/\{\{\s*contactName\s*\}\}/g, vars.contactName || 'Kak')
    .replace(/\{\{\s*businessName\s*\}\}/g, vars.businessName || 'kami');
}

export interface DecideInput {
  message: string;
  settings: BotSettings;
  contactName?: string;
  businessName?: string;
  /** First customer message of a new conversation */
  isNewConversation?: boolean;
}

export function decideBotReply(input: DecideInput): BotDecision {
  const { message, settings: s } = input;
  const vars = { contactName: input.contactName, businessName: input.businessName };

  if (!s.enabled) return { kind: 'SILENT', reason: 'Asisten otomatis dinonaktifkan' };
  if (!normalizeText(message)) return { kind: 'SILENT', reason: 'Pesan tanpa teks' };

  if (s.menuEnabled) {
    // 1. Keyword rules (first match wins, in the configured order)
    for (const rule of s.rules) {
      if (rule.keywords.some((k) => keywordMatches(message, k))) {
        const reply = fillTemplate(rule.replyText || '', vars).trim();
        return {
          kind: 'RULE',
          reply,
          rule,
          handoff: rule.action === 'HANDOFF_HUMAN',
          thenAi: rule.action === 'HANDOVER_AI' && !reply,
        };
      }
    }

    // 2. Greeting / main menu
    const greeting = fillTemplate(s.greetingText, vars).trim();
    if (greeting) {
      const msg = normalizeText(message);
      const isGreetingWord = s.greetingKeywords.some((k) => normalizeText(k) === msg);
      if (isGreetingWord || (s.greetOnNewConversation && input.isNewConversation)) {
        return { kind: 'GREETING', reply: greeting };
      }
    }
  }

  // 3. Nothing matched
  if (s.fallback === 'AI') return { kind: 'AI' };
  if (s.fallback === 'STATIC') return { kind: 'STATIC', reply: fillTemplate(s.staticMessage, vars) };
  return { kind: 'SILENT', reason: 'Tidak ada menu yang cocok — diteruskan ke agen' };
}
