import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { asSetup } from '../../../src/utils/core/setup-step';
import { autoName } from '../../../src/domain/acm-names';
import { blocked, NO_TEST_INBOX } from '../../../src/utils/core/blocked-step';
import { keptLookupValues, languages, lookupTables, mailboxStatus, messages, routes } from '../../../test-data/acm/acm.data';

/** A lookup value of the case's own: a Latin code (AT + run id) and labels prefixed auto-test-. */
const lookupValue = (runId: string, label: string) => ({
  code: `AT${runId.toUpperCase()}`,
  ar: autoName(runId, label),
  en: autoName(runId, 'value'),
  fr: autoName(runId, 'valeur'),
});

/** A valid PNG, padded past the 1 MB the logo allows. */
const pngOfSize = (bytes: number): Buffer => {
  const onePixel = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA6364F8FFFF3F0005FE02FEA7D4E2A50000000049454E44AE426082', 'hex');
  return Buffer.concat([onePixel, Buffer.alloc(bytes - onePixel.length)]);
};

//========================================================================
// ACM-01 - Login and System Settings
// The test cases of "ACM-01 - Login and System Settings.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-01 Login and System Settings', () => {

  test(...scenario('ACM-01-01', `
    @Priority=1
    Scenario: Verify that an active user can log in with valid credentials
    Given the user is on the login page
    When the user enters a valid 'اسم المستخدم' and 'كلمة المرور'
    And clicks 'تسجيل الدخول'
    Then the user is redirected to the dashboard
    And the user name and role appear in the header
    #Arabic: التحقق من تسجيل الدخول بنجاح ببيانات صحيحة لمستخدم مفعّل
  `), async ({ page, newUser, loginPage, appShell }) => {
    // An active user of the case's own, with a known role ('مشغل'), so the header can be checked against it
    const user = await given(async () => {
      const created = await asSetup('create an active user with the role مشغل', () => newUser({ role: 'operator' }));
      await loginPage.open();
      return created;
    });
    await when(() => loginPage.signIn(user.userName, user.password));
    await then(async () => {
      await expect(page).toHaveURL(/\/$/);
      await appShell.expectSignedIn();
      await expect(appShell.accountButton, 'the header should show the user name').toContainText(user.fullName);
      await expect(appShell.accountButton, `the header should show the role '${user.roleName}'`).toContainText(user.roleName);
    });
  });

  test(...scenario('ACM-01-02', `
    @Priority=4
    Scenario: Verify that switching language between Arabic and English updates the UI and layout direction
    Given the UI is in Arabic (default)
    When the user clicks 'تغيير اللغة'
    Then labels are displayed in English with LTR layout
    And switching back restores Arabic with RTL layout
    #Arabic: التحقق من تبديل اللغة بين العربية والإنجليزية واتجاه الصفحة
  `), async ({ page, signIn, appShell }) => {
    const expectLanguage = async (language: (typeof languages)['ar' | 'en']) => {
      await expect(page.locator('html')).toHaveAttribute('dir', language.dir);
      await expect(page.locator('html')).toHaveAttribute('lang', language.lang);
      // The first link also shows its unread count ("البريد الداخلي 134"): its label is checked, not the whole text
      await expect(appShell.navigation.getByRole('link').first()).toContainText(language.firstNavigationLink);
      await expect(appShell.languageButton).toHaveText(language.languageButton);
    };
    await given(async () => {
      await signIn('ADMIN');
      await appShell.open(routes.dashboard);
      await expectLanguage(languages.ar);
    });
    await when(() => appShell.languageButton.click());
    await then(async () => {
      await expectLanguage(languages.en);
      await appShell.languageButton.click();
      await expectLanguage(languages.ar);
    });
  });

  test(...scenario('ACM-01-03', `
    @Priority=2
    Scenario: Verify that the admin can add a lookup value and it appears in related dropdowns
    Given the admin is on 'أكواد النظام'
    When the admin selects a 'نوع الكود' ('الأقسام', 'الأولوية', 'نوع الجهة', 'نوع الوثيقة')
    And clicks 'إضافة' and fills 'الكود', 'العربية', 'الإنجليزية' and 'الفرنسية'
    And clicks 'حفظ الجدول'
    Then the value is saved
    And appears in the related dropdowns across the system
    #Arabic: التحقق من إضافة قيمة في أكواد النظام وظهورها في القوائم المرتبطة
  `), async ({ page, signIn, runId, adminApi, cleanup, lookupsPage, correspondenceForm }) => {
    // 'نوع الوثيقة' feeds 'النوع' of the correspondence form
    const table = lookupTables.documentType;
    const value = lookupValue(runId, 'نوع وثيقة');
    await given(async () => {
      await signIn('ADMIN');
      await lookupsPage.open(table.label);
    });
    await when(async () => {
      cleanup(() => adminApi.deleteLookupValue(table.api, value.code));
      await lookupsPage.addValue(value);
      await lookupsPage.saveTableButton.click();
    });
    await then(async () => {
      await expect(page.getByText(messages.lookupSaved).first()).toBeVisible();
      await lookupsPage.open(table.label);
      await expect(lookupsPage.row(value.code), 'the value should still be in the table after reopening it').toHaveCount(1);
      await correspondenceForm.open();
      expect(await correspondenceForm.typeOptions(), "'النوع' of a new correspondence should offer the value").toContain(value.ar);
    });
  });

  test(...scenario('ACM-01-04', `
    @Priority=3
    Scenario: Verify that a deactivated lookup value no longer appears in dropdowns
    Given a lookup value is active
    When the admin deactivates it and saves
    Then it is no longer available in new records
    And existing records keep their value
    #Arabic: التحقق من إخفاء قيمة الكود المعطّلة من القوائم مع الحفاظ على السجلات القديمة
  `), async ({ page, signIn, runId, adminApi, cleanup, lookupsPage, correspondenceForm, registerPage }) => {
    const table = lookupTables.documentType;
    // A value used by a record can never be deleted, so the case keeps one value of its own (deactivated between runs)
    const value = keptLookupValues.deactivationCase;
    // An active value, and an existing record (a draft) that uses it
    const draftId = await given(() =>
      asSetup('activate the document type of the case and add a draft that uses it', async () => {
        const valueId = await adminApi.activeLookupValue(table.api, value);
        const id = await adminApi.createDraft(autoName(runId, 'draft'), valueId);
        cleanup(() => adminApi.purgeCorrespondence(id));
        await signIn('ADMIN');
        return id;
      }),
    );
    await when(async () => {
      await lookupsPage.open(table.label);
      await lookupsPage.setActive(value.code, false);
      await lookupsPage.saveTableButton.click();
      await expect(page.getByText(messages.lookupSaved).first()).toBeVisible();
    });
    await then(async () => {
      await correspondenceForm.open();
      expect(await correspondenceForm.typeOptions(), "a new correspondence should no longer offer the value in 'النوع'").not.toContain(value.ar);
      await registerPage.openRecord('Draft', draftId);
      expect(await registerPage.detailValue('النوع'), 'the existing draft should keep its value').toBe(value.ar);
    });
  });

  test(...scenario('ACM-01-05', `
    @Priority=4
    Scenario: Verify that lookup values display according to their sort order and duplicate codes are rejected
    Given lookup values exist
    When the admin changes the order and saves
    Then dropdowns display values in the new order
    When the admin adds a value with an existing code
    Then a duplicate validation message is shown
    #Arabic: التحقق من ترتيب قيم الأكواد ورفض الكود المكرر
  `), async ({ page, signIn, runId, adminApi, cleanup, lookupsPage, tasksPage }) => {
    // 'الأولوية' feeds the priority of tasks; the case moves its own value to the top, then the order is put back
    const table = lookupTables.priority;
    const value = lookupValue(runId, 'أولوية');
    await given(() =>
      asSetup('add a priority of the case', async () => {
        const before = await adminApi.lookupRows(table.api);
        cleanup(() => adminApi.restoreLookupOrder(table.api, before));
        await adminApi.addLookupValue(table.api, { ...value, orderLevel: before.length + 1 });
        cleanup(() => adminApi.deleteLookupValue(table.api, value.code));
        await signIn('ADMIN');
      }),
    );
    await when(async () => {
      await lookupsPage.open(table.label);
      await lookupsPage.moveTo(value.code, 1);
      await lookupsPage.saveTableButton.click();
      await expect(page.getByText(messages.lookupSaved).first()).toBeVisible();
    });
    await then(async () => {
      await tasksPage.open();
      expect((await tasksPage.priorityOptions())[0], "the moved value should come first in the tasks' 'الأولوية'").toBe(value.ar);
    });
    await when(async () => {
      await lookupsPage.open(table.label);
      await lookupsPage.addValue({ ...value, ar: autoName(runId, 'مكرر') });
    });
    await then(async () => {
      await expect(page.getByText(messages.duplicateLookupCode).first()).toBeVisible();
    });
  });

  test(...scenario('ACM-01-06', `
    @Priority=1
    Scenario: Verify that the admin can create a role template with selected permissions
    Given the admin is on 'قوالب الأدوار'
    When the admin clicks 'قالب جديد' and fills 'الكود', 'الاسم' and selected 'الصلاحيات'
    Then it appears in the list with the correct permissions count and 'مفعّل' status
    #Arabic: التحقق من إنشاء قالب دور بصلاحيات محددة
  `), async ({ signIn, runId, adminApi, cleanup, roleTemplatesPage }) => {
    const template = {
      code: autoName(runId, 'role'),
      nameAr: autoName(runId, 'دور'),
      nameEn: autoName(runId, 'role'),
      permissions: ['mailbox:view', 'tasks:view', 'tasks:create'],
    };
    await given(async () => {
      await signIn('ADMIN');
      await roleTemplatesPage.open();
    });
    await when(async () => {
      cleanup(() => adminApi.deleteRoleTemplate(template.code));
      await roleTemplatesPage.create(template);
    });
    await then(async () => {
      const row = roleTemplatesPage.row(template.code);
      await expect(row).toContainText(template.nameAr);
      await expect(row.locator('td').nth(2), 'the permissions count').toHaveText(String(template.permissions.length));
      await expect(row).toContainText('مفعّل');
    });
  });

  test(...scenario('ACM-01-07', `
    @Priority=3
    Scenario: Verify that entity identity and logo are saved and printed on labels and cover
    Given the admin is on 'الإعدادات' > 'هوية الجهة'
    When the admin saves 'اسم الجهة', 'الاسم المختصر', 'العنوان' and uploads 'الشعار' (PNG/JPEG/GIF/BMP ≤ 1 MB)
    Then the short name is printed on labels
    And the logo appears on the correspondence cover
    #Arabic: التحقق من حفظ هوية الجهة والشعار وظهورهم في الملصقات وغلاف المراسلة
  `), async ({ page, signIn, runId, adminApi, cleanup, settingsPage, registerPage }) => {
    // 'هوية الجهة' is the whole portal's (shared with the team): it is saved back as it was after the case. The logo
    // uploaded is the portal's own current one, so the portal's logo never changes.
    const identity = await given(async () => {
      const { original, logo } = await asSetup('keep the current identity and logo', async () => ({
        original: await adminApi.organization(),
        logo: await adminApi.organizationLogo(),
      }));
      cleanup(() =>
        adminApi.setOrganization({ name: original.nameTranslations, alias: original.aliasTranslations, address: original.addressTranslations }),
      );
      await signIn('ADMIN');
      await settingsPage.open();
      return {
        name: autoName(runId, 'جهة الهوية'),
        shortName: `AT${runId.toUpperCase()}`,
        address: 'القاهرة، مصر',
        logo: { name: logo.fileName, mimeType: logo.contentType, buffer: Buffer.from(logo.content, 'base64') },
      };
    });
    const status = await when(() => settingsPage.saveIdentity(identity));
    await then(async () => {
      expect(status, "'حفظ الهوية' should save").toBeLessThan(300);
      await settingsPage.open();
      await expect(settingsPage.identityFields.nameAr).toHaveValue(identity.name);
      await expect(settingsPage.identityFields.aliasAr).toHaveValue(identity.shortName);
      await expect(settingsPage.identityFields.addressAr).toHaveValue(identity.address);
      await expect(page.locator('main img').first(), 'the logo is shown').toBeVisible();
      // A label ('تنزيل الملصق' of a record) can be produced with the saved identity
      const recordId = await asSetup('find a record to print a label for', async () => (await adminApi.correspondenceIds('Inbox', ''))[0]);
      await registerPage.openRecord('Inbox', recordId);
      const [label] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تنزيل الملصق' }).click()]);
      expect(label.suggestedFilename(), 'the label file').toBeTruthy();
      test.info().annotations.push({
        type: 'note',
        description: `The label file (${label.suggestedFilename()}) and the correspondence cover are not read here: whether they print '${identity.shortName}' and the logo is left to the reviewer.`,
      });
    });
  });

  test(...scenario('ACM-01-08', `
    @Priority=4
    Scenario: Verify that uploading a logo larger than 1 MB or unsupported type is rejected
    Given the admin is on 'الإعدادات' > 'الشعار'
    When the admin uploads a file larger than 1 MB or of an unsupported type
    Then the upload is rejected with a validation message
    #Arabic: التحقق من رفض شعار أكبر من 1 ميجابايت أو بصيغة غير مدعومة
  `), async ({ page, signIn, settingsPage }) => {
    await given(async () => {
      await signIn('ADMIN');
      await settingsPage.open();
    });
    await when(() => settingsPage.chooseLogo({ name: 'auto-test-logo.png', mimeType: 'image/png', buffer: pngOfSize(1_250_000) }));
    await then(() => expect(page.getByText(messages.logoTooLarge).first()).toBeVisible());
    await when(() => settingsPage.chooseLogo({ name: 'auto-test-logo.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') }));
    await then(() => expect(page.getByText(messages.logoWrongType).first()).toBeVisible());
  });

  test(...scenario('ACM-01-09', `
    @Priority=1
    Scenario: Verify that the admin can add an IMAP mailbox and the service connects
    Given the admin is on 'الإعدادات' > 'استقبال البريد'
    When the admin clicks 'إضافة صندوق بريد' and fills server, port, SSL and 'كلمة مرور التطبيق'
    Then the mailbox is saved with status 'يستقبل'
    And the password is never displayed again, only 'saved' status
    #Arabic: التحقق من إضافة صندوق بريد IMAP واتصاله وعدم عرض كلمة المرور
  `), async ({ page, signIn, runId, settingsPage }) => {
    // Read-only (team decision 2026-11-17): the portal's settings must not be changed. The form is filled and left with
    // 'إلغاء'; what a saved mailbox shows is checked on the mailbox already configured. Any settings save is stopped.
    const typed = { host: 'auto-test.invalid', port: 993, userName: `${autoName(runId, 'mailbox')}@example.com`, appPassword: `Auto#${runId}` };
    const stopped = await given(async () => {
      await signIn('ADMIN');
      const guard = await settingsPage.blockSettingsWrites();
      await settingsPage.open();
      return guard;
    });
    await when(() => settingsPage.tryMailboxFormWithoutSaving(typed));
    await then(async () => {
      const cards = settingsPage.mailboxCards();
      await expect(cards.first(), 'a configured mailbox').toBeVisible();
      const receiving = cards.filter({ hasText: mailboxStatus.receiving }).first();
      await expect(receiving, `a configured mailbox with the status '${mailboxStatus.receiving}'`).toBeVisible();
      // The password is never shown again, only that one is saved
      await expect(receiving).toContainText(messages.appPasswordSaved);
      await expect(page.locator('main')).not.toContainText(typed.appPassword);
      expect(await settingsPage.appPasswordShownWhenEditingCard(receiving), "'كلمة مرور التطبيق' should be empty when the mailbox is edited").toBe('');
      expect(stopped, 'no setting should have been saved').toEqual([]);
      blocked('saving a new mailbox and its connecting', "the portal's settings must not be changed (team decision 2026-11-17): the form was filled and cancelled, and the saved state was checked on the mailbox already configured");
    });
  });

  test(...scenario('ACM-01-10', `
    @Priority=1
    Scenario: Verify that SMTP settings can be saved and a test email is delivered
    Given the admin is on 'الإعدادات' > 'البريد الخارجي (SMTP)'
    When the admin enables 'تفعيل الإرسال الخارجي' and fills 'خادم SMTP', 'المنفذ', 'وضع التشفير', 'عنوان المرسل', 'اسم المرسل', 'مستخدم SMTP' and 'كلمة المرور'
    And clicks 'حفظ' then 'إرسال بريد اختبار'
    Then the test email is received successfully
    #Arabic: التحقق من حفظ إعدادات SMTP وإرسال بريد اختبار
  `), async ({ page, signIn, settingsPage }) => {
    // Read-only (team decision 2026-11-17): the shared SMTP settings must not be changed - nothing is typed, saved or
    // sent; the section's fields are checked as they are. Any settings save is stopped.
    const stopped = await given(async () => {
      await signIn('ADMIN');
      const guard = await settingsPage.blockSettingsWrites();
      await settingsPage.open();
      return guard;
    });
    await when(() => expect(settingsPage.smtpEnabled, "'تفعيل الإرسال الخارجي'").toBeVisible());
    await then(async () => {
      for (const [id, label] of [
        ['#dispatch-host', 'خادم SMTP'],
        ['#dispatch-port', 'المنفذ'],
        ['#dispatch-security', 'وضع التشفير'],
        ['#dispatch-fromAddress', 'عنوان المرسل'],
        ['#dispatch-fromDisplayName', 'اسم المرسل'],
        ['#dispatch-userName', 'مستخدم SMTP'],
        ['#dispatch-password', 'كلمة المرور'],
      ] as const) {
        await expect(page.locator(id), `'${label}'`).toBeVisible();
      }
      await expect(page.locator('#dispatch-password'), 'the password is never shown').toHaveValue('');
      await expect(settingsPage.smtpTestButton, "'إرسال بريد اختبار'").toBeVisible();
      test.info().annotations.push({ type: 'smtp', description: `'تفعيل الإرسال الخارجي' is ${(await settingsPage.smtpEnabled.isChecked()) ? 'on' : 'off'}; 'إرسال بريد اختبار' is ${(await settingsPage.smtpTestButton.isEnabled()) ? 'enabled' : 'disabled'}` });
      expect(stopped, 'no setting should have been saved').toEqual([]);
      blocked('saving the SMTP settings and receiving the test e-mail', `the shared SMTP settings must not be changed (team decision 2026-11-17), and ${NO_TEST_INBOX}`);
    });
  });
});
