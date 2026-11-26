// Choosing which Gemini model to call (pure ranking + small in-memory memory per API key).
//
// Google retires models regularly ("no longer available to new users") and "-latest"
// aliases can be overloaded. Without memory every customer message re-tried the same
// failing models first, adding seconds of latency and wasted calls.

const SKIP = /(tts|image|embedding|aqa|live|audio|vision|learnlm|imagen|veo|gemma|robotics|computer-use|native)/i;

/** Version number in a model name: gemini-2.5-flash → 2.5, gemini-flash-latest → 0 (alias). */
function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Text-chat models, best first: newest version; stable before preview/experimental;
 * "flash" before "flash-lite" before "pro" (speed/cost for chat replies); aliases last.
 */
export function rankGeminiModels(available: string[]): string[] {
  const usable = available
    .map((n) => n.replace(/^models\//, ''))
    .filter((n) => n.startsWith('gemini') && !SKIP.test(n));
  const tier = (n: string) => (/flash-lite/.test(n) ? 1 : /flash/.test(n) ? 0 : /pro/.test(n) ? 2 : 3);
  const unstable = (n: string) => (/(preview|exp|experimental)/.test(n) ? 1 : 0);
  return Array.from(new Set(usable)).sort((a, b) => {
    const va = versionOf(a);
    const vb = versionOf(b);
    if ((va === 0) !== (vb === 0)) return va === 0 ? 1 : -1; // aliases after explicit versions
    return unstable(a) - unstable(b) || vb - va || tier(a) - tier(b) || a.localeCompare(b);
  });
}

/** Errors that mean "this model will not work for this key", not a temporary overload. */
export function isRetiredModelError(message: string): boolean {
  return /(no longer available|not found|is not supported|deprecated|has been discontinued|does not exist)/i.test(message || '');
}

const HOUR = 60 * 60 * 1000;
const listCache = new Map<string, { at: number; models: string[] }>();
const lastGood = new Map<string, string>();
const retired = new Map<string, number>(); // `${key}:${model}` → until

const keyId = (apiKey: string) => apiKey.slice(-12);

export const geminiMemory = {
  cachedList(apiKey: string): string[] | null {
    const hit = listCache.get(keyId(apiKey));
    return hit && Date.now() - hit.at < HOUR ? hit.models : null;
  },
  storeList(apiKey: string, models: string[]) {
    listCache.set(keyId(apiKey), { at: Date.now(), models });
  },
  remember(apiKey: string, model: string) {
    lastGood.set(keyId(apiKey), model);
  },
  retire(apiKey: string, model: string) {
    retired.set(`${keyId(apiKey)}:${model}`, Date.now() + 24 * HOUR);
    if (lastGood.get(keyId(apiKey)) === model) lastGood.delete(keyId(apiKey));
  },
  /** Order to try: preferred (if usable) → last model that worked → ranked list; retired skipped; max 4. */
  plan(apiKey: string, available: string[], preferred?: string): string[] {
    const k = keyId(apiKey);
    const isRetired = (m: string) => (retired.get(`${k}:${m}`) || 0) > Date.now();
    const ranked = rankGeminiModels(available);
    const order = [preferred, lastGood.get(k), ...ranked].filter(
      (m): m is string => !!m && available.includes(m) && !isRetired(m)
    );
    return Array.from(new Set(order)).slice(0, 4);
  },
};
