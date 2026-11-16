import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * /login - the sign-in form, and /login/password - the first-use form that replaces a temporary password.
 * Locators seen on the live portal (2026-11-16): the form has ids, the language button is labelled
 * "تغيير اللغة" in Arabic and "Change language" in English.
 */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly username = this.page.locator('#userName');
  readonly password = this.page.locator('#password');
  readonly submit = this.page.locator('form button[type="submit"]');
  readonly languageButton = this.page.getByRole('button', { name: /^(تغيير اللغة|Change language)$/ });
  /** The error under the form, e.g. "اسم المستخدم أو كلمة المرور غير صحيحة." */
  readonly alert = this.page.getByRole('alert');
  /** Shown instead of signing in when the password is a temporary one. */
  readonly chooseNewPasswordLink = this.page.getByText('اختر كلمة مرور جديدة', { exact: true }).first();

  // /login/password (first use)
  readonly firstUseUserName = this.page.locator('#firstUseUserName');
  readonly firstUseCurrentPassword = this.page.locator('#firstUseCurrentPassword');
  readonly firstUseNewPassword = this.page.locator('#firstUseNewPassword');
  readonly firstUseConfirmPassword = this.page.locator('#firstUseConfirmPassword');
  readonly firstUseSubmit = this.page.getByRole('button', { name: 'حفظ كلمة المرور وتسجيل الدخول' });

  async open(): Promise<void> {
    await this.visit('/login');
    await expect(this.username).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** Fills the form and clicks 'تسجيل الدخول', waiting for the server's answer (not for a fixed time). */
  async signIn(username: string, password: string): Promise<number> {
    await this.username.fill(username);
    await this.password.fill(password);
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/auth/login') && answer.request().method() === 'POST'),
      this.submit.click(),
    ]);
    return response.status();
  }

  async expectOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login(\?|$)/);
    await expect(this.username).toBeVisible();
  }

  /** Opens a page of the system as a signed-out visitor would, and expects the sign-in form instead. */
  async expectRouteRedirectsToLogin(routePath: string): Promise<void> {
    await this.visit(routePath);
    await this.expectOnLoginPage();
  }

  /** Fills the first-use form (the user name is prefilled when it came from the sign-in form) and saves. */
  async chooseNewPassword(username: string, temporaryPassword: string, newPassword: string): Promise<void> {
    await expect(this.firstUseCurrentPassword).toBeVisible();
    if (!(await this.firstUseUserName.inputValue())) {
      await this.firstUseUserName.fill(username);
    }
    await this.firstUseCurrentPassword.fill(temporaryPassword);
    await this.firstUseNewPassword.fill(newPassword);
    await this.firstUseConfirmPassword.fill(newPassword);
    await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/auth/password/first-use')),
      this.firstUseSubmit.click(),
    ]);
  }
}
