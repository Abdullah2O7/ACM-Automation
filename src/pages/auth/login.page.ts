import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  // Locators
  get usernameInput() {
    return this.page.locator('input[name="username"], input[type="text"]').first();
  }

  get passwordInput() {
    return this.page.locator('input[name="password"], input[type="password"]').first();
  }

  get submitButton() {
    return this.page.locator('button[type="submit"], button:has-text("تسجيل الدخول"), button:has-text("Login")').first();
  }

  get languageSwitcher() {
    return this.page.locator('button:has-text("تغيير اللغة"), [data-testid="lang-switch"], button:has-text("English"), button:has-text("العربية")').first();
  }

  get errorMessage() {
    return this.page.locator('.alert-danger, [role="alert"], .text-red-500, .error-message').first();
  }

  get userHeader() {
    return this.page.locator('header, [data-testid="user-profile"], .user-info').first();
  }

  async open(): Promise<void> {
    await this.visit('/');
  }

  async fillUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async login(username = process.env.ADMIN_USERNAME || 'admin', password = process.env.ADMIN_PASSWORD || ''): Promise<void> {
    await this.open();
    if (await this.usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.fillUsername(username);
      await this.fillPassword(password);
      await this.submit();
    }
  }

  async switchLanguage(): Promise<void> {
    await this.languageSwitcher.click();
  }

  async expectLoggedIn(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/i);
    await expect(this.userHeader).toBeVisible();
  }

  async expectInvalidCredentials(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
  }
}
