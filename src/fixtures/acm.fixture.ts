import { test as base, expect } from '@playwright/test';
import { withBugEvidence } from './bug-evidence.fixture';
import { signInTab } from './session';
import { STOPPED_BY_USER, stopRequested } from '../utils/core/run-control';
import { credentialsOf, type Credentials, type RoleName } from '../config/auth-state';
import { AcmApi, completeFirstSignIn } from '../api/acm-api';
import { autoEmail, autoName, autoPassword, autoUserName, newRunId } from '../domain/acm-names';
import { roles } from '../../test-data/acm/acm.data';
import { LoginPage } from '../pages/auth/login.page';
import { AppShell } from '../pages/shell/app-shell.page';
import { DashboardPage } from '../pages/dashboard/dashboard.page';
import { LookupsPage } from '../pages/admin/lookups.page';
import { RoleTemplatesPage } from '../pages/admin/role-templates.page';
import { UsersPage } from '../pages/admin/users.page';
import { AuditPage } from '../pages/admin/audit.page';
import { MailIntakePage } from '../pages/admin/mail-intake.page';
import { MailboxPage } from '../pages/mailbox/mailbox.page';
import { ReportsPage } from '../pages/reports/reports.page';
import { ArchivingPage } from '../pages/archive/archiving.page';
import type { Browser, Page } from '@playwright/test';
import { SettingsPage } from '../pages/admin/settings.page';
import { EntitiesPage } from '../pages/admin/entities.page';
import { ArchivePage } from '../pages/archive/archive.page';
import { TemplatesPage } from '../pages/archive/templates.page';
import { CorrespondenceFormPage } from '../pages/register/correspondence-form.page';
import { RegisterPage } from '../pages/register/register.page';
import { TasksPage } from '../pages/tasks/tasks.page';
import { logger } from '../utils/logger/logger';

/** A user a case creates for itself (entity, person and account, all `auto-test-`), removed after the case. */
export type DisposableUser = {
  appUserId: number;
  userName: string;
  fullName: string;
  email: string;
  /** The address book person the user belongs to (internal mail is addressed to it). */
  personId: number;
  /** The password to sign in with: the temporary one until `firstSignIn` is done, then the user's own. */
  password: string;
  temporaryPassword: string;
  /** Arabic name of the role template applied to it, e.g. 'مشغل'. */
  roleName: string;
};

type NewUserOptions = {
  /** The role template to apply (default: the operator, 'مشغل'). */
  role?: keyof typeof roles;
  /** Replace the temporary password first, so the user can sign in at once (default true). */
  firstSignIn?: boolean;
};

/** Another account's browser: its tab and the page objects a visibility check needs. */
export type OtherUser = {
  page: Page;
  appShell: AppShell;
  registerPage: RegisterPage;
  mailboxPage: MailboxPage;
  tasksPage: TasksPage;
  correspondenceForm: CorrespondenceFormPage;
  close: () => Promise<void>;
};

const openAs = async (browser: Browser, credentials: Credentials): Promise<OtherUser> => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await signInTab(page, credentials, { keepToken: false });
  return {
    page,
    appShell: new AppShell(page),
    registerPage: new RegisterPage(page),
    mailboxPage: new MailboxPage(page),
    tasksPage: new TasksPage(page),
    correspondenceForm: new CorrespondenceFormPage(page),
    close: () => context.close(),
  };
};

type AcmFixtures = {
  /** Unique per case: every name the case creates carries it (auto-test-<runId>-...). */
  runId: string;
  /** Signs the tab in by token (no sign-in form), as a role of .env or as given credentials. */
  signIn: (who: RoleName | Credentials) => Promise<void>;
  /** Creates a disposable user; everything it created is removed after the case. */
  newUser: (options?: NewUserOptions) => Promise<DisposableUser>;
  loginPage: LoginPage;
  appShell: AppShell;
  dashboardPage: DashboardPage;
  lookupsPage: LookupsPage;
  roleTemplatesPage: RoleTemplatesPage;
  usersPage: UsersPage;
  auditPage: AuditPage;
  mailIntakePage: MailIntakePage;
  mailboxPage: MailboxPage;
  reportsPage: ReportsPage;
  archivingPage: ArchivingPage;
  /**
   * Opens a second browser signed in as another account (a club person, a disposable user), for cases that look at the
   * same record as several users. Closed after the case.
   */
  asAnotherUser: (credentials: Credentials) => Promise<OtherUser>;
  settingsPage: SettingsPage;
  entitiesPage: EntitiesPage;
  archivePage: ArchivePage;
  templatesPage: TemplatesPage;
  correspondenceForm: CorrespondenceFormPage;
  registerPage: RegisterPage;
  tasksPage: TasksPage;
  /**
   * Clean-up the case registers while it creates things (`cleanup(() => adminApi.deleteX(id))`); run after the case,
   * last registered first, even when the case failed. A clean-up that fails is logged, not reported as the case's failure.
   */
  cleanup: (step: () => Promise<unknown>) => void;
  /** Frames the problem on the screenshot of a failed case; runs by itself. */
  bugEvidence: void;
  /** Skips the test when the dashboard's Stop button was pressed. */
  runStop: void;
  /** Every tab starts in Arabic, the language the sheet's cases are written in. */
  arabicByDefault: void;
};

