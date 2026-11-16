import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/** An index field as the sheet writes it: type 'نص', 'رقم', 'تاريخ', 'قائمة' (with its options) or 'نعم/لا'. */
export type IndexField = {
  name: string;
  type: 'نص' | 'رقم' | 'تاريخ' | 'قائمة' | 'نعم/لا';
  mandatory: boolean;
  options?: readonly string[];
};

/** The portal's data type for a sheet type: 'قائمة' and 'نعم/لا' are 'كود (قائمة)' lists, 'رقم' a whole number. */
const portalType: Record<IndexField['type'], string> = { نص: 'نص', رقم: 'رقم صحيح', تاريخ: 'تاريخ', قائمة: 'كود (قائمة)', 'نعم/لا': 'كود (قائمة)' };

/**
 * 'القوالب' (/secretary/templates), as seen on the live portal (2026-11-16).
 *
 * List: 'قالب جديد' and one card (a button) per template: its name, description, its fields count ("3 حقول فهرسة",
 * "حقل فهرسة واحد", "لا حقول فهرسة") and folders count ("مجلدان", "لا مجلدات"). 'قالب جديد' opens a dialog
 * ('اسم القالب' #new-template-name, 'الوصف' #new-template-description, 'إنشاء') and then the template's page.
 *
 * A template's page (/secretary/templates/<id>): 'رجوع', 'إضافة حقل', 'حفظ القالب' (enabled once changed), 'تعديل
 * القالب', 'حذف القالب'. Field N: 'التسمية' #f-N-label, 'النوع' #f-N-type (نص, كود (قائمة), تاريخ, رقم صحيح, رقم
 * عشري), 'أقصى طول' #f-N-maxlen, a list's options ('إضافة خيار'; option K: #f-N-optK-value, -ar, -en), 'إلزامي'
 * (checkbox). Folders are linked to a template from 'الأرشيف' > 'إدارة المجلد' (see ArchivePage.linkTemplate).
 */
export class TemplatesPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly newTemplateButton = this.page.getByRole('button', { name: 'قالب جديد', exact: true });
  readonly dialog = this.page.getByRole('dialog');
  readonly addFieldButton = this.page.getByRole('button', { name: 'إضافة حقل', exact: true });
  readonly saveButton = this.page.getByRole('button', { name: 'حفظ القالب', exact: true });
  readonly deleteButton = this.page.getByRole('button', { name: 'حذف القالب', exact: true });
  readonly backButton = this.page.getByRole('button', { name: 'رجوع', exact: true });

  async open(): Promise<void> {
    await this.visit('/secretary/templates');
    await expect(this.newTemplateButton).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /**
   * 'قالب جديد' with its fields ('حفظ القالب'). `folders` are linked from the archive, not here: the caller links them
   * (ArchivePage.linkTemplate). Ends on the template's page.
   */
  async createTemplate(template: { name: string; description?: string; fields: readonly IndexField[] }): Promise<void> {
    await this.newTemplateButton.click();
    await this.dialog.locator('#new-template-name').fill(template.name);
    if (template.description) {
      await this.dialog.locator('#new-template-description').fill(template.description);
    }
    await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/templates$/.test(new URL(answer.url()).pathname) && answer.request().method() === 'POST'),
      this.dialog.getByRole('button', { name: 'إنشاء', exact: true }).click(),
    ]);
    await expect(this.addFieldButton).toBeVisible();
    for (const field of template.fields) {
      await this.addField(field);
    }
    if (template.fields.length) {
      await this.save();
    }
  }

  /** Opens a template's page from the list. */
  async openTemplate(name: string): Promise<void> {
    await this.templateCard(name).click();
    await expect(this.addFieldButton).toBeVisible();
    await expect(this.page.locator('main')).toContainText(name);
  }

  /** Adds a field on the open template's page (not saved yet). */
  async addField(field: IndexField): Promise<void> {
    const before = await this.fieldLabels().count();
    await this.addFieldButton.click();
    await expect(this.fieldLabels()).toHaveCount(before + 1);
    // The new field is the last; its inputs share its id's prefix (f-3-label, f-3-type ... - a saved template numbers
    // its fields its own way, so the prefix is read, not assumed)
    const prefix = ((await this.fieldLabels().last().getAttribute('id')) ?? '').replace(/-label$/, '');
    const id = (part: string): Locator => this.page.locator(`#${prefix}-${part}`);
    await id('label').fill(field.name);
    await id('type').click();
    await this.page.getByRole('option', { name: portalType[field.type], exact: true }).click();
    await expect(id('type')).toHaveText(portalType[field.type]);
    const options = field.type === 'نعم/لا' ? ['نعم', 'لا'] : [...(field.options ?? [])];
    for (const [order, value] of options.entries()) {
      await this.page.getByRole('button', { name: 'إضافة خيار', exact: true }).last().click();
      await id(`opt${order}-value`).fill(value);
      await id(`opt${order}-ar`).fill(value);
      await id(`opt${order}-en`).fill(value);
    }
    if (field.mandatory) {
      const mandatory = this.mandatoryOf(before);
      await mandatory.click();
      await expect(mandatory).toHaveAttribute('data-state', 'checked');
    }
  }

  /**
   * The 'التسمية' inputs of the template's fields, in their order: the inputs whose id ends in '-label' (a list's
   * options have inputs named 'التسمية بالعربية' / 'بالإنجليزية' too, with ids ending in -ar / -en).
   */
  fieldLabels(): Locator {
    return this.page.locator('main input[id$="-label"]');
  }

  /** The 'النوع' pickers of the template's fields, in their order. */
  fieldTypes(): Locator {
    return this.page.locator('main').getByRole('combobox', { name: 'النوع', exact: true });
  }

  /** The 'إلزامي' checkbox of the field at a position (0 = first). */
  mandatoryOf(position: number): Locator {
    return this.fieldLabels().nth(position).locator('xpath=ancestor::*[.//button[@role="checkbox"]][1]').getByRole('checkbox').first();
  }

  /** 'حفظ القالب', waiting for the server (PUT /templates/{id}/fields). */
  async save(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/templates\/\d+\/fields$/.test(answer.url()) && answer.request().method() === 'PUT'),
      this.saveButton.click(),
    ]);
    expect(response.ok(), `the template should be saved: ${(await response.text()).slice(0, 200)}`).toBe(true);
  }

  /** Opens a template, adds a field and saves. */
  async addFieldToTemplate(templateName: string, field: IndexField): Promise<void> {
    await this.open();
    await this.openTemplate(templateName);
    await this.addField(field);
    await this.save();
  }

  /** 'حذف القالب' of a template, confirmed. */
  async deleteTemplate(name: string): Promise<void> {
    await this.open();
    await this.openTemplate(name);
    await this.deleteButton.click();
    const confirm = this.page.getByRole('alertdialog').or(this.dialog).first();
    await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/templates\/\d+$/.test(answer.url()) && answer.request().method() === 'DELETE'),
      confirm.getByRole('button', { name: /^(حذف|حذف القالب|تأكيد)$/ }).last().click(),
    ]);
  }

  /** A template's card in the list, by its exact name (the card's text starts with it). */
  templateCard(name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page.locator('main').getByRole('button', { name: new RegExp(`^${escaped}(\\s|$)`) }).first();
  }

}
