import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'البريد الداخلي' (/correspondence/mailbox), as seen on the live portal (2026-11-16): search "ابحث بالموضوع…",
 * 'غير المقروءة فقط', date range #mailbox-date-from / #mailbox-date-to (يوم/شهر/سنة), 'رسالة جديدة'
 * (/correspondence/compose), and the list (مقروء / غير مقروء, من / إلى, subject, reference, date). Its folders
 * ('الرسائل الواردة', 'الرسائل الصادرة', 'المسودات', 'المحذوفات') are opened from the navigation or the search palette.
 */
export class MailboxPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly searchBox = this.page.getByPlaceholder('ابحث بالموضوع…');
  readonly unreadOnly = this.page.getByRole('button', { name: 'غير المقروءة فقط', exact: true });
  readonly dateFrom = this.page.locator('#mailbox-date-from');
  readonly dateTo = this.page.locator('#mailbox-date-to');
  readonly newMessageLink = this.page.getByRole('link', { name: 'رسالة جديدة', exact: true });
  readonly rows = this.page.locator('main tbody tr');
  readonly deleteButton = this.page.getByRole('button', { name: 'حذف', exact: true });

  async open(): Promise<void> {
    await Promise.all([this.waitForList(), this.visit('/correspondence/mailbox')]);
    await expect(this.searchBox).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  async search(text: string): Promise<void> {
    await Promise.all([this.waitForList(), this.searchBox.fill(text)]);
  }

  row(subject: string): Locator {
    return this.rows.filter({ hasText: subject });
  }

  /** 'غير المقروءة فقط' on or off. Switching it off may reuse the list it had (no request), so the answer is not awaited. */
  async toggleUnreadOnly(): Promise<void> {
    const answered = this.page
      .waitForResponse((answer) => /\/api\/acm\/correspondence\?/.test(answer.url()), { timeout: 5_000 })
      .catch(() => undefined);
    await this.unreadOnly.click();
    await answered;
  }

  /** The date range. The list may ask the server once per field or not at all (same range): the answer is not awaited. */
  async dateRange(from: string, to: string): Promise<void> {
    await this.dateFrom.fill(from);
    await this.dateFrom.press('Tab');
    const answered = this.page.waitForResponse((answer) => /\/api\/acm\/correspondence\?/.test(answer.url()), { timeout: 5_000 }).catch(() => undefined);
    await this.dateTo.fill(to);
    await this.dateTo.press('Tab');
    await answered;
  }

  /**
   * Ticks a message of the list (already filtered to it) and deletes it with the selection's 'حذف المحدّد' (the
   * selection also offers 'تعليم كمقروءة', 'تعليم كغير مقروءة', 'إلغاء التحديد'), confirming when asked.
   */
  async deleteSelected(subject: string): Promise<void> {
    await this.row(subject).first().getByRole('checkbox').click();
    await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/correspondence/.test(answer.url()) && ['DELETE', 'POST', 'PUT'].includes(answer.request().method()), { timeout: acmTimeouts.pageLoad }),
      (async () => {
        await this.page.getByRole('button', { name: /^حذف المحد+ّ?د$/ }).click();
        const confirm = this.page.getByRole('alertdialog').or(this.page.getByRole('dialog')).first();
        if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await confirm.getByRole('button', { name: /^(حذف|تأكيد|نعم)$/ }).last().click();
        }
      })(),
    ]);
  }

  /** Opens a message of the list and waits for its body. */
  async openMessage(subject: string): Promise<void> {
    // Opening marks the message read (POST /correspondence/{id}/read): wait for it, or leaving at once loses it
    const read = this.page.waitForResponse((answer) => /\/api\/acm\/correspondence\/\d+\/read$/.test(answer.url()), { timeout: 10_000 }).catch(() => undefined);
    await this.row(subject).first().click();
    await expect(this.page.getByRole('button', { name: 'رجوع', exact: true })).toBeVisible();
    await read;
  }

  waitForList(): Promise<unknown> {
    return this.page.waitForResponse((answer) => /\/api\/acm\/correspondence\?/.test(answer.url()) && answer.request().method() === 'GET', { timeout: acmTimeouts.pageLoad });
  }
}
