import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { answerStatus } from '../../utils/core/answer-status';
import { acmTimeouts } from '../../config/timeouts';

/**
 * The correspondence form, as seen on the live portal (2026-11-16). Two screens share it:
 *
 * - 'الصادر و الوارد' > 'إنشاء' (/secretary/register/new): 'الاتجاه' (#directionId: وارد, صادر, تعميمات), 'النوع'
 *   (#typeId: بريد الكترونى, فاكس, خطاب), 'الرقم المرجعي' (#documentNumber, read-only "— يُسند عند التسجيل —"),
 *   'الرقم المرجعي للجهة' (#referenceNo), 'تاريخ المراسلة' (#date, يوم/شهر/سنة), the party (#correspondent: labelled
 *   'الجهة المستقبِلة', and 'الجهة المرسِلة' once 'وارد' is chosen), 'الموضوع' (#subject), 'النص' (#body, a rich
 *   editor), 'ملاحظات داخلية' (#notes), 'وضع علامة سرّي', attachments (input[type=file], "PDF والصور وملفات أوفيس حتى ٢٥
 *   ميجابايت لكل ملف"). Buttons: 'تجاهل', 'حفظ كمسودة', 'إرسال'. Sent: toast "تم تسجيل المراسلة #<id>" and the record
 *   opens (?focus=<id>).
 * - 'البريد الداخلي' > 'رسالة جديدة' (/correspondence/compose): the same without the routing part; recipients in #to.
 *
 * An empty mandatory field shows 'حقل مطلوب' by its label and "هذا الحقل مطلوب." under it.
 */
