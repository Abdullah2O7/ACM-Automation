import type { Page } from '@playwright/test';
import { tokenFor } from '../api/acm-api';
import type { Credentials } from '../config/auth-state';

/**
 * Signing a tab in without the sign-in form.
 *
 * The portal keeps its Bearer token in sessionStorage['acm.accessToken'] (one hour), which Playwright's storageState does
 * not save - so a saved sign-in cannot be reused. Instead the token is fetched once per account and worker through the
 * API (tokenFor), and written into the tab's sessionStorage before the portal's own scripts run.
 *
 * It is written ONCE per tab (a marker remembers it): a case that signs out stays signed out after the portal reloads,
 * which is what "opening any system URL redirects back to login" needs.
 *
 * Cases about the sign-in form itself (TC001, TC028, TC029) use the form, not this.
 */

const INJECTED_MARKER = 'acm.autotest.signedIn';

/** Signs the tab in as the account, in Arabic (the portal's default), before it opens any page. */
export const signInTab = async (page: Page, credentials: Credentials, { language = 'ar', keepToken = true }: { language?: 'ar' | 'en'; keepToken?: boolean } = {}): Promise<void> => {
  const token = await tokenFor(credentials, { keep: keepToken });
  await page.addInitScript(
    ({ token: value, marker, lang }) => {
      if (!sessionStorage.getItem(marker)) {
        sessionStorage.setItem('acm.accessToken', value);
        sessionStorage.setItem(marker, '1');
        localStorage.setItem('acm.lang', lang);
      }
    },
    { token, marker: INJECTED_MARKER, lang: language },
  );
};
