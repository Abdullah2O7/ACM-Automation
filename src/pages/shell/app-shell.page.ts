import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * What every signed-in screen has: the top bar (language, account menu, notifications, global search) and the
 * navigation. Labels are matched in both languages, since TC002 switches to English.
 */
export class AppShell extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly header = this.page.locator('header').first();
  /** The account button shows the initials, the full name and the user name. */
  readonly accountButton = this.page.getByRole('button', { name: /^(الحساب|Account)$/ });
  readonly languageButton = this.page.getByRole('button', { name: /^(تغيير اللغة|Change language)$/ });
  readonly notificationsButton = this.page.getByRole('button', { name: /^(فتح الإشعارات|Open notifications)$/ });
  readonly globalSearchButton = this.page.getByRole('button', { name: /^(البحث في كل السجلات|Search everything)$/ });
  readonly navigation = this.page.locator('nav').first();

  /** Opens a route of the portal and waits for the signed-in shell. */
  async open(routePath = '/'): Promise<void> {
    await this.visit(routePath);
    await this.expectSignedIn();
  }

  async expectSignedIn(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/);
    await expect(this.accountButton).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  async signOut(): Promise<void> {
    await this.accountButton.click();
    await this.page.getByRole('menuitem', { name: /^(تسجيل الخروج|Sign out|Log out)$/ }).click();
  }

  /** The document's direction and language, as the portal sets them on <html>. */
  async direction(): Promise<{ dir: string; lang: string }> {
    return this.page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }));
  }

  /** The palette 'البحث في كل السجلات' opens. */
  readonly palette = this.page.getByRole('dialog');

  /**
   * Goes to a section through the 'البحث في كل السجلات' palette, which lists every screen and folder by name, e.g.
   * 'البريد الداخلي · المسودات', 'الصادر و الوارد · غير مصنّف', 'المهام · جديدة', 'الإدارة · سجل التدقيق'.
   */
  async goTo(section: string): Promise<void> {
    await this.globalSearchButton.click();
    await this.palette.getByRole('button', { name: section, exact: true }).click();
    await expect(this.palette).toBeHidden();
  }

  /**
   * Searches every record with the palette (seen live 2026-11-16): it asks the server as it is typed (POST /api/acm/search)
   * and lists the matching records as "مراسلة · <subject>"; its last entry "عرض كل نتائج «...»" repeats the typed text and is
   * not a result. Returns the record results once the server answered the whole text.
   */
  async searchEverything(text: string): Promise<Locator> {
    await this.globalSearchButton.click();
    await expect(this.palette).toBeVisible();
    const answered = this.page
      .waitForResponse((answer) => answer.url().includes('/api/acm/search') && (answer.request().postData() ?? '').includes(JSON.stringify(text).slice(1, -1)), { timeout: acmTimeouts.pageLoad })
      .catch(() => undefined);
    await this.page.keyboard.type(text);
    await answered;
    // Let the list draw the answer
    await expect(this.palette.getByRole('button').filter({ hasText: 'عرض كل نتائج' }).first()).toBeVisible();
    return this.palette.getByRole('button').filter({ hasText: text }).filter({ hasNotText: 'عرض كل نتائج' });
  }

  /** Opens 'الإشعارات' (the bell); returns the panel. */
  async openNotifications(): Promise<Locator> {
    await this.notificationsButton.click();
    const panel = this.page.locator('[data-radix-popper-content-wrapper], [role="dialog"]').filter({ hasText: 'تعليم الكل كمقروء' }).first();
    await expect(panel).toBeVisible();
    return panel;
  }

  /** The text of the navigation's links, e.g. ["اللوحة الرئيسية", "البريد الداخلي", ...]. */
  async navigationLabels(): Promise<string[]> {
    const labels = await this.navigation.getByRole('link').allInnerTexts();
    return labels.map((label) => label.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
}