type AcmWorkerFixtures = {
  /** The ACM API as the admin of .env - for preparation and clean-up only, never for the check. */
  adminApi: AcmApi;
};

export const test = base.extend<AcmFixtures, AcmWorkerFixtures>({
  runStop: [
    async ({}, use, testInfo) => {
      testInfo.skip(stopRequested(), STOPPED_BY_USER);
      await use();
    },
    { auto: true },
  ],
  adminApi: [
    async ({}, use) => {
      const api = await AcmApi.as(credentialsOf('ADMIN'));
      await use(api);
      await api.dispose();
    },
    { scope: 'worker' },
  ],
  // With no language chosen yet the portal follows the browser's, and the runs use en-US (playwright.config.ts). The
  // choice is written once per tab only, so a case that switches the language (TC002) keeps its switch on reload.
  arabicByDefault: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        if (!sessionStorage.getItem('acm.autotest.language')) {
          localStorage.setItem('acm.lang', 'ar');
          sessionStorage.setItem('acm.autotest.language', '1');
        }
      });
      await use();
    },
    { auto: true },
  ],
  runId: async ({}, use) => use(newRunId()),
  signIn: async ({ page }, use) =>
    use(async (who) => {
      // An .env account's token is kept between runs; a disposable user's is not
      await signInTab(page, typeof who === 'string' ? credentialsOf(who) : who, { keepToken: typeof who === 'string' });
    }),
  newUser: async ({ adminApi, runId }, use) => {
    const created: { userId?: number; personId?: number; entityId?: number }[] = [];
    let sequence = 0;
    await use(async ({ role = 'operator', firstSignIn = true } = {}) => {
      sequence += 1;
      const label = `user${sequence}`;
      const record: (typeof created)[number] = {};
      created.push(record);
      record.entityId = await adminApi.createEntity(autoName(runId, `${label}-entity`));
      const fullName = autoName(runId, `${label}-person`);
      const email = autoEmail(runId, label);
      record.personId = await adminApi.createPerson(fullName, record.entityId, email);
      const user = await adminApi.createUser(record.personId, autoUserName(runId, label), fullName, email, await adminApi.roleTemplateId(roles[role].code, roles[role].name));
      record.userId = user.appUserId;
      let password = user.temporaryPassword;
      if (firstSignIn) {
        password = autoPassword(runId);
        await completeFirstSignIn(user.userName, user.temporaryPassword, password);
      }
      return { appUserId: user.appUserId, userName: user.userName, fullName, email, personId: record.personId as number, password, temporaryPassword: user.temporaryPassword, roleName: roles[role].name };
    });
    // Clean-up: account first (it is linked to the person), then the person, then its entity
    for (const record of created.reverse()) {
      for (const [what, remove] of [
        ['user', () => record.userId !== undefined && adminApi.deleteUser(record.userId)],
        ['person', () => record.personId !== undefined && adminApi.deleteAddressBookEntry(record.personId)],
        ['entity', () => record.entityId !== undefined && adminApi.deleteAddressBookEntry(record.entityId)],
      ] as const) {
        await Promise.resolve(remove()).catch((error: Error) => logger.warn(`Could not remove the test ${what}: ${error.message}`));
      }
    }
  },
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  appShell: async ({ page }, use) => use(new AppShell(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  lookupsPage: async ({ page }, use) => use(new LookupsPage(page)),
  roleTemplatesPage: async ({ page }, use) => use(new RoleTemplatesPage(page)),
  usersPage: async ({ page }, use) => use(new UsersPage(page)),
  auditPage: async ({ page }, use) => use(new AuditPage(page)),
  mailIntakePage: async ({ page }, use) => use(new MailIntakePage(page)),
  mailboxPage: async ({ page }, use) => use(new MailboxPage(page)),
  reportsPage: async ({ page }, use) => use(new ReportsPage(page)),
  archivingPage: async ({ page }, use) => use(new ArchivingPage(page)),
  asAnotherUser: async ({ browser }, use) => {
    const opened: OtherUser[] = [];
    await use(async (credentials) => {
      const other = await openAs(browser, credentials);
      opened.push(other);
      return other;
    });
    for (const other of opened) {
      await other.close().catch(() => undefined);
    }
  },
  settingsPage: async ({ page }, use) => use(new SettingsPage(page)),
  entitiesPage: async ({ page }, use) => use(new EntitiesPage(page)),
  archivePage: async ({ page }, use) => use(new ArchivePage(page)),
  templatesPage: async ({ page }, use) => use(new TemplatesPage(page)),
  correspondenceForm: async ({ page }, use) => use(new CorrespondenceFormPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  tasksPage: async ({ page }, use) => use(new TasksPage(page)),
  // Depends on newUser so it is torn down first: what a case registered (its correspondence, tasks) is removed before
  // its disposable users and their persons, which the server will not delete while a record names them.
  cleanup: async ({ newUser }, use, testInfo) => {
    void newUser;
    const steps: (() => Promise<unknown>)[] = [];
    await use((step) => {
      steps.push(step);
    });
    for (const step of steps.reverse()) {
      await step().catch((error: Error) => logger.warn(`${testInfo.title}: clean-up step failed: ${error.message}`));
    }
  },
  bugEvidence: [async ({ page }, use, testInfo) => withBugEvidence(page, testInfo, use), { auto: true, timeout: 30_000 }],
});

export { expect };
