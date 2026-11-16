import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  get header() {
    return this.page.locator('header').first();
  }

  get navigationMenu() {
    return this.page.locator('nav, aside, .sidebar').first();
  }

  get notificationsButton() {
    return this.page.locator('[data-testid="notifications"], button:has-text("الإشعارات")').first();
  }

  get quickActionCorrespondence() {
    return this.page.locator('button:has-text("تسجيل مراسلة"), a:has-text("تسجيل مراسلة")').first();
  }

  get quickActionInternalMessage() {
    return this.page.locator('button:has-text("إرسال رسالة داخلية"), a:has-text("إرسال رسالة داخلية")').first();
  }

  async open(): Promise<void> {
    await this.visit('/');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.header).toBeVisible();
  }

  async openModule(name: string): Promise<void> {
    await this.page.locator(`text=${name}`).first().click();
  }
}
