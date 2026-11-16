/**
 * The applications ("portals") the suite drives - one entry per web application of the project under test: one for
 * a single-site project, several for, say, an admin back office and a customer site.
 *
 * ADAPT TO YOUR PROJECT: add, rename or remove entries below. Everything that differs per portal is declared here,
 * so a test never hard-codes a URL. A portal whose base URL is not set in `.env` is simply not in use: nothing signs
 * in to it - so a project can declare a portal before it has an environment.
 */

type PortalDefinition = {
  /** Human name used in logs and failure messages. */
  title: string;
  /** Environment variable holding the portal root, e.g. `https://<host>:<port>`. */
  baseUrlVariable: string;
  /** Route a signed-in session is sent to at the start of every test. */
  homePath: string;
  /**
   * The element the application renders itself into: `#root` (React), `app-root` (Angular), `#app` (Vue), or
   * `body` for a server-rendered site. Once sign-in returns to the portal, this element having content is what
   * proves the application actually booted, rather than the browser landing on an error page.
   */
  appRootSelector: string;
  /**
   * An element only a signed-in user sees - the user menu or a Logout button, e.g. `[data-testid="user-menu"]`.
   * It tells "signed in" from "still on the sign-in page" when both are on the same origin; without it the
   * application root is used, which is enough only when the sign-in form is on another origin.
   */
  signedInSelector?: string;
  /** The portal's sign-in form, when its fields differ from the defaults in src/pages/login.page.ts. */
  login?: LoginSelectors;
  /**
   * The sign-in callback page, when it can get stuck. If the tab is still on it after `loginTimeouts.callbackStall`
   * without the application showing, sign-in opens `homePath` again: the session cookie is already set, so that
   * finishes the sign-in. (Normally the callback is faster - it carries the one-time code - so this is only a fallback.)
   */
  stuckCallback?: RegExp;
};

/** CSS selectors of a sign-in form; any one left out keeps its default. */
export type LoginSelectors = {
  username?: string;
  password?: string;
  submit?: string;
};

export const portals = {
  acm: {
    title: 'ACM - نظام الأرشيف والمراسلات',
    baseUrlVariable: 'ACM_BASE_URL',
    homePath: '/',
    appRootSelector: '#root',
    signedInSelector: 'header',
    login: {
      username: 'input[name="username"], input[type="text"]',
      password: 'input[name="password"], input[type="password"]',
      submit: 'button[type="submit"]',
    },
  },
  portal: {
    title: 'ACM Portal',
    baseUrlVariable: 'PORTAL_BASE_URL',
    homePath: '/',
    appRootSelector: '#root',
  },
} as const satisfies Record<string, PortalDefinition>;

export type PortalName = keyof typeof portals;

/** A portal's definition, with the optional fields typed as optional. */
export const definitionOf = (portal: PortalName): PortalDefinition => portals[portal];

/** Root URL of a portal, e.g. `https://<host>:<port>`, without its trailing slashes. */
export const baseUrlOf = (portal: PortalName): string => {
  const variable = portals[portal].baseUrlVariable;
  const value = process.env[variable]?.trim() || 'https://test-acm.3segypt.com';
  if (!value) {
    throw new Error(`MISSING_ENVIRONMENT_CONFIGURATION:${variable}: the ${portals[portal].title} is used but has no base URL in .env.`);
  }
  return value.replace(/\/+$/, '');
};

const hasOrigin = (url: string, expected: string): boolean => {
  try {
    return new URL(url).origin === new URL(expected).origin;
  } catch {
    return false;
  }
};

/**
 * True when the browser is inside the given portal. A full origin check, so portals on the same host that differ
 * only by port are told apart.
 */
export const isPortalUrl = (portal: PortalName, url: string): boolean => hasOrigin(url, baseUrlOf(portal));
