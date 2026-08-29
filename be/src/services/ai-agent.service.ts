// ===========================================
// AI Agent Service — Out-of-Hours Auto-Responder
// ===========================================

import { nanoid } from 'nanoid';
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../config/database';
import { messages, conversations, organizations, phoneNumbers } from '../db/schema';
import type { OperatingHoursConfig, AiAgentConfig } from '../db/schema/organizations';
import { MetaApiService } from './meta-api.service';
import { env } from '../config/env';

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
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.models)) {
        const supported = data.models
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));
        if (supported.length > 0) {
          console.log(`🤖 Discovered ${supported.length} available Gemini models for API Key:`, supported.slice(0, 4).join(', '));
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

    // Build prioritized list of models to try
    const modelsToTry: string[] = [];
    if (userModel && availableModels.includes(userModel)) {
      modelsToTry.push(userModel);
    }

    // Flash models first (fastest & cost-effective)
    const flashModels = availableModels.filter((m) => m.includes('flash') && !m.includes('2.5'));
    modelsToTry.push(...flashModels);
    modelsToTry.push(...availableModels);

    // Deduplicate
    const uniqueModels = Array.from(new Set(modelsToTry));

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
        temperature: 0.7,
        maxOutputTokens: 500,
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
          continue; // Try next model in list
        }

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          console.log(`✨ Gemini successfully replied using model [${m}]`);
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
   * Process out-of-hours inbound message and auto-reply to customer
   */
  static async handleOutOfHoursInbound(params: {
    orgId: string;
    convId: string;
    contactWaId: string;
    contactName: string;
    incomingText: string;
    phoneRecordId: string;
  }) {
    const { orgId, convId, contactWaId, contactName, incomingText, phoneRecordId } = params;

    // 1. Fetch organization AI config
    const [org] = await db
      .select({
        name: organizations.name,
        accessToken: organizations.accessToken,
        operatingHours: organizations.operatingHours,
        aiAgentConfig: organizations.aiAgentConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return;

    // 1b. Check if conversation has already been assigned / claimed by a human agent
    const [conv] = await db
      .select({
        id: conversations.id,
        assignedUserId: conversations.assignedUserId,
        status: conversations.status,
      })
      .from(conversations)
      .where(eq(conversations.id, convId))
      .limit(1);

    if (conv && (conv.assignedUserId || conv.status === 'RESOLVED')) {
      console.log(`ℹ️ Percakapan ${convId} sudah diambil/ditugaskan ke agen (${conv.assignedUserId || 'Resolved'}). AI Agent berhenti membalas.`);
      return;
    }

    const aiConfig = org.aiAgentConfig;
    if (!aiConfig || !aiConfig.enabled) {
      return; // AI Agent disabled
    }

    // 2. Fetch Phone details
    const [phone] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, phoneRecordId))
      .limit(1);

    if (!phone) return;

    const activeToken =
      org.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
        ? org.accessToken
        : env.META_ACCESS_TOKEN;

    let responseText = '';

    // Mode A: Static Out-of-Hours Message
    if (aiConfig.mode === 'STATIC_MESSAGE') {
      responseText =
        aiConfig.staticMessage ||
        `Halo ${contactName}, terima kasih telah menghubungi ${org.name}.\n\nSaat ini layanan pelanggan kami sedang berada di luar jam operasional. Pesan Anda telah kami terima dan akan segera dibalas oleh tim kami saat jam operasional dimulai. Terima kasih atas pengertian Anda! 🙏`;
    } else {
      // Mode B: AI Smart Assistant (Gemini)
      try {
        // Fetch last 6 messages for context
        const recentMsgs = await db
          .select({
            direction: messages.direction,
            body: messages.body,
            senderType: messages.senderType,
          })
          .from(messages)
          .where(eq(messages.conversationId, convId))
          .orderBy(desc(messages.createdAt))
          .limit(6);

        const history = recentMsgs.reverse().map((m) => ({
          role: (m.direction === 'INBOUND' ? 'user' : 'model') as 'user' | 'model',
          text: m.body || '',
        }));

        const defaultPrompt = `Anda adalah asisten AI customer service WhatsApp resmi dari ${org.name}.
Saat ini kantor sedang berada di luar jam operasional.
Tugas Anda:
1. Berikan jawaban yang ramah, sopan, solutif, dan profesional dalam Bahasa Indonesia.
2. Jawab pertanyaan pelanggan dengan singkat dan padat (maksimal 2-3 paragraf).
3. Jika pelanggan menanyakan hal teknis atau membutuhkan bantuan agen manusia, jelaskan bahwa pesan mereka telah dicatat dan akan ditindaklanjuti oleh agen kami pada jam kerja.`;

        const finalSystemPrompt = aiConfig.systemPrompt?.trim()
          ? `${defaultPrompt}\n\nPanduan Bisnis & FAQ Perusahaan:\n${aiConfig.systemPrompt}`
          : defaultPrompt;

        responseText = await AiAgentService.generateGeminiResponse({
          systemPrompt: finalSystemPrompt,
          userMessage: incomingText,
          conversationHistory: history,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model || 'gemini-2.0-flash',
        });
      } catch (aiErr: any) {
        console.error('❌ AI Agent response error:', aiErr.message);
        responseText =
          aiConfig.staticMessage ||
          `Halo ${contactName}, terima kasih telah menghubungi ${org.name}.\n\nSaat ini layanan pelanggan kami sedang berada di luar jam operasional. Pesan Anda telah kami catat di antrean sistem dan akan segera dibalas oleh tim kami saat jam kerja dimulai. 🙏`;
      }
    }

    if (!responseText.trim()) return;

    // 3. Send WhatsApp Outbound Message via Meta API
    let wamId: string | null = null;
    try {
      const metaRes = await MetaApiService.sendTextMessage(
        {
          phoneNumberId: phone.phoneNumberId,
          recipientWaId: contactWaId,
          text: responseText,
        },
        activeToken
      );
      wamId = metaRes.messages?.[0]?.id || null;
    } catch (metaSendErr: any) {
      console.error('❌ Failed to send AI auto-reply WhatsApp message:', metaSendErr.message);
    }

    // 4. Save AI Response to Database (senderType: 'BOT')
    const messageId = nanoid();
    await db.insert(messages).values({
      id: messageId,
      conversationId: convId,
      wamId,
      direction: 'OUTBOUND',
      senderType: 'BOT',
      senderId: null,
      messageType: 'text',
      body: responseText,
      isInternalNote: false,
      status: 'SENT',
      createdAt: new Date(),
    });

    // 5. Update Conversation preview
    await db
      .update(conversations)
      .set({
        lastMessagePreview: `[AI]: ${responseText.slice(0, 80)}`,
        lastMessageAt: new Date(),
      })
      .where(eq(conversations.id, convId));

    console.log(`🤖 AI Agent Auto-Replied to ${contactWaId} in conversation ${convId}`);
  }
}
