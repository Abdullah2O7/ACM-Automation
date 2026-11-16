import type { Download, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'التقارير' (/secretary/reports), as seen on the live portal (2026-11-16): 'التقرير' (#report-picker, default
 * 'سجل الوارد'), 'صيغة الإخراج' (#format-picker, default PDF), 'من تاريخ' (#report-from), 'إلى تاريخ' (#report-to),
 * 'معاينة', 'تنزيل'. Other reports add their own parameters under the picker.
 */
export class ReportsPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly reportPicker = this.page.locator('#report-picker');
  readonly formatPicker = this.page.locator('#format-picker');
  readonly from = this.page.locator('#report-from');
  readonly to = this.page.locator('#report-to');
  readonly previewButton = this.page.getByRole('button', { name: 'معاينة', exact: true });
  readonly downloadButton = this.page.getByRole('button', { name: 'تنزيل', exact: true });
  /** Where the preview is shown: 'معاينة' opens it in a dialog (seen live 2026-11-16), the PDF embedded or as a table. */
  readonly preview = this.page.getByRole('dialog').first();

  async open(): Promise<void> {
    await this.visit('/secretary/reports');
    await expect(this.reportPicker).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  async chooseReport(name: string): Promise<void> {
    await this.reportPicker.click();
    await this.page.getByRole('option', { name, exact: true }).click();
    await expect(this.reportPicker).toHaveText(name);
  }

  async chooseFormat(name: string): Promise<void> {
    await this.formatPicker.click();
    await this.page.getByRole('option', { name, exact: true }).click();
  }

  async period(from: string, to: string): Promise<void> {
    await this.from.fill(from);
    await this.to.fill(to);
  }

  /** Clicks 'معاينة'; returns the report request's status, or undefined when nothing was sent. */
  async runPreview(): Promise<number | undefined> {
    // GET /api/acm/reports/<report>/export?Format=Pdf&From=..&To=.. - none is sent when the form refuses the parameters
    const response = this.page.waitForResponse((answer) => answer.url().includes('/api/acm/reports'), { timeout: 15_000 }).catch(() => undefined);
    await this.previewButton.click();
    return (await response)?.status();
  }

  async download(): Promise<Download> {
    const [download] = await Promise.all([this.page.waitForEvent('download', { timeout: acmTimeouts.pageLoad }), this.downloadButton.click()]);
    return download;
  }
}
