import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'الإدارة' > 'سجل التدقيق' (/secretary/admin/audit), as seen on the live portal (2026-11-16): 'من تاريخ'
 * (#audit-from), 'إلى تاريخ' (#audit-to), 'المستخدم' (#audit-user), 'الحدث' (#audit-event, default 'تسجيل الدخول
 * والخروج'), 'إعادة الضبط'; one row per event with a button "عرض التفاصيل: <date>".
 */
export class AuditPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly from = this.page.locator('#audit-from');
  readonly to = this.page.locator('#audit-to');
  readonly user = this.page.locator('#audit-user');
  readonly event = this.page.locator('#audit-event');
  readonly rows = this.page.locator('main tbody tr');

  async open(): Promise<void> {
    await this.visit('/secretary/admin/audit');
    await expect(this.event).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** The events 'الحدث' offers. */
  async eventOptions(): Promise<string[]> {
    await this.event.click();
    const options = (await this.page.getByRole('option').allInnerTexts()).map((text) => text.trim());
    await this.page.keyboard.press('Escape');
    return options;
  }

  async filter({ user, event, from, to }: { user?: string; event?: string; from?: string; to?: string }): Promise<void> {
    if (event) {
      await this.event.click();
      await Promise.all([this.waitForList(), this.page.getByRole('option', { name: event, exact: true }).click()]);
    }
    if (from) {
      await this.from.fill(from);
    }
    if (to) {
      await this.to.fill(to);
    }
    if (user) {
      await Promise.all([this.waitForList(), this.user.fill(user)]);
    }
  }

  waitForList(): Promise<unknown> {
    return this.page.waitForResponse((answer) => answer.url().includes('/api/acm/') && /audit/i.test(answer.url()) && answer.request().method() === 'GET', { timeout: acmTimeouts.pageLoad });
  }
}
