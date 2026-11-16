import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * Archiving a correspondence into a folder, and finding it in 'الأرشيف' (/secretary/archive) - as seen on the live
 * portal (2026-11-16).
 *
 * Archiving starts in the register's list: tick the record ('تحديد السجل'), and the list's selection bar offers
 * 'أرشفة المحدد' (with 'تصنيف كغير مرغوب', 'حذف المحدد', 'إلغاء التحديد'). The dialog 'أرشفة في مجلد': 'المجلد'
 * (#filing-cabinet - only folders the user may write to; each option shows the folder and its template, "بدون نموذج"
 * when none), then the template's fields by their labels ("* مطلوب" for a mandatory one; a list field is a combobox
 * 'اختر قيمة'; a date is يوم/شهر/سنة), and 'أرشفة'. 'أرشفة' with a mandatory field empty shows one alert naming them all:
 * "لم تُدخل قيمة في: رقم خطاب الجهة، يتطلب رد".
 *
 * 'الأرشيف': tabs 'المستندات', 'بحث متقدم', 'إدارة المجلد'; the folder tree shows each folder with its documents count;
 * documents are links /secretary/archive/<id>, whose page shows the reference, 'المجلد', 'القالب' and the record.
 * 'بحث متقدم': 'النموذج' (combobox), 'نص البحث' (#archive-advanced-text), 'المجلد' (#archive-advanced-cabinet),
 * #archive-advanced-from / -to, 'بحث', 'مسح'.
 */
export class ArchivingPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly dialog = this.page.getByRole('dialog').filter({ hasText: 'أرشفة في مجلد' });
  readonly archiveSelected = this.page.getByRole('button', { name: 'أرشفة المحدد', exact: true });
  readonly folderPicker = this.page.locator('#filing-cabinet');
  readonly archiveButton = this.dialog.getByRole('button', { name: 'أرشفة', exact: true });
  /** "لم تُدخل قيمة في: ..." - the mandatory fields left empty (or holding a value of the wrong type). */
  readonly missingValues = this.dialog.getByText(/لم تُدخل قيمة في/).first();
  readonly advancedTab = this.page.getByRole('tab', { name: 'بحث متقدم', exact: true });
  readonly advancedText = this.page.locator('#archive-advanced-text');
  readonly advancedCabinet = this.page.locator('#archive-advanced-cabinet');
  readonly searchButton = this.page.getByRole('button', { name: 'بحث', exact: true });
  readonly documentLinks = this.page.locator('main a[href^="/secretary/archive/"]');

  /** Ticks a record in the register list (already filtered to it) and opens 'أرشفة المحدد'. */
  async startArchiving(row: Locator): Promise<void> {
    await row.getByRole('checkbox', { name: 'تحديد السجل' }).click();
    await this.archiveSelected.click();
    await expect(this.folderPicker).toBeVisible();
  }

  /** Picks the folder in 'المجلد' (the last name of the path: the folder itself) and waits for its fields. */
  async chooseFolder(path: string[]): Promise<void> {
    const folder = path[path.length - 1];
    await this.folderPicker.click();
    await this.page.getByRole('option').filter({ hasText: folder }).first().click();
    await expect(this.folderPicker).toContainText(folder);
    await expect(this.dialog.getByText(/حقول الفهرسة/).first()).toBeVisible();
  }

  /** An index field of the dialog by its name (its label also carries "* مطلوب" when it is mandatory). */
  field(label: string): Locator {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.dialog.getByLabel(new RegExp(`^\\s*${escaped}(\\s|\\*|$)`)).first();
  }

  /** Fills index fields by name: a text box is typed in, a list field is picked. */
  async fillFields(values: Partial<Record<string, string>>): Promise<void> {
    for (const [label, value] of Object.entries(values)) {
      if (value === undefined) {
        continue;
      }
      const field = this.field(label);
      if ((await field.getAttribute('role')) === 'combobox') {
        await field.click();
        await this.page.getByRole('option', { name: value, exact: true }).click();
        await expect(field).toContainText(value);
      } else {
        await field.fill(value);
      }
    }
  }

  /** The options a list field offers. */
  async optionsOf(label: string): Promise<string[]> {
    await this.field(label).click();
    const options = (await this.page.getByRole('option').allInnerTexts()).map((text) => text.trim()).filter((text) => text !== 'اختر قيمة');
    await this.page.keyboard.press('Escape');
    return options;
  }

  /**
   * 'أرشفة'; returns the server's answer status, or undefined when the form refused it ("لم تُدخل قيمة في: ..."). A list
   * field's dropdown that is still closing would take the click, so it is waited for first.
   */
  async save(): Promise<number | undefined> {
    await expect(this.page.getByRole('listbox')).toHaveCount(0);
    const response = this.page
      .waitForResponse((answer) => answer.url().includes('/api/acm/') && !['GET', 'OPTIONS'].includes(answer.request().method()) && !/\/read$/.test(answer.url()), { timeout: 10_000 })
      .catch(() => undefined);
    const refused = this.missingValues.waitFor({ timeout: 10_000 }).then(() => 'refused' as const).catch(() => undefined);
    await this.archiveButton.click();
    // A click right after a list field's pick may only take the focus back: when nothing happens, click once more
    const nothingYet = new Promise<'none'>((resolve) => setTimeout(() => resolve('none'), 3_000));
    if ((await Promise.race([response, refused, nothingYet])) === 'none') {
      await this.archiveButton.click();
    }
    const outcome = await Promise.race([response, refused]);
    if (outcome === 'refused' || outcome === undefined) {
      return undefined;
    }
    if (outcome.ok()) {
      await expect(this.dialog).toBeHidden();
    }
    return outcome.status();
  }

  /** The names "لم تُدخل قيمة في: ..." lists. */
  async missingFields(): Promise<string[]> {
    await expect(this.missingValues).toBeVisible();
    const text = (await this.missingValues.innerText()).split(':').slice(1).join(':');
    return text.split(/[،,]/).map((name) => name.trim()).filter(Boolean);
  }

  // ------------------------------------------------------ 'الأرشيف' ------------------------------------------------

  async open(): Promise<void> {
    await this.visit('/secretary/archive');
    await expect(this.advancedTab).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** A folder of the tree: its button shows the name, then its template (when none) and its documents count. */
  folder(name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page.locator('main').getByRole('button', { name: new RegExp(`^${escaped}(\\s|$)`) }).first();
  }

  /** The count beside a folder. */
  async folderCount(name: string): Promise<number> {
    const text = (await this.folder(name).innerText()).replace(name, '').replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    return Number(text.match(/\d+\s*$/)?.[0] ?? 'NaN');
  }

  /** Selects a folder and waits for its documents. */
  async selectFolder(name: string): Promise<void> {
    const listed = this.page.waitForResponse((answer) => /\/api\/acm\/archive\?/.test(answer.url()), { timeout: acmTimeouts.pageLoad }).catch(() => undefined);
    await this.folder(name).click();
    await listed;
  }

  /** Opens an archived document by its subject (from the documents shown) and waits for its page. */
  async openDocument(subject: string): Promise<void> {
    await this.documentLinks.filter({ hasText: subject }).first().click();
    await expect(this.page.getByRole('button', { name: 'نقل إلى مجلد' }).or(this.page.getByText('القالب').first()).first()).toBeVisible();
  }

  /** 'بحث متقدم' by a template's index value (or the free text), optionally within a folder. */
  async advancedSearch({ template, field, value, text, folder }: { template?: string; field?: string; value?: string; text?: string; folder?: string }): Promise<void> {
    await this.advancedTab.click();
    const panel = this.page.locator('main');
    if (template) {
      // 'النموذج' shows 'كل النماذج' until one is chosen
      await panel.getByRole('combobox').filter({ hasText: 'كل النماذج' }).or(panel.getByRole('combobox', { name: 'النموذج' })).first().click();
      await this.page.getByRole('option', { name: template, exact: true }).click();
    }
    if (field && value) {
      const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const input = panel.getByLabel(new RegExp(`^\\s*${escaped}(\\s|\\*|$)`)).first();
      await expect(input).toBeVisible();
      if ((await input.getAttribute('role')) === 'combobox') {
        await input.click();
        await this.page.getByRole('option', { name: value, exact: true }).click();
      } else {
        await input.fill(value);
      }
    }
    if (text) {
      await this.advancedText.fill(text);
    }
    if (folder) {
      await this.advancedCabinet.click();
      await this.page.getByRole('option').filter({ hasText: folder }).first().click();
    }
    const listed = this.page.waitForResponse((answer) => /\/api\/acm\/archive/.test(answer.url()), { timeout: acmTimeouts.pageLoad }).catch(() => undefined);
    await this.searchButton.click();
    await listed;
  }
}
