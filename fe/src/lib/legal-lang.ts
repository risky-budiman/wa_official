// Language of the public legal pages: ?lang=en|id, else the browser language.
import { browser } from '$app/environment';

export function initialLegalLang(url: URL): 'id' | 'en' {
  const q = url.searchParams.get('lang');
  if (q === 'en' || q === 'id') return q;
  if (browser && !navigator.language.toLowerCase().startsWith('id')) return 'en';
  return 'id';
}
