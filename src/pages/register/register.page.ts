import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/** Folders of 'الصادر و الوارد' as the address names them (?folder=...). */
export type RegisterFolder = 'Triage' | 'Register' | 'Draft' | 'Inbox' | 'Outbox' | 'Spam' | 'Deleted' | 'All';

/**
 * 'الصادر و الوارد' (/secretary/register?folder=...), as seen on the live portal (2026-11-16).
 *
 * List: search "ابحث بالموضوع…", switch 'البحث في متن الرسالة أيضًا' (hint "يتطلب البحث في المتن ثلاثة أحرف على الأقل."),
 * 'تصفية' (a dialog of radio buttons: الاتجاه, النوع, التصنيف, المجلد, and #filter-date-from / #filter-date-to), 'إنشاء',
 * sortable columns (aria "ترتيب حسب الموضوع" / "...الرقم المرجعي" / "...التاريخ"), page size ("عدد السجلات في الصفحة",
 * 50) and "عرض x–y من z". A row shows مقروء / غير مقروء, من / إلى, the subject, flags ('سرّي', 'رد', 'به مرفقات'), the
 * reference number, النوع, المجلد and the date.
 *
 * A record opened beside the list (?focus=<id>): 'رجوع', 'رد', 'رد على الجميع', 'إعادة إرسال', 'طباعة الملصق', 'حذف',
 * the reference number (or #<id> while it has none), the subject, من / إلى, the body, 'المرفقات', 'تفاصيل الرسالة'
 * (النوع, المجلد, التصنيف, تاريخ القيد) and 'المهام' ('مهمة جديدة'). An unclassified one ('غير مصنّف') shows instead
 * "في انتظار القبول", 'النوع' (#classify-type-<id>), 'قبول في الوارد' and 'توجيه داخلي'.
 */
export class RegisterPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly details = this.page.locator('main');
  readonly searchBox = this.page.getByPlaceholder('ابحث بالموضوع…');
  readonly bodySearchSwitch = this.page.getByRole('switch', { name: 'البحث في متن الرسالة أيضًا' });
  readonly bodySearchHint = this.page.getByText('يتطلب البحث في المتن ثلاثة أحرف على الأقل.');
  // Its name carries the number of active filters once one is set ('تصفية 1', seen live 2026-11-17)
  readonly filterButton = this.page.getByRole('button', { name: /^\s*(\d+\s*)?تصفية(\s*\d+)?\s*$/ });
  readonly createLink = this.page.getByRole('link', { name: 'إنشاء', exact: true });
  readonly rows = this.page.locator('main tbody tr');
  readonly pageSize = this.page.getByRole('combobox', { name: 'عدد السجلات في الصفحة' });
  readonly rangeText = this.page.getByText(/عرض \S+–\S+ من \S+/);
  readonly backButton = this.page.getByRole('button', { name: 'رجوع', exact: true });

  // Actions of an opened record
  readonly replyButton = this.page.getByRole('button', { name: 'رد', exact: true });
  readonly replyAllButton = this.page.getByRole('button', { name: 'رد على الجميع', exact: true });
  readonly resendButton = this.page.getByRole('button', { name: 'إعادة إرسال', exact: true });
  readonly deleteButton = this.page.getByRole('button', { name: 'حذف', exact: true });
  readonly acceptToInboxButton = this.page.getByRole('button', { name: 'قبول في الوارد', exact: true });
  readonly routeInternallyButton = this.page.getByRole('button', { name: 'توجيه داخلي', exact: true });

  async openFolder(folder: RegisterFolder): Promise<void> {
    await Promise.all([this.waitForList(), this.visit(`/secretary/register?folder=${folder}`)]);
    await expect(this.searchBox).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** Opens a record of a folder by its document id, and waits for its details. */
  async openRecord(folder: RegisterFolder, documentId: number): Promise<void> {
    await this.visit(`/secretary/register?folder=${folder}&focus=${documentId}`);
    await expect(this.details.getByText('تفاصيل الرسالة').first().or(this.details.getByText(`#${documentId}`).first()).first()).toBeVisible({
      timeout: acmTimeouts.pageLoad,
    });
  }

  /** Types in the search box and waits for the list the server answers. */
  async search(text: string): Promise<void> {
    await Promise.all([this.waitForList(), this.searchBox.fill(text)]);
  }

  /** The list row of a record, by (a part of) its subject. */
  row(subject: string): Locator {
    return this.rows.filter({ hasText: subject });
  }

  /** The subjects of the rows shown now. */
  async listedSubjects(): Promise<string[]> {
    return this.rows.evaluateAll((rows) => rows.map((row) => (row as HTMLElement).innerText));
  }

  /** A value of 'تفاصيل الرسالة' of the opened record, e.g. detailValue('النوع') -> 'خطاب'. */
  async detailValue(label: string): Promise<string> {
    const text = await this.details.innerText();
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = text.split('تفاصيل الرسالة').pop()?.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\n([^\\n]+)`))?.[1]?.trim();
    expect(found, `'${label}' in 'تفاصيل الرسالة'`).toBeTruthy();
    return found as string;
  }

  /** The reference number the opened record shows (YYYY/N/I, YYYY/N/O ...), or '' when it has none yet. */
  async referenceNumber(): Promise<string> {
    const text = await this.details.innerText();
    return text.match(/\b\d{4}\/\d+\/[A-Z]\b/)?.[0] ?? '';
  }

  /** Opens the 'تصفية' dialog, picks radio values by their labels and closes it. */
  async filter(choices: string[], range?: { from?: string; to?: string }): Promise<void> {
    await this.filterButton.click();
    const dialog = this.page.getByRole('dialog');
    for (const choice of choices) {
      const radio = dialog.getByRole('radio', { name: choice, exact: true });
      await radio.click();
      await expect(radio).toHaveAttribute('aria-checked', 'true');
    }
    if (range?.from) {
      await dialog.locator('#filter-date-from').fill(range.from);
    }
    if (range?.to) {
      await dialog.locator('#filter-date-to').fill(range.to);
    }
    // The list may answer each change or only the last one: wait briefly for an answer, then for the list to settle
    const answered = this.waitForList(5_000).catch(() => undefined);
    await this.page.keyboard.press('Escape');
    await answered;
    await expect(this.rows.first().or(this.page.getByText(/لا توجد|لا نتائج/).first()).first()).toBeVisible();
  }

  /** Sorts by a column header ('الموضوع', 'الرقم المرجعي', 'التاريخ'). */
  async sortBy(column: string): Promise<void> {
    const answered = this.waitForList(5_000).catch(() => undefined);
    await this.page.getByRole('button', { name: `ترتيب حسب ${column}` }).click();
    await answered;
  }

  /** Waits for the list the server answers (GET /api/acm/correspondence?...). */
  waitForList(timeout: number = acmTimeouts.pageLoad): Promise<unknown> {
    return this.page.waitForResponse((answer) => /\/api\/acm\/correspondence\?/.test(answer.url()) && answer.request().method() === 'GET', { timeout });
  }
}
