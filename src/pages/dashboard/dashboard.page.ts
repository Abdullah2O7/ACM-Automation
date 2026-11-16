import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'اللوحة الرئيسية' - the dashboard: counters ('تحتاج تصنيفًا', 'مهام جديدة', 'البريد الوارد', 'بانتظار الحفظ',
 * 'مسودات', 'قيد التنفيذ') and quick actions ('تسجيل مراسلة', 'إرسال رسالة داخلية', 'ابدأ مهامي الجديدة',
 * 'ابحث في الأرشيف').
 *
 * Seen on the live portal (2026-11-16): the admin landing on '/' is taken to 'البريد الداخلي', and neither the navigation
 * nor the search palette lists 'اللوحة الرئيسية' - the dashboard may not exist for this account. These locators follow
 * the sheet's labels; check them when the dashboard is found.
 */
export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly title = this.page.getByText('اللوحة الرئيسية', { exact: true }).first();

  async open(): Promise<void> {
    await this.visit('/');
    await expect(this.title, "'اللوحة الرئيسية' should open").toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** A counter card, by its label: a link or button that holds the label and a number. */
  counter(label: string): Locator {
    return this.page.locator('main').getByRole('link').or(this.page.locator('main').getByRole('button')).filter({ hasText: label }).first();
  }

  /** The number a counter shows (Arabic-Indic digits read too). */
  async counterValue(label: string): Promise<number> {
    const text = (await this.counter(label).innerText()).replace(label, '').replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    return Number(text.match(/\d+/)?.[0] ?? 'NaN');
  }

  /** A quick action, by its label. */
  quickAction(label: string): Locator {
    return this.page.locator('main').getByRole('link', { name: label }).or(this.page.locator('main').getByRole('button', { name: label })).first();
  }
}

/** The dashboard's counters and where each one leads (a folder of the register or a column of the tasks). */
export const dashboardCounters = [
  { label: 'تحتاج تصنيفًا', url: /folder=Triage/ },
  { label: 'مهام جديدة', url: /\/tasks/ },
  { label: 'البريد الوارد', url: /\/correspondence\/mailbox|folder=MailboxInbox/ },
  { label: 'بانتظار الحفظ', url: /folder=Register|archive/ },
  { label: 'مسودات', url: /folder=Draft|Draft/ },
  { label: 'قيد التنفيذ', url: /\/tasks/ },
] as const;

/** The quick actions and the screen each opens. */
export const quickActions = [
  { label: 'تسجيل مراسلة', url: /\/secretary\/register\/new/ },
  { label: 'إرسال رسالة داخلية', url: /\/correspondence\/compose/ },
  { label: 'ابدأ مهامي الجديدة', url: /\/tasks/ },
  { label: 'ابحث في الأرشيف', url: /\/secretary\/archive/ },
] as const;
