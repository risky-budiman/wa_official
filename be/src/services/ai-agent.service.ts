// ===========================================
// AI Agent Service — Out-of-Hours Auto-Responder
// ===========================================

import type { OperatingHoursConfig } from '../db/schema/organizations';
import { geminiMemory, rankGeminiModels, isRetiredModelError } from './gemini-models';

/** Default Claude model for the auto-responder (current Opus). */
export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

/**
 * Tenants can point "Custom LLM" at any URL and the server will call it. Block loopback, link-local
 * and private ranges so a tenant cannot reach services inside our network (SSRF).
 * Self-hosted single-tenant installs can opt out with AI_ALLOW_PRIVATE_BASE_URL=true.
 */
export function assertSafeLlmBaseUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Alamat Custom LLM tidak valid. Contoh: https://llm.domain-anda.com');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Alamat Custom LLM harus diawali http:// atau https://');
  }
  if (process.env.AI_ALLOW_PRIVATE_BASE_URL === 'true') return;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isPrivate =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host) ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe80:/.test(host);
  if (isPrivate) {
    throw new Error('Alamat Custom LLM tidak boleh mengarah ke jaringan lokal/privat server. Gunakan alamat publik.');
  }
}

export class AiAgentService {
  /**
   * Determine if current time in target timezone is outside configured operating hours
   */
  static isOutOfOperatingHours(config?: OperatingHoursConfig | null): boolean {
    if (!config || !config.enabled) {
      return false; // Operating hours disabled -> always treated as open
    }

    try {
      const tz = config.timezone || 'Asia/Jakarta';
      const now = new Date();

      // Format current day and time in organization timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        weekday: 'short', // 'Mon', 'Tue', ...
        hour: '2-digit',
        minute: '2-digit',
      });

      const parts = formatter.formatToParts(now);
      const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
      const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
      const minuteStr = parts.find((p) => p.type === 'minute')?.value || '00';

