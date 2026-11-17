import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { answerStatus } from '../../utils/core/answer-status';
import { actionTimeout, acmTimeouts } from '../../config/timeouts';

/**
 * 'الجهات' (/secretary/addressbook), as seen on the live portal (2026-11-16).
 *
 * Top: 'شخص جديد', 'جهة جديدة', 'تعديل' and 'حذف' (both act on the selected node, disabled until one is selected),
 * 'إلغاء التحديد', the search box "ابحث في الجهات والأشخاص…". The tree (ul role=tree "الجهات والأشخاص") has one
 * li role=treeitem per entity or person, holding a button with its name (and 'توسيع' for its children). A selected
 * node shows its details beside the tree: its type ('داخلى' / 'خارجى'), 'الكود', 'البريد الإلكتروني', 'الهاتف', #<id>.
 *
 * The dialog ('جهة جديدة' / 'شخص جديد', or 'تعديل'): 'نوع السجل' ('شخص' / 'جهة'), #ab-name ('اسم الجهة' /
 * 'اسم الشخص'), #ab-parent ('تابعة لـ' / 'الجهة' - preset to the selected node), #ab-type ('نوع الجهة', entities only),
 * #ab-code, #ab-contact, #ab-email, #ab-phone, #ab-fax, #ab-manager ('مدير الجهة', persons only); 'إنشاء'.
 */
