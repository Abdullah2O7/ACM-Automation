import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { acmTimeouts } from '../../config/timeouts';

/**
 * 'الإدارة' > 'المستخدمون' > 'قوالب الأدوار' (/secretary/admin/users/role-templates). The list: الكود, الاسم,
 * الصلاحيات (a count), الحالة ('مفعّل' / 'معطّل'); 'قالب جديد' opens a dialog with #template-code, #template-name-ar,
 * #template-name-en, #template-description, a switch 'معطّل — لا يمكن تطبيقه' and one checkbox per permission
 * (id `permission-<group>-<permission>`), saved with 'إنشاء القالب' ("تم إنشاء القالب").
 */
export class RoleTemplatesPage extends BasePage {
  constructor(page: Page) {
    super(page, 'acm');
  }

  readonly newTemplateButton = this.page.getByRole('button', { name: 'قالب جديد' });
  readonly dialog = this.page.getByRole('dialog');

  async open(): Promise<void> {
    await this.visit('/secretary/admin/users/role-templates');
    await expect(this.newTemplateButton).toBeVisible({ timeout: acmTimeouts.pageLoad });
  }

  /** Creates a template; `disabled` turns on 'معطّل — لا يمكن تطبيقه' before saving. */
  async create(template: { code: string; nameAr: string; nameEn: string; permissions: string[]; disabled?: boolean }): Promise<void> {
    await this.newTemplateButton.click();
    await this.page.locator('#template-code').fill(template.code);
    await this.page.locator('#template-name-ar').fill(template.nameAr);
    await this.page.locator('#template-name-en').fill(template.nameEn);
    if (template.disabled) {
      const disabledSwitch = this.dialog.getByRole('switch', { name: /معطّل/ });
      await disabledSwitch.click();
      await expect(disabledSwitch).toHaveAttribute('aria-checked', 'true');
    }
    for (const permission of template.permissions) {
      const box = this.dialog.locator(`[id$="-${permission}"][role="checkbox"]`);
      await box.click();
      await expect(box).toHaveAttribute('data-state', 'checked');
    }
    await this.dialog.getByRole('button', { name: 'إنشاء القالب' }).click();
    await expect(this.page.getByText('تم إنشاء القالب').first()).toBeVisible();
  }

  /** The list row of a template, by its code. */
  row(code: string): Locator {
    return this.page.locator('tbody tr').filter({ has: this.page.getByRole('button', { name: `تعديل ${code}`, exact: true }) });
  }
}