      const dayMap: Record<string, number> = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 7,
      };

      const currentDay = dayMap[weekdayStr] || 1;
      const configuredDays = config.days || [1, 2, 3, 4, 5];

      // 1. If today is not in active working days -> Out of hours
      if (!configuredDays.includes(currentDay)) {
        return true;
      }

      // 2. Parse HH:MM
      const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

      const [startH, startM] = (config.startTime || '08:00').split(':').map(Number);
      const [endH, endM] = (config.endTime || '17:00').split(':').map(Number);

      const startMinutes = (startH || 0) * 60 + (startM || 0);
      const endMinutes = (endH || 0) * 60 + (endM || 0);

      // Check if current time is outside [startTime, endTime]
      if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
        return true;
      }

      return false;
    } catch (err) {
      console.warn('Operating hours calculation warning:', err);
      return false;
    }
  }

  /**
   * Dynamically fetch list of supported Gemini models for this specific API key
   */
  static async getAvailableGeminiModels(apiKey: string): Promise<string[]> {
    // The list rarely changes — ask Google at most once an hour per key
    const cached = geminiMemory.cachedList(apiKey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.models)) {
        const supported = data.models
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));
        if (supported.length > 0) {
          console.log(`🤖 Discovered ${supported.length} available Gemini models; preferred order:`, rankGeminiModels(supported).slice(0, 4).join(', '));
          geminiMemory.storeList(apiKey, supported);
          return supported;
        }
      }
    } catch (err: any) {
      console.warn('Could not query dynamic Gemini models:', err.message);
    }
    return ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-8b', 'gemini-pro'];
  }

  /**
   * Generate AI response using Google Gemini API
   */
  static async generateGeminiResponse(params: {
    systemPrompt: string;
    userMessage: string;
    conversationHistory?: { role: 'user' | 'model'; text: string }[];
    apiKey?: string;
    model?: string;
  }): Promise<string> {
    const apiKey = params.apiKey || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error('Gemini API Key belum diatur. Harap masukkan API Key di Pengaturan AI.');
    }

    const userModel = params.model ? params.model.replace(/^models\//, '') : '';
    const availableModels = await this.getAvailableGeminiModels(apiKey);

    // Chosen model → last model that worked → newest stable flash …; retired models skipped; max 4 tries
    const uniqueModels = geminiMemory.plan(apiKey, availableModels, userModel || undefined);

    const contents: any[] = [];

    // Add conversation history if available
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      for (const item of params.conversationHistory) {
        contents.push({
          role: item.role,
          parts: [{ text: item.text }],
        });
      }
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: params.userMessage }],
    });

    const bodyPayload = {
      systemInstruction: {
        parts: [
          {
            text:
              params.systemPrompt ||
              'Anda adalah asisten AI WhatsApp Customer Service resmi yang ramah, sopan, dan membantu menjawab pertanyaan pelanggan di luar jam operasional.',
          },
        ],
      },
      contents,
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 800,
      },
    };

    let lastError = '';

    for (const m of uniqueModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        const data = await res.json();
        if (data?.error) {
          lastError = data.error.message || JSON.stringify(data.error);
          console.warn(`⚠️ Gemini model ${m} returned error:`, lastError);
          // Retired for this key → skip it for a day instead of retrying on every message
          if (isRetiredModelError(lastError)) geminiMemory.retire(apiKey, m);
          continue; // Try next model in list
        }

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          console.log(`✨ Gemini successfully replied using model [${m}]`);
          geminiMemory.remember(apiKey, m);
          return reply.trim();
        }
      } catch (err: any) {
        lastError = err.message || 'Fetch error';
        console.warn(`⚠️ Error calling Gemini model ${m}:`, lastError);
      }
    }

    throw new Error(`Gemini API Error: ${lastError || 'Tidak ada model yang merespon'}`);
  }

  /**
   * Generate AI response using OpenAI API (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
   */
  static async generateOpenAiResponse(params: {
    systemPrompt: string;
    userMessage: string;
    conversationHistory?: { role: 'user' | 'model'; text: string }[];
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }): Promise<string> {
    const apiKey = params.apiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('OpenAI API Key belum diatur. Harap masukkan API Key OpenAI di Pengaturan AI.');
    }

    const model = params.model || 'gpt-4o-mini';
    const baseUrl = (params.baseUrl || 'https://api.openai.com').replace(/\/$/, '');

    const messagesPayload: any[] = [];
    if (params.systemPrompt) {
      messagesPayload.push({ role: 'system', content: params.systemPrompt });
    }
    if (params.conversationHistory) {
      for (const item of params.conversationHistory) {
        messagesPayload.push({
          role: item.role === 'user' ? 'user' : 'assistant',
          content: item.text,
        });
      }
    }
    messagesPayload.push({ role: 'user', content: params.userMessage });

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messagesPayload,
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(`OpenAI API Error: ${data?.error?.message || res.statusText}`);
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (reply) {
      console.log(`✨ OpenAI successfully replied using model [${model}]`);
      return reply.trim();
    }
    throw new Error('OpenAI tidak memberikan teks balasan.');
  }

  /**
   * Generate AI response using the Anthropic Claude Messages API (raw HTTP).
   * Current models think before answering, so the reply may be preceded by `thinking` blocks:
   * read every `text` block and leave enough `max_tokens` for thinking + answer.
   */
  static async generateClaudeResponse(params: {
    systemPrompt: string;
    userMessage: string;
    conversationHistory?: { role: 'user' | 'model'; text: string }[];
    apiKey?: string;
    model?: string;
  }): Promise<string> {
    const apiKey = params.apiKey || process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      throw new Error('Anthropic API Key belum diatur. Harap masukkan API Key Claude di Pengaturan AI.');
    }

    // Older saved configs may still point at retired Claude 3.x model ids
    const requested = (params.model || '').trim();
    const model = !requested || /^claude-(3|instant|2)/.test(requested) ? DEFAULT_CLAUDE_MODEL : requested;

    const messagesPayload: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const item of params.conversationHistory || []) {
      if (!item.text?.trim()) continue;
      messagesPayload.push({ role: item.role === 'user' ? 'user' : 'assistant', content: item.text });
    }
    // The API requires the conversation to start with a user turn
    while (messagesPayload.length > 0 && messagesPayload[0].role !== 'user') messagesPayload.shift();
    messagesPayload.push({ role: 'user', content: params.userMessage });

    // Opus / Sonnet 5.5: re-run a policy-declined request on a fallback model inside the same call
    const supportsFallback = /^claude-(opus|sonnet)-5-5$|^claude-fable-5/.test(model);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (supportsFallback) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';

    const body: Record<string, unknown> = {
      model,
      max_tokens: 16000,
      system: params.systemPrompt,
      messages: messagesPayload,
      // Short customer-service replies: low effort keeps answers quick and inexpensive
      output_config: { effort: 'low' },
    };
    if (supportsFallback) body.fallbacks = 'default';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      const msg = data?.error?.message || res.statusText;
      if (res.status === 401) throw new Error('Claude API Error: API key tidak valid.');
      if (res.status === 404) throw new Error(`Claude API Error: model "${model}" tidak tersedia untuk API key ini.`);
      if (res.status === 429) throw new Error('Claude API Error: batas pemakaian tercapai, coba lagi sebentar.');
      throw new Error(`Claude API Error: ${msg}`);
    }

    if (data?.stop_reason === 'refusal') {
      throw new Error('Claude menolak menjawab pesan ini.');
    }

    const reply = (Array.isArray(data?.content) ? data.content : [])
      .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
      .map((block: any) => block.text)
      .join('')
      .trim();
    if (reply) {
      console.log(`✨ Claude successfully replied using model [${data?.model || model}]`);
      return reply;
    }
    throw new Error('Claude tidak memberikan teks balasan.');
  }

  /**
   * Master Unified Multi-AI Dispatcher: Gemini, OpenAI, Claude, Custom LLM
   */
  static async generateAiResponse(params: {
    provider?: 'gemini' | 'openai' | 'claude' | 'custom_llm';
    systemPrompt: string;
    userMessage: string;
    conversationHistory?: { role: 'user' | 'model'; text: string }[];
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }): Promise<string> {
    const provider = params.provider || 'gemini';

    if (provider === 'openai') {
      return this.generateOpenAiResponse(params);
    } else if (provider === 'claude') {
      return this.generateClaudeResponse(params);
    } else if (provider === 'custom_llm') {
      const baseUrl = params.baseUrl || 'http://localhost:11434'; // Default Ollama / LocalAI endpoint
      assertSafeLlmBaseUrl(baseUrl);
      return this.generateOpenAiResponse({ ...params, baseUrl });
    }

    // Default: Gemini
    return this.generateGeminiResponse(params);
  }
}
