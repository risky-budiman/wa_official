// Contact e-mail for the legal pages, configured on the server (LEGAL_CONTACT_EMAIL in be/.env).
import { apiRequest } from '$lib/api/client';
import { LEGAL } from '$lib/legal';

class LegalContact {
  email = $state<string>(LEGAL.contactEmail);
  private loaded = false;

  async load() {
    if (this.loaded) return;
    this.loaded = true;
    const res = await apiRequest<{ contactEmail: string | null }>('/public/legal-info');
    if (res.success && res.contactEmail) this.email = res.contactEmail;
  }
}

export const legalContact = new LegalContact();
