import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'الأرشيف' (/secretary/archive) - the folder hierarchy ('التسلسل الهرمي للحفظ'), as seen on the live portal (2026-11-16).
 *
 * - 'مجلد رئيسي جديد' opens an inline form (no dialog): 'اسم المجلد' (#cabinet-create-name), 'نموذج فهرسة المجلد
 *   الجديد' (combobox 'اختر نموذجًا'), 'إلغاء', 'إضافة' (disabled until a name is typed) -> POST /cabinets.
 * - Each folder is an li role=treeitem holding a button with its name, its template ('بدون نموذج فهرسة' when none) and
 *   its documents count; sub-folders are treeitems inside their parent's. On a folder: 'إضافة مجلد فرعي' (the same
 *   inline form under it), 'إعادة تسمية' (an inline text box labelled so, saved with Enter -> PUT /cabinets/{id}),
 *   'حذف المجلد' (confirmed in a dialog "حذف المجلد «<name>»؟" with 'حذف المجلد').
 */
export class ArchivePage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly newMainFolderButton = this.page.getByRole('button', { name: 'مجلد رئيسي جديد', exact: true });
  readonly folderName = this.page.locator('#cabinet-create-name');
  readonly addButton = this.page.locator('main').getByRole('button', { name: 'إضافة', exact: true });
  readonly renameBox = this.page.getByRole('textbox', { name: 'إعادة تسمية' });
  readonly dialog = this.page.getByRole('dialog');

  async open(): Promise<void> {
    await this.visit('/secretary/archive');
    await expect(this.newMainFolderButton).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** 'مجلد رئيسي جديد': a main folder. */
  async createMainFolder(name: string): Promise<void> {
    await this.newMainFolderButton.click();
    await this.fillAndAdd(name);
  }

  /** 'إضافة مجلد فرعي' of a folder: a sub-folder under it. */
  async createSubFolder(name: string, parentName: string): Promise<void> {
    await this.folderAction(parentName, 'إضافة مجلد فرعي');
    await this.fillAndAdd(name);
  }

  /** Opens 'إضافة مجلد فرعي' of a folder without filling it (the inline form: #cabinet-create-name, 'إضافة'). */
  async openNewSubFolder(parentName: string): Promise<void> {
    await this.folderAction(parentName, 'إضافة مجلد فرعي');
    await expect(this.folderName).toBeVisible();
  }

  /** 'إضافة' of the inline form when the name may be refused: the server's answer status, or undefined if nothing was sent. */
  async tryAdd(): Promise<number | undefined> {
    const response = this.page
      .waitForResponse((answer) => /\/api\/acm\/cabinets$/.test(new URL(answer.url()).pathname) && answer.request().method() === 'POST', { timeout: 5_000 })
      .catch(() => undefined);
    await this.addButton.click();
    return (await response)?.status();
  }

  /** A folder of the hierarchy, by its exact name (its button starts with the name, then its template and count). */
  folderNode(name: string): Locator {
    return this.page.getByRole('treeitem').filter({ has: this.folderButton(name) }).last();
  }

  /** The documents count beside a folder. */
  async documentsCount(folderName: string): Promise<number> {
    const text = (await this.folderButton(folderName).innerText()).replace(folderName, '');
    const digits = text.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).match(/\d+\s*$/)?.[0];
    expect(digits, `the documents count of '${folderName}'`).toBeTruthy();
    return Number(digits);
  }

  /** Whether a folder is shown nested inside another one. */
  childOf(parentName: string, childName: string): Locator {
    return this.folderNode(parentName).getByRole('treeitem').filter({ has: this.folderButton(childName) });
  }

  /** 'إعادة تسمية' of a folder, saved with Enter. */
  async renameFolder(currentName: string, newName: string): Promise<void> {
    await this.folderAction(currentName, 'إعادة تسمية');
    await expect(this.renameBox).toHaveValue(currentName);
    await this.renameBox.fill(newName);
    await this.saved('PUT', () => this.renameBox.press('Enter'));
    await expect(this.folderNode(newName)).toBeVisible();
  }

  /**
   * Links a folder to a template: the folder selected, 'إدارة المجلد' > 'نموذج الفهرسة' (#cabinet-template). Picking
   * the template saves it at once (PUT /cabinets/{id} with its archiveTemplateId) - the tab's 'حفظ' belongs to the access
   * rights below it.
   */
  async linkTemplate(folderName: string, templateName: string): Promise<void> {
    await this.folderButton(folderName).click();
    await this.page.getByRole('tab', { name: 'إدارة المجلد', exact: true }).click();
    const picker = this.page.locator('#cabinet-template');
    await picker.click();
    await this.saved('PUT', () => this.page.getByRole('option', { name: templateName, exact: true }).click());
    await expect(picker).toContainText(templateName);
    await this.page.getByRole('tab', { name: 'المستندات', exact: true }).click();
  }

  /**
   * The template a folder uses, as its 'إدارة المجلد' > 'نموذج الفهرسة' shows it ('اختر نموذجًا' when none). The tree
   * itself only says 'بدون نموذج فهرسة' for a folder without one, and nothing for a folder with one.
   */
  async folderTemplate(folderName: string): Promise<string> {
    await this.folderButton(folderName).click();
    await this.page.getByRole('tab', { name: 'إدارة المجلد', exact: true }).click();
    await expect(this.page.getByRole('heading', { name: folderName, exact: true })).toBeVisible();
    const text = (await this.page.locator('#cabinet-template').innerText()).trim();
    await this.page.getByRole('tab', { name: 'المستندات', exact: true }).click();
    return text;
  }

  /** 'حذف المجلد' of a folder, confirmed. */
  async deleteFolder(name: string): Promise<void> {
    await this.folderAction(name, 'حذف المجلد');
    const confirm = this.page.getByRole('alertdialog').or(this.dialog).filter({ hasText: name }).first();
    await expect(confirm).toBeVisible();
    await this.saved('DELETE', () => confirm.getByRole('button', { name: 'حذف المجلد', exact: true }).click());
  }

  private folderButton(name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page.getByRole('button', { name: new RegExp(`^${escaped}(\\s|$)`) });
  }

  /** Clicks an action of a folder ('إضافة مجلد فرعي', 'إعادة تسمية', 'حذف المجلد'); the actions show on hover. */
  private async folderAction(name: string, action: string): Promise<void> {
    const node = this.folderNode(name);
    await expect(node).toBeVisible();
    // A folder's own row is the first block of its treeitem (its sub-folders come after it)
    const row = node.locator(':scope > div').first();
    await row.hover();
    await row.getByRole('button', { name: action, exact: true }).click();
  }

  private async fillAndAdd(name: string): Promise<void> {
    await expect(this.folderName).toBeVisible();
    await this.folderName.fill(name);
    await this.saved('POST', () => this.addButton.click());
    await expect(this.folderNode(name)).toBeVisible();
  }

  /** Runs the action and waits for the server to answer the folder change. */
  private async saved(method: 'POST' | 'PUT' | 'DELETE', action: () => Promise<void>): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse((answer) => /\/api\/acm\/cabinets(\/\d+)?$/.test(new URL(answer.url()).pathname) && answer.request().method() === method),
      action(),
    ]);
    expect(response.ok(), `the folder change should be saved: ${(await response.text()).slice(0, 200)}`).toBe(true);
  }
}
