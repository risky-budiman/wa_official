// ===========================================
// WhatsApp Text & Markdown Formatter
// Parses *bold*, _italic_, ~strike~, `code`, and ```pre```
// ===========================================

export function formatWhatsAppMarkdown(text?: string | null): string {
  if (!text) return '';

  // 1. Escape HTML special characters to prevent XSS
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Monospace block ```code```
  formatted = formatted.replace(
    /```([\s\S]*?)```/g,
    '<pre class="bg-black/15 dark:bg-black/40 p-2 rounded-lg my-1 font-mono text-[11px] overflow-x-auto">$1</pre>'
  );

  // 3. Inline code `code`
  formatted = formatted.replace(
    /`([^`\n\r]+)`/g,
    '<code class="bg-black/15 dark:bg-black/40 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>'
  );

  // 4. Standard Markdown Bold **text**
  formatted = formatted.replace(/\*\*([^*\n\r]+?)\*\*/g, '<strong class="font-bold">$1</strong>');

  // 5. WhatsApp Bold *text*
  formatted = formatted.replace(
    /(^|[\s\p{P}\p{S}])\*([^*\n\r]+?)\*($|[\s\p{P}\p{S}])/gu,
    '$1<strong class="font-bold">$2</strong>$3'
  );

  // 6. WhatsApp Italic _text_
  formatted = formatted.replace(
    /(^|[\s\p{P}\p{S}])_([^_\n\r]+?)_($|[\s\p{P}\p{S}])/gu,
    '$1<em class="italic">$2</em>$3'
  );

  // 7. WhatsApp Strikethrough ~text~
  formatted = formatted.replace(
    /(^|[\s\p{P}\p{S}])~([^~\n\r]+?)~($|[\s\p{P}\p{S}])/gu,
    '$1<del class="line-through opacity-75">$2</del>$3'
  );

  // 8. Convert newlines to HTML break lines
  formatted = formatted.replace(/\n/g, '<br/>');

  return formatted;
}