export class CorrespondenceFormPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly direction = this.page.locator('#directionId');
  readonly type = this.page.locator('#typeId');
  readonly documentNumber = this.page.locator('#documentNumber');
  readonly date = this.page.locator('#date');
  /** The party of the register form ('الجهة المستقبِلة' / 'الجهة المرسِلة'). */
  readonly correspondent = this.page.locator('#correspondent');
  /** The recipients of an internal message ('إلى'). */
  readonly to = this.page.locator('#to');
  readonly subject = this.page.locator('#subject');
  readonly body = this.page.locator('#body');
  readonly notes = this.page.locator('#notes');
  readonly secretCheckbox = this.page.locator('main').getByRole('checkbox').first();
  readonly fileInput = this.page.locator('main input[type="file"]');
  readonly sendButton = this.page.getByRole('button', { name: 'إرسال', exact: true });
  readonly draftButton = this.page.getByRole('button', { name: 'حفظ كمسودة', exact: true });
  readonly discardButton = this.page.getByRole('button', { name: 'تجاهل', exact: true });
  /** "هذا الحقل مطلوب." under each empty mandatory field. */
  readonly requiredMessages = this.page.locator('main').getByText('هذا الحقل مطلوب.', { exact: true });
  readonly pickerSearch = this.page.getByPlaceholder('ابحث في الجهات والأشخاص…');

  /** 'الصادر و الوارد' > 'إنشاء'. */
  async open(): Promise<void> {
    await this.visit('/secretary/register/new');
    await expect(this.subject).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** 'البريد الداخلي' > 'رسالة جديدة'. */
  async openCompose(): Promise<void> {
    await this.visit('/correspondence/compose');
    await expect(this.subject).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** The values 'النوع' offers, in the order it shows them. */
  async typeOptions(): Promise<string[]> {
    await this.type.click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const texts = (await options.allInnerTexts()).map((text) => text.trim());
    await this.page.keyboard.press('Escape');
    return texts;
  }

  async chooseDirection(label: string): Promise<void> {
    await this.direction.click();
    await this.page.getByRole('option', { name: label, exact: true }).click();
    await expect(this.direction).toHaveText(label);
  }

  async chooseType(label: string): Promise<void> {
    await this.type.click();
    await this.page.getByRole('option', { name: label, exact: true }).click();
    await expect(this.type).toHaveText(label);
  }

  /** Picks an address book entry in a recipient picker (the register's party, or 'إلى' of an internal message). */
  async pickRecipient(name: string, picker: Locator = this.correspondent): Promise<void> {
    await picker.click();
    await this.pickerSearch.fill(name);
    // An option shows the name, then its entity and e-mail: match the name at its start
    const option = this.page.getByRole('option').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}`) }).first();
    await option.click();
    // A multi-recipient picker stays open after a pick: close it
    if (await this.pickerSearch.isVisible()) {
      await this.page.keyboard.press('Escape');
    }
    await expect(this.page.locator('main')).toContainText(name);
  }

  /** The dialog 'اضافة جهة' opens from the form (TC100 / TC101: name, e-mail, 'إضافة واختيار', 'إلغاء'). */
  readonly newEntityDialog = this.page.getByRole('dialog');

  /** 'اضافة جهة' of the form: opens the new-entity dialog. */
  async openAddEntity(): Promise<void> {
    await this.page.locator('main').getByRole('button', { name: /^(اضافة|إضافة) جهة$/ }).first().click();
    await expect(this.newEntityDialog).toBeVisible();
  }

  /** Fills the new-entity dialog (by its fields' labels) - empty strings leave a field empty. */
  async fillNewEntity(entity: { name: string; email: string }): Promise<void> {
    await this.newEntityDialog.getByLabel(/الاسم|اسم الجهة/).first().fill(entity.name);
    await this.newEntityDialog.getByLabel(/البريد/).first().fill(entity.email);
  }

  /** 'إضافة واختيار' of the new-entity dialog; returns the server's answer status, or undefined when the form refused it. */
  async addAndChoose(): Promise<number | undefined> {
    const response = this.page
      .waitForResponse((answer) => /\/api\/acm\/addressbook/.test(answer.url()) && answer.request().method() === 'POST', { timeout: 5_000 })
      .catch(() => undefined);
    await this.newEntityDialog.getByRole('button', { name: 'إضافة واختيار', exact: true }).click();
    const answer = await response;
    return answer ? answerStatus(answer) : undefined;
  }

  async fillBody(text: string): Promise<void> {
    await this.body.click();
    await this.page.keyboard.type(text);
    await expect(this.body).toContainText(text);
  }

  async markSecret(): Promise<void> {
    await this.secretCheckbox.click();
    await expect(this.secretCheckbox).toHaveAttribute('data-state', 'checked');
  }

  /** Adds files with the attachments' file input, and waits until each is listed on the form. */
  async attach(...files: string[]): Promise<void> {
    await this.fileInput.setInputFiles(files);
  }

  /** The attachment entry of a file on the form, by its file name. */
  attachment(fileName: string): Locator {
    return this.page.locator('main').getByText(fileName, { exact: false }).first();
  }

  /** Fills the register form ('الصادر و الوارد' > 'إنشاء'). The date defaults to today. */
  async fillRegister(record: { direction: string; type: string; correspondent: string; subject: string; body: string; date?: string }): Promise<void> {
    await this.chooseDirection(record.direction);
    await this.chooseType(record.type);
    if (record.date) {
      await this.date.fill(record.date);
    } else if (!(await this.date.inputValue())) {
      const now = new Date();
      await this.date.fill(`${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
    }
    await this.pickRecipient(record.correspondent);
    await this.subject.fill(record.subject);
    await this.fillBody(record.body);
  }

  /** Fills an internal message ('البريد الداخلي' > 'رسالة جديدة'). */
  async fillMessage(message: { to: string[]; subject: string; body: string }): Promise<void> {
    for (const recipient of message.to) {
      await this.pickRecipient(recipient, this.to);
    }
    await this.subject.fill(message.subject);
    await this.fillBody(message.body);
  }

  /** Clicks 'إرسال' and returns the document id the server gave (POST /api/acm/correspondence), or the error status. */
  async send(): Promise<{ status: number; documentId?: number; error?: string }> {
    return this.submit(this.sendButton);
  }

  /** Clicks 'حفظ كمسودة' and returns the draft's document id. */
  async saveDraft(): Promise<{ status: number; documentId?: number; error?: string }> {
    return this.submit(this.draftButton);
  }

  /**
   * Clicks the button and returns the server's answer. The register form sends in one call (POST /correspondence); an
   * internal message is saved as a draft first, then sent (POST /correspondence/{id}/send) - 'إرسال' on the compose
   * screen waits for that second call and returns its status.
   */
  private async submit(button: Locator): Promise<{ status: number; documentId?: number; error?: string }> {
    const sendsInTwoSteps = button === this.sendButton && this.page.url().includes('/correspondence/compose');
    const sent = sendsInTwoSteps
      ? this.page.waitForResponse((answer) => /\/api\/acm\/correspondence\/\d+\/send$/.test(new URL(answer.url()).pathname) && answer.request().method() === 'POST')
      : undefined;
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/correspondence(\/\d+)?$/.test(new URL(answer.url()).pathname) && ['POST', 'PUT'].includes(answer.request().method())),
      button.click(),
    ]);
    const body = (await response.json().catch(() => ({}))) as { value?: number; errorMessage?: string };
    const documentId = typeof body.value === 'number' ? body.value : undefined;
    const status = await answerStatus(response);
    if (sent && status < 300) {
      const final = await sent;
      const finalBody = (await final.json().catch(() => ({}))) as { errorMessage?: string };
      return { status: await answerStatus(final), documentId, error: finalBody.errorMessage };
    }
    return { status, documentId, error: body.errorMessage };
  }

  /** Clicks 'إرسال' on an empty form: nothing is sent (no request), the form shows its messages. */
  async sendExpectingValidation(): Promise<boolean> {
    let sent = false;
    const watch = (request: { url: () => string; method: () => string }) => {
      if (/\/api\/acm\/correspondence$/.test(new URL(request.url()).pathname) && request.method() === 'POST') {
        sent = true;
      }
    };
    this.page.on('request', watch);
    await this.sendButton.click();
    await expect(this.requiredMessages.first()).toBeVisible();
    this.page.off('request', watch);
    return sent;
  }
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
