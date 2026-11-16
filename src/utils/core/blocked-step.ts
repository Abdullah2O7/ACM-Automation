import { test } from '@playwright/test';

/**
 * Ends a case at a step the suite cannot check (team decision, 2026-11-16): whether an e-mail really reaches an
 * outside inbox, or really arrives from outside. Everything the portal shows was checked before; the case is reported
 * as skipped with the reason, so it is never counted as passed.
 * @param {string} step - The sheet's step that cannot be checked
 * @param {string} reason - Why, e.g. "there is no test inbox"
 * @returns {void}
 */
export const blocked = (step: string, reason: string): void => {
  test.info().annotations.push({ type: 'blocked', description: `${step}: ${reason}` });
  test.skip(true, `BLOCKED: ${step} - ${reason}`);
};

export const NO_TEST_INBOX = 'there is no test inbox (team decision 2026-11-16): only what the portal shows is checked';
