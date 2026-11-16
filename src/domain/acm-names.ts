import { TEST_DATA_PREFIX } from './test-data-naming';

/**
 * Names of what the ACM tests create (team decision, 2026-11-16): the sheet's name, prefixed `auto-test-` and a run id,
 * so every run is independent on the shared environment and the cleanup finds them by prefix.
 *
 *   autoName('mhk3x9ab', 'النادي الأهلي')  ->  'auto-test-mhk3x9ab-النادي الأهلي'
 *
 * The run id starts with the time in base 36 (testDataCreatedAt reads it back), then two random characters so two
 * workers starting in the same millisecond still differ.
 */
export const newRunId = (): string =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 2)
    .toString(36)
    .padStart(2, '0')}`;

export const autoName = (runId: string, label: string): string => `${TEST_DATA_PREFIX}-${runId}-${label}`;

/** A user name or e-mail part: Latin only, as the portal's user names are. */
export const autoUserName = (runId: string, label: string): string => autoName(runId, label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

export const autoEmail = (runId: string, label: string): string => `${autoUserName(runId, label)}@example.com`;

/**
 * A password the portal's policy accepts (GET /api/acm/auth/password-policy: 6+ characters, upper and lower case
 * Latin letters, a digit and a symbol) and that differs per run.
 */
export const autoPassword = (runId: string): string => `Auto#${runId.slice(-6)}9x`;
