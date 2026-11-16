import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'الإدارة' > 'المستخدمون' (/secretary/admin/users), as seen on the live portal (2026-11-16).
 *
 * List: search box "ابحث باسم المستخدم أو الاسم الكامل أو البريد…", status filter (combobox "حالة الحساب": 'المفعّل وغير
 * المفعّل', 'المفعّل فقط', 'غير المفعّل فقط', 'الحسابات المُزالة'); cells carry data-column="userName|fullName|email|state".
 * Clicking a row opens the user's page (?user=<id>): 'تعديل البيانات', 'إيقاف' / 'تفعيل' (each asks to confirm),
 * 'إيقاف وإزالة من القوائم', 'إعادة تعيين كلمة المرور', tabs 'البيانات' / 'الصلاحيات'.
 *
 * 'مستخدم جديد' dialog: #user-person (person picker with a search box "شخص في الجهات"; a person who already has a user is
 * not offered), #user-name, #user-full-name and #user-email (filled from the person), #user-department, #user-template
 * (role; a disabled template is not offered), #user-copy-from, #user-two-factor (OTP switch, off by default),
 * #user-expires-at, 'إنشاء المستخدم'. After creating, a dialog 'كلمة المرور المؤقتة' shows the one-time password ('تم').
 */
export class UsersPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly newUserButton = this.page.getByRole('button', { name: 'مستخدم جديد' });
  readonly searchBox = this.page.getByPlaceholder('ابحث باسم المستخدم أو الاسم الكامل أو البريد…');
  readonly statusFilter = this.page.getByRole('combobox', { name: 'حالة الحساب' });
  readonly rows = this.page.locator('tbody tr').filter({ has: this.page.locator('[data-column="userName"]') });
  readonly noResults = this.page.getByText('لا توجد حسابات مطابقة');
  readonly dialog = this.page.getByRole('dialog');

  // The 'مستخدم جديد' dialog
  readonly personPicker = this.page.locator('#user-person');
  readonly personSearch = this.page.getByPlaceholder('شخص في الجهات');
  readonly userName = this.page.locator('#user-name');
  readonly fullName = this.page.locator('#user-full-name');
  readonly email = this.page.locator('#user-email');
  readonly roleSelect = this.page.locator('#user-template');
  readonly twoFactorSwitch = this.page.locator('#user-two-factor');
  readonly createButton = this.page.getByRole('button', { name: 'إنشاء المستخدم' });
  readonly temporaryPasswordDialog = this.page.getByRole('dialog').filter({ hasText: 'كلمة المرور المؤقتة' });

  // A user's page
  readonly backToList = this.page.getByRole('button', { name: 'العودة إلى المستخدمين' });
  readonly deactivateButton = this.page.getByRole('button', { name: 'إيقاف', exact: true });
  readonly activateButton = this.page.getByRole('button', { name: 'تفعيل', exact: true });

  async open(): Promise<void> {
    await this.visit('/secretary/admin/users');
    await expect(this.newUserButton).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  // ------------------------------------------------------- List -------------------------------------------------------

  /**
   * Types in the search box and waits until the list has settled on it: rows or "لا توجد حسابات مطابقة". The screen may
   * answer from what it already loaded (no request), so the server's answer is waited for briefly, not required.
   */
  async search(text: string): Promise<void> {
    await this.settle(() => this.searchBox.fill(text));
    await expect(this.searchBox).toHaveValue(text);
  }

  /** Picks a status in 'حالة الحساب', e.g. 'غير المفعّل فقط'. */
  async filterStatus(label: string): Promise<void> {
    await this.statusFilter.click();
    await this.settle(() => this.page.getByRole('option', { name: label, exact: true }).click());
    await expect(this.statusFilter).toContainText(label);
  }

  /** Runs a change of the list and waits until the list shows its result. */
  private async settle(change: () => Promise<void>): Promise<void> {
    const answered = this.waitForList(5_000).catch(() => undefined);
    await change();
    await answered;
    await expect(this.rows.first().or(this.noResults).first()).toBeVisible();
  }

  /** The row of a user, by its exact user name. */
  row(userName: string): Locator {
    return this.rows.filter({ has: this.page.locator('[data-column="userName"]').getByText(userName, { exact: true }) });
  }

  /** The user names the list shows now. */
  async listedUserNames(): Promise<string[]> {
    return (await this.rows.locator('[data-column="userName"]').allInnerTexts()).map((name) => name.trim());
  }

  /** Searches for the user and opens its page. */
  async openUser(userName: string): Promise<void> {
    await this.search(userName);
    await this.row(userName).locator('[data-column="fullName"]').click();
    await expect(this.backToList).toBeVisible();
  }

  private waitForList(timeout?: number): Promise<unknown> {
    return this.page.waitForResponse((answer) => /\/api\/acm\/users\?/.test(answer.url()) && answer.request().method() === 'GET', { timeout });
  }

  // ------------------------------------------------- 'مستخدم جديد' --------------------------------------------------

  async openNewUserDialog(): Promise<void> {
    await this.newUserButton.click();
    await expect(this.personPicker).toBeVisible();
  }

  /** The persons the picker offers for a search text (the dialog must be open; the picker is closed again). */
  async personOptions(text: string): Promise<string[]> {
    await this.personPicker.click();
    await this.personSearch.fill(text);
    // The picker filters as it is typed: wait until it settled on the text
    await expect.poll(async () => (await this.page.getByRole('option').allInnerTexts()).every((option) => option.includes(text) || !option)).toBe(true);
    const options = (await this.page.getByRole('option').allInnerTexts()).map((option) => option.trim()).filter(Boolean);
    await this.page.keyboard.press('Escape');
    return options;
  }

  async pickPerson(name: string): Promise<void> {
    await this.personPicker.click();
    await this.personSearch.fill(name);
    await this.page.getByRole('option', { name, exact: true }).click();
    await expect(this.fullName).toHaveValue(name);
  }

  /** The role templates 'دور المستخدم' offers (the picker is closed again). */
  async roleOptions(): Promise<string[]> {
    await this.roleSelect.click();
    // The list opens with 'بدون قالب' first and the templates as they load: wait for more than that one
    await expect.poll(() => this.page.getByRole('option').count(), { message: "the role templates of 'دور المستخدم'" }).toBeGreaterThan(1);
    const options = (await this.page.getByRole('option').allInnerTexts()).map((option) => option.trim());
    await this.page.keyboard.press('Escape');
    return options;
  }

  async chooseRole(name: string): Promise<void> {
    await this.roleSelect.click();
    await this.page.getByRole('option', { name, exact: true }).first().click();
    await expect(this.roleSelect).toContainText(name);
  }

  /** Clicks 'إنشاء المستخدم' and waits for the server's answer; returns its HTTP status. */
  async submitNewUser(): Promise<number> {
    return (await this.submitNewUserAnswer()).status;
  }

  /** Clicks 'إنشاء المستخدم'; returns the server's answer: its status and the temporary password it made. */
  async submitNewUserAnswer(): Promise<{ status: number; temporaryPassword?: string }> {
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/users$/.test(new URL(answer.url()).pathname) && answer.request().method() === 'POST'),
      this.createButton.click(),
    ]);
    const body = (await response.json().catch(() => ({}))) as { value?: { temporaryPassword?: string } };
    return { status: response.status(), temporaryPassword: body.value?.temporaryPassword };
  }

  /**
   * Checks the 'كلمة المرور المؤقتة' dialog shows the password the server made (its format is not assumed) and closes
   * it with 'تم'.
   */
  async takeTemporaryPassword(expected: string): Promise<string> {
    await expect(this.temporaryPasswordDialog).toBeVisible();
    await expect(this.temporaryPasswordDialog, 'the dialog should show the temporary password').toContainText(expected);
    await this.temporaryPasswordDialog.getByRole('button', { name: 'تم', exact: true }).click();
    await expect(this.temporaryPasswordDialog).toBeHidden();
    return expected;
  }

  /**
   * The whole 'مستخدم جديد' flow: person, user name, role, and 'إنشاء المستخدم'. Checks that OTP stays off and that no
   * one-time code is asked while creating. Returns the temporary password.
   */
  async createUser({ person, userName, role }: { person: string; userName: string; role: string }): Promise<string> {
    await this.openNewUserDialog();
    await this.pickPerson(person);
    await this.userName.fill(userName);
    await this.chooseRole(role);
    await expect(this.twoFactorSwitch, 'OTP should be off by default').toHaveAttribute('aria-checked', 'false');
    const answer = await this.submitNewUserAnswer();
    expect(answer.status, 'the server should create the user').toBeLessThan(300);
    expect(answer.temporaryPassword, 'the server should make a temporary password').toBeTruthy();
    return this.takeTemporaryPassword(answer.temporaryPassword as string);
  }

  // ---------------------------------------------------- A user's page -----------------------------------------------

  /** A value of the 'البيانات' tab, by its label, e.g. detailValue('الحالة') -> 'مُفعّل'. */
  async detailValue(label: string): Promise<string> {
    const text = await this.page.locator('main').innerText();
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\n([^\\n]+)`))?.[1]?.trim() ?? '';
  }

  async expectDetail(label: string, value: string | RegExp): Promise<void> {
    await expect.poll(() => this.detailValue(label), { message: `'${label}' on the user's page` }).toMatch(value instanceof RegExp ? value : new RegExp(`^${value}$`));
  }

  /** 'إيقاف' on the user's page, confirmed. */
  async deactivate(): Promise<void> {
    await this.deactivateButton.click();
    await this.confirm('إيقاف');
    await expect(this.activateButton).toBeVisible();
  }

  /** 'تفعيل' on the user's page, confirmed. */
  async activate(): Promise<void> {
    await this.activateButton.click();
    await this.confirm('تفعيل');
    await expect(this.deactivateButton).toBeVisible();
  }

  private async confirm(action: string): Promise<void> {
    const confirmDialog = this.page.getByRole('dialog').filter({ hasText: `${action} ` });
    await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/users\/\d+\/status$/.test(answer.url()) && answer.request().method() === 'PUT'),
      confirmDialog.getByRole('button', { name: action, exact: true }).click(),
    ]);
  }
}

/** Status texts of a user (the portal writes them with a damma: 'مُفعّل'; the sheet writes 'مفعّل' / 'معطّل'). */
export const userStatus = {
  active: /^مُ?فعّل$/,
  inactive: /^غير مُ?فعّل$/,
} as const;
