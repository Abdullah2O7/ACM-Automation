import { test as base, expect } from '@playwright/test';
import { withBugEvidence } from './bug-evidence.fixture';
import { STOPPED_BY_USER, stopRequested } from '../utils/core/run-control';
import { LoginPage } from '../pages/auth/login.page';
import { DashboardPage } from '../pages/dashboard/dashboard.page';

type AcmFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  /** Frames the problem on the screenshot of a failed case; runs by itself. */
  bugEvidence: void;
  /** Skips the test when the dashboard's Stop button was pressed. */
  runStop: void;
};

export const test = base.extend<AcmFixtures>({
  runStop: [
    async ({}, use, testInfo) => {
      testInfo.skip(stopRequested(), STOPPED_BY_USER);
      await use();
    },
    { auto: true },
  ],
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  bugEvidence: [async ({ page }, use, testInfo) => withBugEvidence(page, testInfo, use), { auto: true, timeout: 30_000 }],
});

export { expect };
