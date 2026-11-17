import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { answerStatus } from '../../utils/core/answer-status';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'المهام' (/tasks), as seen on the live portal (2026-11-16).
 *
 * Views 'لوحة' / 'قائمة' (tabs), 'خارج المكتب', 'مهمة جديدة'. Filters: 'اسم المهمة' (#task-search), 'الحالة'
 * (#task-status), 'منشئ المهمة', 'منفذ المهمة' (comboboxes labelled so), 'الأولوية' (#task-priority), 'الاستحقاق من'
 * (#task-from), 'الاستحقاق حتى' (#task-to), 'المفتوحة فقط', 'المتأخرة فقط'. Board columns: جديدة, قيد التنفيذ, مرفوضة,
 * منتهية (each with "طيّ عمود <name>"); a task is a button with its name.
 *
 * 'مهمة جديدة' dialog ("كل الحقول مطلوبة عدا الوصف"): 'العنوان' (#task-form-name), 'الوصف' (#task-form-description),
 * 'الأولوية' (#task-form-priority), 'نسبة العمل المنجز' (#task-form-percent), 'منفذ المهمة' (#task-form-executer),
 * 'تاريخ البدء' (#task-form-start), 'نهاية المهمة' (#task-form-due), 'التذكير' (#task-form-reminder); 'إنشاء'.
 *
 * 'خارج المكتب' dialog: 'النائب' (combobox), 'أول يوم غياب' (#out-of-office-start), 'آخر يوم غياب'
 * (#out-of-office-end), 'حفظ'.
 */
export class TasksPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly priorityFilter = this.page.locator('#task-priority');
  readonly statusFilter = this.page.locator('#task-status');
  readonly searchBox = this.page.locator('#task-search');
  readonly dueFrom = this.page.locator('#task-from');
  readonly dueTo = this.page.locator('#task-to');
  readonly newTaskButton = this.page.locator('main').getByRole('button', { name: 'مهمة جديدة', exact: true }).first();
  readonly outOfOfficeButton = this.page.getByRole('button', { name: 'خارج المكتب', exact: true });
  readonly boardTab = this.page.getByRole('tab', { name: 'لوحة', exact: true });
  readonly listTab = this.page.getByRole('tab', { name: 'قائمة', exact: true });
  readonly dialog = this.page.getByRole('dialog');

  async open(): Promise<void> {
    await Promise.all([this.waitForList(), this.visit('/tasks')]);
    await expect(this.priorityFilter).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** The priorities the 'الأولوية' filter offers, in its order, without its 'الكل' entry. */
  async priorityOptions(): Promise<string[]> {
    await this.priorityFilter.click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const texts = (await options.allInnerTexts()).map((text) => text.trim()).filter((text) => text !== 'الكل');
    await this.page.keyboard.press('Escape');
    return texts;
  }

  /** Fills and saves the 'مهمة جديدة' dialog; returns the server's answer. Dates are يوم/شهر/سنة. */
  async createTask(task: { name: string; priority: string; assignee: string; start: string; due: string; reminder?: string; description?: string }): Promise<{ status: number }> {
    // The dialog of the task just created may still be closing; one left open by a failed try would cover the button
    if (!(await this.dialog.waitFor({ state: 'hidden', timeout: 5_000 }).then(() => true).catch(() => false))) {
      await this.dialog.getByRole('button', { name: 'إلغاء', exact: true }).click({ timeout: 5_000 }).catch(() => undefined);
      await expect(this.dialog).toBeHidden();
    }
    await this.newTaskButton.click();
    await this.fillTaskForm(task);
    return this.submitTask();
  }

  /**
   * Fills the task dialog that is open (from 'المهام' or from a correspondence). Every field but 'الوصف' is required,
   * 'التذكير' too: it defaults to the start date.
   */
  async fillTaskForm(task: { name: string; priority: string; assignee: string; start: string; due: string; reminder?: string; description?: string }): Promise<void> {
    await expect(this.dialog.locator('#task-form-name')).toBeVisible();
    await this.dialog.locator('#task-form-name').fill(task.name);
    if (task.description) {
      await this.dialog.locator('#task-form-description').fill(task.description);
    }
    await this.choose(this.dialog.locator('#task-form-priority'), task.priority);
    await this.choose(this.dialog.locator('#task-form-executer'), task.assignee, true);
    await this.dialog.locator('#task-form-start').fill(task.start);
    await this.dialog.locator('#task-form-due').fill(task.due);
    await this.dialog.locator('#task-form-reminder').fill(task.reminder ?? task.start);
  }

  async submitTask(): Promise<{ status: number }> {
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/tasks$/.test(new URL(answer.url()).pathname) && answer.request().method() === 'POST'),
      this.dialog.getByRole('button', { name: 'إنشاء', exact: true }).click(),
    ]);
    const status = await answerStatus(response);
    if (status < 300) {
      await expect(this.dialog).toBeHidden();
    }
    return { status };
  }

  /** A task card (board) or row (list), by its name. */
  task(name: string): Locator {
    return this.page.locator('main').getByRole('button', { name }).or(this.page.locator('main tbody tr').filter({ hasText: name })).first();
  }

  /** The board column of a status, e.g. column('جديدة'): a <section aria-label="جديدة"> (seen live 2026-11-16). */
  column(name: string): Locator {
    return this.page.locator(`main section[aria-label="${name}"]`);
  }

  /**
   * Opens a task (its card or row): its page /tasks?focus=<id> ('العودة إلى المهام', 'تعديل', the status, priority,
   * 'منشئ المهمة', 'منفذ المهمة', dates, 'نسبة الإنجاز' + 'حفظ الإنجاز', 'الإجراءات المتاحة' ('قبول', 'رفض', 'إحالة',
   * 'تعليق'), 'التعليقات' and 'سجل الإجراءات'). Returns the page's main part.
   */
  async openTask(name: string): Promise<Locator> {
    await this.task(name).click();
    const details = this.page.locator('main');
    await expect(this.page.getByRole('button', { name: 'العودة إلى المهام' }).or(this.page.getByText('العودة إلى المهام')).first()).toBeVisible();
    await expect(details).toContainText(name);
    return details;
  }

  /** Clicks an action of the opened task ('قبول', 'رفض', 'إحالة', 'تعليق') and waits for the server's answer. */
  async taskAction(label: RegExp | string): Promise<void> {
    await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/tasks\/\d+/.test(answer.url()) && answer.request().method() !== 'GET', { timeout: acmTimeouts.pageLoad }).catch(() => undefined),
      this.page.locator('main').getByRole('button', { name: label }).first().click(),
    ]);
  }

  /** 'رفض' of the opened task: it stays disabled until 'السبب أو التعليق' is filled. */
  async reject(reason: string): Promise<void> {
    await this.page.locator('main').getByRole('textbox', { name: 'السبب أو التعليق' }).fill(reason);
    await this.taskAction('رفض');
  }

  /** 'نسبة الإنجاز' of the opened task, saved with 'حفظ الإنجاز'. */
  async saveProgress(percent: number): Promise<void> {
    await this.page.locator('main').getByLabel('نسبة الإنجاز').or(this.page.locator('main input[type="number"]')).first().fill(String(percent));
    await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/tasks\/\d+/.test(answer.url()) && answer.request().method() !== 'GET', { timeout: acmTimeouts.pageLoad }),
      this.page.getByRole('button', { name: 'حفظ الإنجاز', exact: true }).click(),
    ]);
  }

  async searchByName(text: string): Promise<void> {
    await Promise.all([this.waitForList(), this.searchBox.fill(text)]);
  }

  /** Picks a value in a filter or form combobox by its visible text. */
  async choose(combobox: Locator, value: string, searchable = false): Promise<void> {
    await combobox.click();
    if (searchable) {
      const search = this.page.locator('[data-radix-popper-content-wrapper] input, [cmdk-input]').first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill(value);
      }
    }
    await this.page.getByRole('option', { name: value }).first().click();
  }

  /** A filter combobox by its label ('منشئ المهمة', 'منفذ المهمة'). */
  filterByLabel(label: string): Locator {
    return this.page.getByRole('combobox', { name: label }).or(this.page.locator('main').getByText(label, { exact: true }).locator('xpath=following::button[@role="combobox"][1]')).first();
  }

  /** Ticks a checkbox filter ('المفتوحة فقط', 'المتأخرة فقط'). */
  async tick(label: string): Promise<void> {
    await Promise.all([this.waitForList(), this.page.locator('main').getByText(label, { exact: true }).click()]);
  }

  /** 'خارج المكتب': the absence period (يوم/شهر/سنة) and the delegate; returns the server's answer. */
  async setOutOfOffice(delegate: string, start: string, end: string): Promise<{ status: number }> {
    await this.outOfOfficeButton.click();
    await this.choose(this.dialog.getByRole('combobox', { name: 'النائب' }), delegate, true);
    await this.dialog.locator('#out-of-office-start').fill(start);
    await this.dialog.locator('#out-of-office-end').fill(end);
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/out-of-office') && answer.request().method() !== 'GET'),
      this.dialog.getByRole('button', { name: 'حفظ', exact: true }).click(),
    ]);
    return { status: await answerStatus(response) };
  }

  waitForList(): Promise<unknown> {
    return this.page.waitForResponse((answer) => /\/api\/acm\/tasks\?/.test(answer.url()) && answer.request().method() === 'GET', { timeout: acmTimeouts.pageLoad });
  }
}
