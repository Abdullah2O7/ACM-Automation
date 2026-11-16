import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * The mail parts of 'الإعدادات' (/secretary/settings), as seen on the live portal (2026-11-16):
 *
 * - 'استقبال البريد': mailbox cards (status 'يستقبل' / 'متوقف', switch "الاستقبال من هذا الصندوق", 'تعديل',
 *   'عناوين السبام', 'حذف'), 'مزامنة الآن'.
 * - 'سجل الاستلام' (intake log): 'النتيجة' (#ledger-outcome, default 'كل الرسائل'), 'شوهدت من تاريخ' (#ledger-from),
 *   'شوهدت حتى تاريخ' (#ledger-to), 'البحث عن رسالة' (#ledger-search: message id, subject or sender), 'بحث'; each row
 *   links 'فتح الوثيقة' (/secretary/register?focus=<id>).
 * - 'ملخص السجل اليومي': recipients ('عنوان البريد الإلكتروني' #daily-summary-address, 'إضافة عنوان', switch
 *   'يستقبل الملخص', 'حذف'), 'حفظ العناوين', 'إرسال الآن'.
 */
export class MailIntakePage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly syncNowButton = this.page.getByRole('button', { name: 'مزامنة الآن', exact: true });
  readonly ledgerOutcome = this.page.locator('#ledger-outcome');
  readonly ledgerFrom = this.page.locator('#ledger-from');
  readonly ledgerTo = this.page.locator('#ledger-to');
  readonly ledgerSearch = this.page.locator('#ledger-search');
  readonly ledgerSearchButton = this.page.getByRole('button', { name: 'بحث', exact: true });
  readonly openDocumentLinks = this.page.getByRole('link', { name: 'فتح الوثيقة' });
  readonly summaryAddress = this.page.locator('#daily-summary-address');
  readonly addAddressButton = this.page.getByRole('button', { name: 'إضافة عنوان', exact: true });
  readonly saveAddressesButton = this.page.getByRole('button', { name: 'حفظ العناوين', exact: true });
  readonly sendSummaryNowButton = this.page.getByRole('button', { name: 'إرسال الآن', exact: true });

  async open(): Promise<void> {
    await this.visit('/secretary/settings');
    await expect(this.ledgerOutcome).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** 'مزامنة الآن'; returns the server's answer status. */
  async syncNow(): Promise<number> {
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/mail-ingestion') && answer.request().method() === 'POST', { timeout: acmTimeouts.pageLoad }),
      this.syncNowButton.click(),
    ]);
    return response.status();
  }

  /** The cards of the receiving mailboxes. */
  mailboxCards(): Locator {
    return this.page.locator('main div').filter({ has: this.page.getByRole('switch', { name: 'الاستقبال من هذا الصندوق' }) }).filter({ has: this.page.getByRole('button', { name: 'عناوين السبام' }) });
  }

  /** The intake log's 'النتيجة' values. */
  async outcomeOptions(): Promise<string[]> {
    await this.ledgerOutcome.click();
    const options = (await this.page.getByRole('option').allInnerTexts()).map((text) => text.trim());
    await this.page.keyboard.press('Escape');
    return options;
  }

  async filterLedger({ outcome, from, to, search }: { outcome?: string; from?: string; to?: string; search?: string }): Promise<void> {
    if (outcome) {
      await this.ledgerOutcome.click();
      await this.page.getByRole('option', { name: outcome, exact: true }).click();
    }
    if (from) {
      await this.ledgerFrom.fill(from);
    }
    if (to) {
      await this.ledgerTo.fill(to);
    }
    if (search !== undefined) {
      await this.ledgerSearch.fill(search);
    }
    await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/mail-ingestion/messages'), { timeout: acmTimeouts.pageLoad }),
      this.ledgerSearchButton.click(),
    ]);
  }

  /** The rows of the intake log. */
  ledgerRows(): Locator {
    return this.page.locator('main tbody tr').filter({ has: this.page.getByRole('link', { name: 'فتح الوثيقة' }) });
  }

  /** Adds a recipient of 'ملخص السجل اليومي' and saves the list. */
  async addSummaryRecipient(email: string): Promise<void> {
    await this.summaryAddress.fill(email);
    await this.addAddressButton.click();
    await expect(this.page.locator('main')).toContainText(email);
    await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/daily-summary') && answer.request().method() !== 'GET'),
      this.saveAddressesButton.click(),
    ]);
  }

  /** The 'ملخص السجل اليومي' section: from its heading to its 'إرسال الآن'. */
  summarySection(): Locator {
    return this.page.locator('main section, main div').filter({ has: this.sendSummaryNowButton }).filter({ hasText: 'ملخص السجل اليومي' }).last();
  }
}