export class EntitiesPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly newEntityButton = this.page.getByRole('button', { name: 'جهة جديدة', exact: true });
  readonly newPersonButton = this.page.getByRole('button', { name: 'شخص جديد', exact: true });
  readonly editButton = this.page.locator('main').getByRole('button', { name: 'تعديل', exact: true }).first();
  readonly deleteButton = this.page.locator('main').getByRole('button', { name: 'حذف', exact: true }).first();
  readonly clearSelectionButton = this.page.getByRole('button', { name: 'إلغاء التحديد', exact: true });
  readonly searchInput = this.page.getByPlaceholder('ابحث في الجهات والأشخاص…').first();
  readonly tree = this.page.getByRole('tree', { name: 'الجهات والأشخاص' });
  readonly dialog = this.page.getByRole('dialog');

  async open(): Promise<void> {
    await this.visit('/secretary/addressbook');
    await expect(this.newEntityButton).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** Creates an entity: a main one (no parent) or a sub-entity of `parentName`. */
  async createEntity(entity: { name: string; type?: 'internal' | 'external'; parentName?: string; email?: string }): Promise<void> {
    await this.prepareParent(entity.parentName);
    await this.newEntityButton.click();
    await expect(this.dialog.locator('#ab-name')).toBeVisible();
    await this.dialog.locator('#ab-name').fill(entity.name);
    if (entity.type) {
      await this.dialog.locator('#ab-type').click();
      await this.page.getByRole('option', { name: entity.type === 'external' ? /خارج/ : /داخل/ }).first().click();
    }
    if (entity.email) {
      await this.dialog.locator('#ab-email').fill(entity.email);
    }
    await this.save();
  }

  /** Registers a person under an entity. */
  async createPerson(person: { name: string; entityName: string; email: string }): Promise<void> {
    await this.prepareParent(person.entityName);
    await this.newPersonButton.click();
    await expect(this.dialog.locator('#ab-name')).toBeVisible();
    await this.dialog.locator('#ab-name').fill(person.name);
    await this.dialog.locator('#ab-email').fill(person.email);
    await expect(this.dialog.locator('#ab-parent'), 'the person is added under the selected entity').toContainText(person.entityName);
    await this.save();
  }

  /** Opens 'جهة جديدة' (under `parentName`, or as a main entity) without filling it. */
  async openNewEntity(parentName?: string): Promise<void> {
    await this.prepareParent(parentName);
    await this.newEntityButton.click();
    await expect(this.dialog.locator('#ab-name')).toBeVisible();
  }

  /** Opens 'شخص جديد' under an entity without filling it. */
  async openNewPerson(entityName: string): Promise<void> {
    await this.prepareParent(entityName);
    await this.newPersonButton.click();
    await expect(this.dialog.locator('#ab-name')).toBeVisible();
  }

  /**
   * 'إنشاء' of the open dialog when its data may be refused: returns the server's answer status, or undefined when the
   * form refused it before sending (the dialog then stays open with its messages).
   */
  async trySave(): Promise<number | undefined> {
    const response = this.page
      .waitForResponse((answer) => /\/api\/acm\/addressbook(\/\d+)?$/.test(new URL(answer.url()).pathname) && ['POST', 'PUT'].includes(answer.request().method()), { timeout: 5_000 })
      .catch(() => undefined);
    await this.dialog.getByRole('button', { name: /^(إنشاء|حفظ)$/ }).last().click();
    const answer = await response;
    return answer ? answerStatus(answer) : undefined;
  }

  /** The messages the open dialog shows (validation under its fields, or the server's refusal). */
  async dialogMessages(): Promise<string> {
    const alerts = await this.dialog.getByRole('alert').allInnerTexts().catch(() => [] as string[]);
    const marked = await this.dialog.locator('[aria-invalid="true"] ~ *, .text-destructive, [data-slot="form-message"]').allInnerTexts().catch(() => [] as string[]);
    const toasts = await this.page.locator('[data-sonner-toast]').allInnerTexts().catch(() => [] as string[]);
    return [...alerts, ...marked, ...toasts].join(' | ');
  }

  /** The name button of a node, by its exact name (to find a node inside another one). */
  nameButton(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  /** A node of the tree, by its exact name. */
  node(name: string): Locator {
    return this.page.getByRole('treeitem').filter({ has: this.page.getByRole('button', { name, exact: true }) }).last();
  }

  /** Selects a node (finding it with the search box first, the tree is long) and waits for its details. */
  async select(name: string): Promise<void> {
    await this.search(name);
    // The tree is drawn again as the search settles, so a click can land on a node that is being replaced: click
    // until the node is selected ('إلغاء التحديد' appears with its details; the id #770 is wrapped in direction marks)
    await expect(async () => {
      await this.node(name).getByRole('button', { name, exact: true }).click();
      await expect(this.clearSelectionButton).toBeVisible({ timeout: 2_000 });
      await expect(this.page.locator('main').getByText(/#\s*\d+/).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: acmTimeouts.pageLoad });
  }

  /** The details of the selected node, as text (its type, code, e-mail, ...). */
  details(): Locator {
    return this.page.locator('main');
  }

  /** Types in the search box and waits until the tree shows a node that contains the text (or says nothing matches). */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(this.tree.getByRole('button', { name: new RegExp(escaped) }).first().or(this.page.getByText(/لا توجد|لا نتائج|لا يوجد/).first()).first()).toBeVisible();
  }

  /** Renames a node with 'تعديل'. */
  async editNode(currentName: string, newName: string): Promise<void> {
    await this.select(currentName);
    await this.editButton.click();
    await expect(this.dialog.locator('#ab-name')).toHaveValue(currentName);
    await this.dialog.locator('#ab-name').fill(newName);
    await this.save();
  }

  /** Deletes a node with 'حذف' (and its confirmation). */
  async deleteNode(name: string): Promise<void> {
    await this.select(name);
    await this.deleteButton.click();
    const confirm = this.page.getByRole('alertdialog').or(this.dialog).getByRole('button', { name: /^(حذف|تأكيد|نعم)$/ }).last();
    await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/addressbook\/\d+$/.test(answer.url()) && answer.request().method() === 'DELETE'),
      confirm.click(),
    ]);
  }

  /** Selects the parent (so the dialog presets it), or clears the selection for a main entity. */
  private async prepareParent(parentName?: string): Promise<void> {
    if (parentName) {
      await this.select(parentName);
    } else if (await this.clearSelectionButton.isVisible().catch(() => false)) {
      await this.clearSelectionButton.click();
    }
  }

  /** 'إنشاء' (or the save of 'تعديل'), waiting for the server, and the dialog to close. */
  private async save(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/addressbook(\/\d+)?$/.test(new URL(answer.url()).pathname) && ['POST', 'PUT'].includes(answer.request().method())),
      this.dialog.getByRole('button', { name: /^(إنشاء|حفظ|حفظ التعديلات)$/ }).last().click(),
    ]);
    expect(response.ok(), `the address book entry should be saved: ${(await response.text()).slice(0, 200)}`).toBe(true);
    await expect(this.dialog).toBeHidden({ timeout: actionTimeout });
  }
}
