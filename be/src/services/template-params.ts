// Template variables for broadcasts — what a template needs, and turning the sender's
// choices into Meta components per recipient. Pure functions (unit-tested).
//
// Never invent values: a variable is either the contact's name or text the sender typed.

export type VarSource = { source: 'contact_name' } | { source: 'text'; value: string };

export interface BroadcastVariables {
  header?: VarSource[];
  body?: VarSource[];
  /** Value per button index (dynamic URL suffix or coupon code) */
  buttons?: Record<string, string>;
  /** Link for IMAGE / VIDEO / DOCUMENT headers */
  headerMediaUrl?: string;
}

export interface TemplateNeeds {
  headerFormat: string | null;
  headerVars: number;
  bodyVars: number;
  buttons: { index: number; kind: 'url' | 'copy_code'; text: string; example?: string }[];
}

const distinctVars = (text: unknown) => new Set(String(text || '').match(/\{\{\s*\d+\s*\}\}/g) || []).size;

export function analyzeTemplate(components: unknown): TemplateNeeds {
  const comps: any[] = Array.isArray(components) ? components : [];
  const header = comps.find((c) => String(c?.type).toUpperCase() === 'HEADER');
  const body = comps.find((c) => String(c?.type).toUpperCase() === 'BODY');
  const buttons = comps.find((c) => String(c?.type).toUpperCase() === 'BUTTONS');
  const headerFormat = header ? String(header.format || 'TEXT').toUpperCase() : null;
  return {
    headerFormat,
    headerVars: headerFormat === 'TEXT' ? distinctVars(header?.text) : 0,
    bodyVars: distinctVars(body?.text),
    buttons: (Array.isArray(buttons?.buttons) ? buttons.buttons : [])
      .map((b: any, index: number) => {
        const type = String(b?.type || '').toUpperCase();
        if (type === 'URL' && String(b?.url || '').includes('{{')) return { index, kind: 'url' as const, text: b.text || 'Link' };
        if (type === 'COPY_CODE') {
          const ex = Array.isArray(b.example) ? b.example[0] : b.example;
          return { index, kind: 'copy_code' as const, text: b.text || 'Salin kode', example: ex ? String(ex) : undefined };
        }
        return null;
      })
      .filter(Boolean) as TemplateNeeds['buttons'],
  };
}

const varOk = (v: VarSource | undefined) =>
  !!v && (v.source === 'contact_name' || (v.source === 'text' && typeof v.value === 'string' && v.value.trim().length > 0));

/** Human-readable list of what is still missing (empty = ready to send). */
export function missingVariables(needs: TemplateNeeds, vars: BroadcastVariables | undefined): string[] {
  const v = vars || {};
  const missing: string[] = [];
  if (needs.headerFormat && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(needs.headerFormat) && !String(v.headerMediaUrl || '').trim()) {
    missing.push(`link ${needs.headerFormat.toLowerCase()} untuk header`);
  }
  for (let i = 0; i < needs.headerVars; i++) if (!varOk(v.header?.[i])) missing.push(`header {{${i + 1}}}`);
  for (let i = 0; i < needs.bodyVars; i++) if (!varOk(v.body?.[i])) missing.push(`{{${i + 1}}}`);
  for (const b of needs.buttons) {
    const given = String(v.buttons?.[String(b.index)] || '').trim();
    if (!given && !(b.kind === 'copy_code' && b.example)) missing.push(`tombol "${b.text}"`);
  }
  return missing;
}

const resolve = (v: VarSource, contactName: string) => (v.source === 'contact_name' ? contactName : v.value.trim());

/** Meta "components" for one recipient. Call only after missingVariables() returned []. */
export function buildComponents(needs: TemplateNeeds, vars: BroadcastVariables | undefined, contactName: string): any[] {
  const v = vars || {};
  const name = (contactName || '').trim() || 'Pelanggan';
  const out: any[] = [];

  if (needs.headerFormat && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(needs.headerFormat)) {
    const kind = needs.headerFormat.toLowerCase();
    out.push({ type: 'header', parameters: [{ type: kind, [kind]: { link: String(v.headerMediaUrl).trim() } }] });
  } else if (needs.headerVars > 0) {
    out.push({ type: 'header', parameters: (v.header || []).slice(0, needs.headerVars).map((x) => ({ type: 'text', text: resolve(x, name) })) });
  }
  if (needs.bodyVars > 0) {
    out.push({ type: 'body', parameters: (v.body || []).slice(0, needs.bodyVars).map((x) => ({ type: 'text', text: resolve(x, name) })) });
  }
  for (const b of needs.buttons) {
    const given = String(v.buttons?.[String(b.index)] || '').trim();
    if (b.kind === 'url') {
      out.push({ type: 'button', sub_type: 'url', index: String(b.index), parameters: [{ type: 'text', text: given }] });
    } else {
      out.push({ type: 'button', sub_type: 'copy_code', index: String(b.index), parameters: [{ type: 'coupon_code', coupon_code: given || b.example }] });
    }
  }
  return out;
}
