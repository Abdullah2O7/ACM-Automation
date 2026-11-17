import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { answerStatus } from '../../utils/core/answer-status';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'الإدارة' > 'الإعدادات' (/secretary/settings): 'استقبال البريد' (mailbox cards), 'هوية الجهة', 'الشعار',
 * 'البريد الخارجي (SMTP)', 'ملخص السجل اليومي', 'سجل الاستلام'.
 *
 * A mailbox card shows the user, the protocol, its status ('يستقبل' / 'متوقف'), server:port · SSL and, for the
 * password, only whether one is saved ('تم حفظ كلمة مرور التطبيق' / 'لا توجد كلمة مرور تطبيق محفوظة').
 */
export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly addMailboxButton = this.page.getByRole('button', { name: 'إضافة صندوق بريد' });
  readonly dialog = this.page.getByRole('dialog');
  readonly logoInput = this.page.locator('input[type="file"][accept*="image/png"]');

  async open(): Promise<void> {
    await this.visit('/secretary/settings');
    await expect(this.addMailboxButton).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** Fills 'إضافة صندوق بريد' (IMAP, SSL on by default) and saves it ("تم حفظ صندوق البريد"). */
  async addMailbox(mailbox: { host: string; port: number; userName: string; appPassword: string }): Promise<void> {
    await this.addMailboxButton.click();
    await expect(this.dialog.locator('#protocol')).toHaveText('IMAP');
    await this.dialog.locator('#host').fill(mailbox.host);
    await this.dialog.locator('#port').fill(String(mailbox.port));
    await this.dialog.locator('#userName').fill(mailbox.userName);
    await this.dialog.locator('#appPassword').fill(mailbox.appPassword);
    await this.dialog.locator('button[type="submit"]').click();
    await expect(this.page.getByText('تم حفظ صندوق البريد').first()).toBeVisible();
  }

  /**
   * The card of a mailbox: the innermost block holding its user name, its own 'تعديل' button and its password line
   * ('كلمة مرور التطبيق'). Blocks around it come first in the page, so the last match is the card itself.
   */
  mailboxCard(userName: string): Locator {
    return this.page
      .locator('main div')
      .filter({ hasText: userName })
      .filter({ hasText: 'كلمة مرور التطبيق' })
      .filter({ has: this.page.getByRole('button', { name: 'تعديل', exact: true }) })
      .last();
  }

  /** Opens 'تعديل' of a mailbox and gives the value its 'كلمة مرور التطبيق' field shows. */
  async appPasswordShownWhenEditing(userName: string): Promise<string> {
    await this.mailboxCard(userName).getByRole('button', { name: 'تعديل', exact: true }).click();
    const field = this.dialog.locator('#appPassword');
    await expect(field).toBeVisible();
    const shown = await field.inputValue();
    await this.dialog.getByRole('button', { name: 'إلغاء' }).click();
    return shown;
  }

  /** Chooses a file for 'استبدال الشعار' (the logo is sent as soon as it is chosen). */
  async chooseLogo(file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.logoInput.setInputFiles(file);
  }

  // 'هوية الجهة' (seen live 2026-11-16): Arabic and English of each value, saved with 'حفظ الهوية'
  // (PUT /settings/organization {name, alias, address}).
  readonly identityFields = {
    nameAr: this.page.locator('#organization-name-ar'),
    nameEn: this.page.locator('#organization-name-en'),
    aliasAr: this.page.locator('#organization-alias-ar'),
    aliasEn: this.page.locator('#organization-alias-en'),
    addressAr: this.page.locator('#organization-address-ar'),
    addressEn: this.page.locator('#organization-address-en'),
  };
  readonly saveIdentityButton = this.page.getByRole('button', { name: 'حفظ الهوية', exact: true });

  /** Saves 'هوية الجهة' (the same text in Arabic and English) and, when given, uploads 'الشعار'; returns the save's status. */
  async saveIdentity(identity: { name: string; shortName: string; address: string; logo?: { name: string; mimeType: string; buffer: Buffer } }): Promise<number> {
    const { nameAr, nameEn, aliasAr, aliasEn, addressAr, addressEn } = this.identityFields;
    await nameAr.fill(identity.name);
    await nameEn.fill(identity.name);
    await aliasAr.fill(identity.shortName);
    await aliasEn.fill(identity.shortName);
    await addressAr.fill(identity.address);
    await addressEn.fill(identity.address);
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/organization') && answer.request().method() === 'PUT'),
      this.saveIdentityButton.click(),
    ]);
    if (identity.logo) {
      await Promise.all([
        this.page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/organization/logo') && answer.request().method() !== 'GET'),
        this.chooseLogo(identity.logo),
      ]);
    }
    return answerStatus(response);
  }

  // 'البريد الخارجي (SMTP)' (seen live 2026-11-16): checkbox 'تفعيل الإرسال الخارجي', #dispatch-host, #dispatch-port,
  // #dispatch-security (combobox: STARTTLS ...), #dispatch-fromAddress, #dispatch-fromDisplayName, #dispatch-userName,
  // #dispatch-password ("كلمة المرور محفوظة. اترك الحقل فارغًا للاحتفاظ بها."), 'حفظ' (PUT /settings/dispatch),
  // 'بريد مستلم الاختبار' + 'إرسال بريد اختبار'.
  readonly smtpEnabled = this.page.getByLabel('تفعيل الإرسال الخارجي');
  readonly smtpTestRecipient = this.page.getByRole('textbox', { name: 'بريد مستلم الاختبار' });
  readonly smtpTestButton = this.page.getByRole('button', { name: 'إرسال بريد اختبار', exact: true });

  /** The SMTP section's own 'حفظ' (the page has others). */
  private smtpSaveButton(): Locator {
    return this.page
      .locator('main section, main form, main div')
      .filter({ has: this.page.locator('#dispatch-host') })
      .filter({ has: this.smtpTestButton })
      .last()
      .getByRole('button', { name: 'حفظ', exact: true });
  }

  /** Fills 'البريد الخارجي (SMTP)' with sending switched on and saves it; returns the save's status. */
  async configureSmtp(smtp: { host: string; port: number; encryption: string; senderEmail: string; senderName: string; user: string; pass: string }): Promise<number> {
    if (!(await this.smtpEnabled.isChecked())) {
      await this.smtpEnabled.check();
    }
    await this.page.locator('#dispatch-host').fill(smtp.host);
    await this.page.locator('#dispatch-port').fill(String(smtp.port));
    await this.page.locator('#dispatch-security').click();
    await this.page.getByRole('option', { name: new RegExp(smtp.encryption, 'i') }).first().click();
    await this.page.locator('#dispatch-fromAddress').fill(smtp.senderEmail);
    await this.page.locator('#dispatch-fromDisplayName').fill(smtp.senderName);
    await this.page.locator('#dispatch-userName').fill(smtp.user);
    if (smtp.pass) {
      await this.page.locator('#dispatch-password').fill(smtp.pass);
    }
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/dispatch') && answer.request().method() === 'PUT'),
      this.smtpSaveButton().click(),
    ]);
    return answerStatus(response);
  }

  /** 'إرسال بريد اختبار' to an address; returns the server's answer (status and message). */
  async sendSmtpTest(to: string): Promise<{ status: number; message: string }> {
    await this.smtpTestRecipient.fill(to);
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/dispatch') && answer.request().method() === 'POST'),
      this.smtpTestButton.click(),
    ]);
    const body = (await response.json().catch(() => ({}))) as { errorMessage?: string };
    return { status: await answerStatus(response), message: body.errorMessage ?? '' };
  }
}
