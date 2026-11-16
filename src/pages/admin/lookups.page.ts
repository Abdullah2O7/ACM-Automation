import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'الإدارة' > 'أكواد النظام' (/secretary/admin/lookups). One table of values at a time ('نوع الكود': الأقسام, الأولوية,
 * نوع الجهة, نوع الوثيقة). Each row: a position <select> ('موضع <code>'), inputs 'الكود' / 'العربية' / 'الإنجليزية' /
 * 'الفرنسية', a switch 'مُفعّل' and a button 'حذف العنصر'. 'إضافة' opens a dialog ('إضافة إلى <table>'); nothing is
 * stored until 'حفظ الجدول', which answers e.g. "تم الحفظ: 1 إضافة و0 تعديل و0 نقل و0 حذف".
 */
export class LookupsPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly tablePicker = this.page.locator('#lookup-table');
  readonly addButton = this.page.getByRole('button', { name: 'إضافة', exact: true });
  readonly saveTableButton = this.page.getByRole('button', { name: 'حفظ الجدول' });
  readonly addDialog = this.page.getByRole('dialog');
  readonly rows = this.page.locator('tbody tr');

  async open(table: string): Promise<void> {
    await this.visit('/secretary/admin/lookups');
    await expect(this.tablePicker).toBeVisible({ timeout: acmTimeouts.pageLoad });
    await this.tablePicker.click();
    await this.page.getByRole('option', { name: table, exact: true }).click();
    await expect(this.tablePicker).toHaveText(table);
    await expect(this.rows.first()).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** Fills the 'إضافة' dialog and confirms it (the row is added to the table, not saved yet). */
  async addValue(value: { code: string; ar: string; en: string; fr: string }): Promise<void> {
    await this.addButton.click();
    await this.page.locator('#lookup-add-code').fill(value.code);
    await this.page.locator('#lookup-add-ar').fill(value.ar);
    await this.page.locator('#lookup-add-en').fill(value.en);
    await this.page.locator('#lookup-add-fr').fill(value.fr);
    await this.addDialog.getByRole('button', { name: 'إضافة', exact: true }).click();
  }

  /** Clicks 'حفظ الجدول' and waits for the confirmation. */
  async saveTable(): Promise<void> {
    await this.saveTableButton.click();
    await expect(this.page.getByText(/تم الحفظ:/).first()).toBeVisible();
  }

  /** The row whose 'الكود' input holds the code. */
  row(code: string): Locator {
    return this.rows.filter({ has: this.page.locator(`select[aria-label="موضع ${code}"]`) });
  }

  async moveTo(code: string, position: number): Promise<void> {
    await this.row(code).locator('select').selectOption(String(position));
  }

  async setActive(code: string, active: boolean): Promise<void> {
    const toggle = this.row(code).getByRole('switch', { name: 'مُفعّل' });
    if ((await toggle.getAttribute('aria-checked')) !== String(active)) {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-checked', String(active));
  }
}
