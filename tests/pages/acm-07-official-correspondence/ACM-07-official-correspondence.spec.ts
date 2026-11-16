import { writeFileSync } from 'node:fs';
import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { autoEmail, autoName } from '../../../src/domain/acm-names';
import { createClub, createFootballAssociation, credentialsOfPerson } from '../../../src/fixtures/club';
import { expectReceived } from '../../../src/fixtures/visibility';
import { MEGABYTE, writeTestFile } from '../../../src/utils/core/test-files';
import { directions, documentTypes, referencePattern, subjects } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-07 - Official Correspondence
// The test cases of "ACM-07 - Official Correspondence.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// Every case makes its own 'الاتحاد المصري لكرة القدم' (and club when it needs one) and purges its correspondence after
// itself: the purge is registered after the entities, so it runs first (an entity named in a correspondence cannot be
// removed).
//========================================================================================

test.describe('ACM-07 Official Correspondence', () => {

  test(...scenario('ACM-07-01', `
    @Priority=1
    Scenario: Verify that the user can register an incoming letter with all mandatory fields
    Given the user is on the correspondence creation page ('الصادر و الوارد' > 'إنشاء')
    When the user selects 'الاتجاه' = 'وارد' and 'النوع' = 'خطاب'
    And fills 'تاريخ المراسلة', 'الجهة المستقبِلة' = 'النادي الأهلي', 'الموضوع' = 'إخطار بمواعيد مباريات الدور الأول' and 'النص'
    And sets the sender as 'الاتحاد المصري لكرة القدم'
    And clicks 'إرسال'
    Then the record is saved with an auto reference number in format YYYY/N/I
    And it appears in the 'الوارد' folder
    #Arabic: التحقق من تسجيل خطاب وارد من الاتحاد المصري لكرة القدم للنادي الأهلي وتوليد الرقم المرجعي بصيغة الوارد
  `), async ({ signIn, runId, adminApi, cleanup, correspondenceForm, registerPage }) => {
    const subject = autoName(runId, subjects.incomingLetter);
    const efa = await given(async () => {
      const association = await createData('create the club and the football association', async () => {
        await createClub(adminApi, runId, cleanup);
        return createFootballAssociation(adminApi, runId, cleanup);
      });
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      await signIn('ADMIN');
      await correspondenceForm.open();
      return association;
    });
    const sent = await when(async () => {
      // With 'وارد' the party field becomes 'الجهة المرسِلة' (the sender); the receiving side is the portal's own entity
      await correspondenceForm.fillRegister({ direction: directions.incoming.label, type: documentTypes.letter.label, correspondent: efa.name, subject, body: subject });
      return correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the server should register the letter: ${sent.error ?? ''}`).toBe(200);
      await registerPage.openRecord('Inbox', sent.documentId as number);
      expect(await registerPage.referenceNumber(), 'the incoming reference number').toMatch(referencePattern.incoming);
      await registerPage.openFolder('Inbox');
      await registerPage.search(subject);
      await expect(registerPage.row(subject), "the letter in 'الوارد'").toHaveCount(1);
      test.info().annotations.push({ type: 'note', description: "With 'وارد' the form asks for the sender only ('الجهة المرسِلة'); 'الجهة المستقبِلة' = 'النادي الأهلي' has no field of its own." });
    });
  });

  test(...scenario('ACM-07-02', `
    @Priority=1
    Scenario: Verify that the user can create and send an outgoing fax correspondence
    Given the user is on the correspondence creation page ('الصادر و الوارد' > 'إنشاء')
    When the user selects 'الاتجاه' = 'صادر' and 'النوع' = 'فاكس'
    And fills 'الموضوع' = 'تأكيد حضور اجتماع لجنة المسابقات', 'النص' and the other mandatory fields
    And selects 'الجهة المستقبِلة' = 'الاتحاد المصري لكرة القدم'
    And clicks 'إرسال'
    Then the record gets a reference number in format YYYY/N/O
    And it appears in the 'الصادر' folder
    #Arabic: التحقق من إنشاء وإرسال فاكس صادر للاتحاد المصري لكرة القدم وتوليد الرقم المرجعي بصيغة الصادر
  `), async ({ signIn, runId, adminApi, cleanup, correspondenceForm, registerPage }) => {
    const subject = autoName(runId, subjects.outgoingFax);
    const efa = await given(async () => {
      const association = await createData('create the football association', () => createFootballAssociation(adminApi, runId, cleanup));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      await signIn('ADMIN');
      await correspondenceForm.open();
      return association;
    });
    const sent = await when(async () => {
      await correspondenceForm.fillRegister({ direction: directions.outgoing.label, type: documentTypes.fax.label, correspondent: efa.name, subject, body: subject });
      return correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the server should send the fax: ${sent.error ?? ''}`).toBe(200);
      await registerPage.openRecord('Outbox', sent.documentId as number);
      expect(await registerPage.referenceNumber(), 'the outgoing reference number').toMatch(referencePattern.outgoing);
      await registerPage.openFolder('Outbox');
      await registerPage.search(subject);
      await expect(registerPage.row(subject), "the fax in 'الصادر'").toHaveCount(1);
    });
  });

  test(...scenario('ACM-07-03', `
    @Priority=2
    Scenario: Verify that mandatory field validation is shown when saving empty correspondence
    Given the user is on the correspondence creation page ('الصادر و الوارد' > 'إنشاء')
    When the user clicks 'إرسال' without filling 'تاريخ المراسلة', 'الجهة المستقبِلة', 'الموضوع' and 'النص'
    Then 'حقل مطلوب' is displayed under each mandatory field
    And the record is not saved
    #Arabic: التحقق من ظهور رسائل الحقول الإلزامية عند الإرسال بدون بيانات
  `), async ({ signIn, correspondenceForm }) => {
    await given(async () => {
      await signIn('ADMIN');
      await correspondenceForm.open();
    });
    const sent = await when(() => correspondenceForm.sendExpectingValidation());
    await then(async () => {
      // One message under each of the 4 mandatory fields
      await expect(correspondenceForm.requiredMessages).toHaveCount(4);
      expect(sent, 'nothing should be sent to the server').toBe(false);
      await expect(correspondenceForm.subject, 'the form stays open').toBeVisible();
    });
  });

  test(...scenario('ACM-07-04', `
    @Priority=2
    Scenario: Verify that a correspondence saved as draft remains editable
    Given the user filled the correspondence form
    When the user clicks 'حفظ كمسودة'
    Then the record appears in the 'المسودات' folder
    And the user can open and edit it
    #Arabic: التحقق من حفظ المراسلة كمسودة وإمكانية تعديلها
  `), async ({ page, signIn, runId, adminApi, cleanup, correspondenceForm, registerPage }) => {
    const subject = autoName(runId, 'مسودة مراسلة');
    const edited = `${subject} - معدلة`;
    await given(async () => {
      const efa = await createData('create the football association', () => createFootballAssociation(adminApi, runId, cleanup));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      await signIn('ADMIN');
      await correspondenceForm.open();
      await correspondenceForm.fillRegister({ direction: directions.outgoing.label, type: documentTypes.letter.label, correspondent: efa.name, subject, body: subject });
    });
    const saved = await when(() => correspondenceForm.saveDraft());
    await then(async () => {
      expect(saved.status, `the draft should be saved: ${saved.error ?? ''}`).toBe(200);
      await registerPage.openFolder('Draft');
      await registerPage.search(subject);
      await expect(registerPage.row(subject), "the draft in 'المسودات'").toHaveCount(1);
      // An opened draft shows 'تعديل' (seen live 2026-11-16), which gives its form back, editable
      await registerPage.row(subject).click();
      await page.locator('main').getByRole('button', { name: 'تعديل', exact: true }).click();
      await expect(correspondenceForm.subject).toBeEditable();
      await correspondenceForm.subject.fill(edited);
      const again = await correspondenceForm.saveDraft();
      expect(again.status, 'the edited draft should be saved').toBe(200);
      await registerPage.openFolder('Draft');
      await registerPage.search(edited);
      await expect(registerPage.row(edited), 'the edited subject').toHaveCount(1);
    });
  });

  test(...scenario('ACM-07-05', `
    @Priority=1
    Scenario: Verify that a sent or registered correspondence becomes read-only
    Given a correspondence has been sent
    When the user opens it
    Then all fields are read-only
    And no edit action is available
    #Arabic: التحقق من أن المراسلة بعد الإرسال أو القيد تصبح للقراءة فقط
  `), async ({ page, signIn, runId, adminApi, cleanup, registerPage }) => {
    const subject = autoName(runId, subjects.incomingLetter);
    const documentId = await given(async () => {
      const id = await createData('send a correspondence', async () => {
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        return adminApi.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [{ id: efa.id, name: efa.name }] });
      });
      await signIn('ADMIN');
      return id;
    });
    await when(() => registerPage.openRecord('Inbox', documentId));
    await then(async () => {
      await expect(registerPage.details).toContainText(subject);
      // Shown as text: no field of the form, and no way back to it
      await expect(page.locator('main input#subject, main #body[contenteditable="true"], main #directionId'), 'no editable field').toHaveCount(0);
      await expect(page.getByRole('button', { name: /^(تعديل|حفظ كمسودة|حفظ)$/ }), 'no edit action').toHaveCount(0);
    });
  });

  test(...scenario('ACM-07-06', `
    @Priority=2
    Scenario: Verify that attachments are uploaded within the allowed types and size
    Given the user is creating a correspondence
    When the user uploads PDF, image and Office files under 25 MB
    Then the files are attached successfully
    And they can be downloaded after saving
    #Arabic: التحقق من رفع المرفقات المسموحة بحجم أقل من 25 ميجابايت
  `), async ({ page, signIn, runId, adminApi, cleanup, correspondenceForm, registerPage }, testInfo) => {
    const subject = autoName(runId, 'مراسلة بمرفقات');
    const folder = testInfo.outputPath('attachments');
    const files = [
      writeTestFile(folder, `auto-test-${runId}-خطاب`, 'pdf', 200 * 1024),
      writeTestFile(folder, `auto-test-${runId}-صورة`, 'png', 300 * 1024),
      writeTestFile(folder, `auto-test-${runId}-جدول`, 'xlsx', 100 * 1024),
      writeTestFile(folder, `auto-test-${runId}-مستند`, 'docx', 5 * MEGABYTE),
    ];
    const names = files.map((file) => file.split(/[\\/]/).pop() as string);
    await given(async () => {
      const efa = await createData('create the football association', () => createFootballAssociation(adminApi, runId, cleanup));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      await signIn('ADMIN');
      await correspondenceForm.open();
      await correspondenceForm.fillRegister({ direction: directions.outgoing.label, type: documentTypes.letter.label, correspondent: efa.name, subject, body: subject });
    });
    await when(() => correspondenceForm.attach(...files));
    const sent = await then(async () => {
      for (const name of names) {
        await expect(correspondenceForm.attachment(name), `${name} should be attached`).toBeVisible();
      }
      const result = await correspondenceForm.send();
      expect(result.status, `the correspondence should be sent with its attachments: ${result.error ?? ''}`).toBe(200);
      return result;
    });
    await then(async () => {
      await registerPage.openRecord('Outbox', sent.documentId as number);
      for (const name of names) {
        const [download] = await Promise.all([page.waitForEvent('download'), registerPage.details.getByText(name).first().click()]);
        expect(download.suggestedFilename(), `${name} should download`).toContain(name.split('.').pop() as string);
      }
    });
  });

  test(...scenario('ACM-07-07', `
    @Priority=3
    Scenario: Verify that attachments larger than 25 MB or of unsupported type are rejected
    Given the user is creating a correspondence
    When the user uploads a file larger than 25 MB or with an unsupported extension
    Then the upload is rejected with a clear validation message
    #Arabic: التحقق من رفض المرفقات الأكبر من 25 ميجابايت أو غير المدعومة
  `), async ({ page, signIn, runId, correspondenceForm }, testInfo) => {
    const folder = testInfo.outputPath('attachments');
    const tooLarge = writeTestFile(folder, `auto-test-${runId}-كبير`, 'pdf', 26 * MEGABYTE);
    const unsupported = testInfo.outputPath(`auto-test-${runId}-برنامج.exe`);
    writeFileSync(unsupported, Buffer.from('MZ auto-test executable'));
    await given(async () => {
      await signIn('ADMIN');
      await correspondenceForm.open();
    });
    for (const [what, file] of [
      ['larger than 25 MB', tooLarge],
      ['an unsupported extension', unsupported],
    ] as const) {
      const name = file.split(/[\\/]/).pop() as string;
      await when(() => correspondenceForm.attach(file));
      await then(async () => {
        // Seen live (2026-11-16) for a file over 25 MB: "تجاوزت الحجم المسموح فتم تخطيها: <file>"
        const refusal = /تجاوزت الحجم المسموح|تم تخطيها|غير مدعوم|غير مسموح|نوع الملف/;
        await expect(page.locator('main').getByText(refusal).first(), `a message for a file of ${what}`).toBeVisible();
        // The file is named in that message only - not attached
        await expect(page.locator('main').getByText(name).filter({ hasNotText: refusal }), `${name} should not be attached`).toHaveCount(0);
      });
    }
  });

  test(...scenario('ACM-07-08', `
    @Priority=1
    Scenario: Verify that a confidential correspondence is visible only to authorized users
    Given a correspondence is marked as 'سرّي'
    When a user without access opens the register
    Then the record has flag confidential
    And the confidential badge appears for authorized users
    #Arabic: التحقق من أن المراسلة السرّية تظهر للمستخدمين المصرّح لهم فقط
  `), async ({ signIn, runId, adminApi, cleanup, newUser, asAnotherUser, correspondenceForm, registerPage }) => {
    const subject = autoName(runId, 'مراسلة سرية');
    const outsider = await given(async () => {
      const efa = await createData('create the football association', () => createFootballAssociation(adminApi, runId, cleanup));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      const user = await createData('create a user without access to it', () => newUser());
      await signIn('ADMIN');
      await correspondenceForm.open();
      await correspondenceForm.fillRegister({ direction: directions.incoming.label, type: documentTypes.letter.label, correspondent: efa.name, subject, body: subject });
      await correspondenceForm.markSecret();
      const sent = await correspondenceForm.send();
      expect(sent.status, 'the confidential correspondence should be registered').toBe(200);
      return user;
    });
    const other = await when(async () => {
      const opened = await asAnotherUser({ username: outsider.userName, password: outsider.password });
      await opened.registerPage.openFolder('Inbox');
      await opened.registerPage.search(subject);
      return opened;
    });
    await then(async () => {
      await expect(other.registerPage.row(subject), 'a user without access should not see it').toHaveCount(0);
      // The author (authorized) sees it with the confidential badge
      await registerPage.openFolder('Inbox');
      await registerPage.search(subject);
      await expect(registerPage.row(subject)).toContainText('سرّي');
    });
  });

  test(...scenario('ACM-07-09', `
    @Priority=2
    Scenario: Verify that the user can reply, reply all and resend a correspondence
    Given a received correspondence exists
    When the user clicks 'رد', 'رد على الجميع' or 'إعادة إرسال'
    Then a new draft is created prefixed with 'رد :' or 'اعادة ارسال :'
    And recipients are pre-filled according to the selected action
    #Arabic: التحقق من الرد والرد على الجميع وإعادة الإرسال وتعبئة المستلمين تلقائياً
  `), async ({ page, signIn, runId, adminApi, cleanup, correspondenceForm, registerPage }) => {
    const subject = autoName(runId, subjects.incomingLetter);
    const { documentId, efa } = await given(async () => {
      const prepared = await createData('receive a correspondence from the football association', async () => {
        const association = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        const id = await adminApi.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [{ id: association.id, name: association.name }] });
        return { documentId: id, efa: association };
      });
      await signIn('ADMIN');
      return prepared;
    });
    for (const [action, prefix, recipient] of [
      ['رد', 'رد :', efa.name],
      ['رد على الجميع', 'رد :', efa.name],
      ['إعادة إرسال', 'اعادة ارسال :', undefined],
    ] as const) {
      await when(async () => {
        await registerPage.openRecord('Inbox', documentId);
        await page.getByRole('button', { name: action, exact: true }).click();
      });
      await then(async () => {
        await expect(correspondenceForm.subject, `'${action}' should prefix the subject`).toHaveValue(new RegExp(`^${prefix}\\s*${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        if (recipient) {
          await expect(page.locator('main'), `'${action}' should address the sender`).toContainText(recipient);
        }
        const draft = await correspondenceForm.saveDraft();
        expect(draft.status, `'${action}' should give a draft`).toBe(200);
      });
    }
  });

  test(...scenario('ACM-07-10', `
    @Priority=2
    Scenario: Verify that sending an email correspondence to an entity without an email address is handled
    Given the selected entity has no email address
    When the user sends an outgoing correspondence of type 'بريد الكترونى'
    Then the system shows a clear message that the entity has no email address
    And the external sending is not reported as successful
    #Arabic: التحقق من التعامل مع إرسال بريد إلكتروني لجهة بدون عنوان بريد
  `), async ({ page, signIn, runId, adminApi, cleanup, correspondenceForm }) => {
    const subject = autoName(runId, 'بريد لجهة بلا عنوان');
    await given(async () => {
      const efa = await createData('create the football association without an e-mail', () => createFootballAssociation(adminApi, runId, cleanup, { email: null }));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      await signIn('ADMIN');
      await correspondenceForm.open();
      await correspondenceForm.fillRegister({ direction: directions.outgoing.label, type: documentTypes.email.label, correspondent: efa.name, subject, body: subject });
    });
    const sent = await when(() => correspondenceForm.send());
    await then(async () => {
      await expect(page.getByText(/لا يوجد.*بريد|ليس لها.*بريد|بدون.*بريد|عنوان بريد/).first(), 'a message that the entity has no e-mail address').toBeVisible();
      await expect(page.getByText('تم الإرسال الخارجي'), 'the external sending should not be reported as done').toHaveCount(0);
      test.info().annotations.push({ type: 'server answer', description: `${sent.status} ${sent.error ?? ''}` });
    });
  });
  test(...scenario('ACM-07-11', `
    @Priority=1
    Scenario: Verify that an outgoing correspondence can be directed internally to a sub-entity
    Given the admin is on 'الصادر و الوارد' > 'إنشاء'
    When the admin selects 'الاتجاه' = 'صادر' and 'النوع' = 'خطاب'
    And fills 'الموضوع' = 'تعميم مواعيد التدريبات الصيفية', 'النص' and 'تاريخ المراسلة'
    And selects 'الجهة المستقبِلة' = 'إدارة الكرة' and clicks 'إرسال'
    Then the record gets a reference number in format YYYY/N/O and appears in the admin's 'الصادر'
    And it is visible to 'كريم حسن' and 'عمرو فتحي' in their incoming lists
    #Arabic: التحقق من إنشاء صادر موجّه داخلياً لإدارة الكرة ووصوله لأشخاصها
  `), async ({ signIn, runId, adminApi, cleanup, correspondenceForm, registerPage, asAnotherUser }) => {
    const subject = autoName(runId, 'تعميم مواعيد التدريبات الصيفية');
    const club = await given(async () => {
      const madeClub = await createData('create the club with users', () => createClub(adminApi, runId, cleanup, { withUsers: true }));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      await signIn('ADMIN');
      await correspondenceForm.open();
      return madeClub;
    });
    const sent = await when(async () => {
      await correspondenceForm.fillRegister({ direction: directions.outgoing.label, type: documentTypes.letter.label, correspondent: club.entityNames.football, subject, body: subject });
      return correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the correspondence should be sent: ${sent.error ?? ''}`).toBe(200);
      await registerPage.openRecord('Outbox', sent.documentId as number);
      expect(await registerPage.referenceNumber(), 'the outgoing reference number').toMatch(referencePattern.outgoing);
      await registerPage.openFolder('Outbox');
      await registerPage.search(subject);
      await expect(registerPage.row(subject), "in the admin's 'الصادر'").toHaveCount(1);
      for (const name of ['كريم حسن', 'عمرو فتحي']) {
        await expectReceived(await asAnotherUser(credentialsOfPerson(club.person(name))), subject, name);
      }
    });
  });

  test(...scenario('ACM-07-12', `
    @Priority=1
    Scenario: Verify that an incoming correspondence can be registered from a new external entity added during registration
    Given the sender 'نادي الزمالك' does not exist in 'الجهات'
    When the user selects 'الاتجاه' = 'وارد' and 'النوع' = 'خطاب' and fills the mandatory fields
    And clicks 'إضافة جهة' and adds 'نادي الزمالك' with email 'zamalek.club@example.com'
    And directs it to 'إدارة الكرة' and clicks 'إرسال'
    Then the record is saved with a reference number in format YYYY/N/I
    And 'نادي الزمالك' is selected as the sender and is saved in 'الجهات'
    And the record is visible to the persons of 'إدارة الكرة'
    #Arabic: التحقق من تسجيل وارد من جهة جديدة تُضاف أثناء التسجيل وحفظها في الجهات
  `), async ({ page, signIn, runId, adminApi, cleanup, correspondenceForm, registerPage, asAnotherUser }) => {
    const subject = autoName(runId, 'خطاب من نادي الزمالك');
    const zamalek = autoName(runId, 'نادي الزمالك');
    const club = await given(async () => {
      const madeClub = await createData('create the club with users', () => createClub(adminApi, runId, cleanup, { withUsers: true }));
      // The new entity is made by the case: removed by its run id, after the correspondence that names it
      cleanup(() => adminApi.deleteAddressBookMatching(zamalek));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      await signIn('ADMIN');
      await correspondenceForm.open();
      return madeClub;
    });
    const sent = await when(async () => {
      await correspondenceForm.chooseDirection(directions.incoming.label);
      await correspondenceForm.chooseType(documentTypes.letter.label);
      const now = new Date();
      await correspondenceForm.date.fill(`${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
      await correspondenceForm.openAddEntity();
      await correspondenceForm.fillNewEntity({ name: zamalek, email: autoEmail(runId, 'zamalek.club') });
      expect(await correspondenceForm.addAndChoose(), "'نادي الزمالك' should be added").toBeLessThan(300);
      await expect(correspondenceForm.newEntityDialog).toBeHidden();
      // Directed to 'إدارة الكرة': added as a further recipient ('إضافة نسخة')
      await page.locator('main').getByRole('button', { name: 'إضافة نسخة', exact: true }).click();
      await correspondenceForm.pickRecipient(club.entityNames.football, page.locator('main [role="combobox"]').last());
      await correspondenceForm.subject.fill(subject);
      await correspondenceForm.fillBody(subject);
      return correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the correspondence should be registered: ${sent.error ?? ''}`).toBe(200);
      await registerPage.openRecord('Inbox', sent.documentId as number);
      expect(await registerPage.referenceNumber(), 'the incoming reference number').toMatch(referencePattern.incoming);
      await expect(registerPage.details, `'${zamalek}' is the sender`).toContainText(zamalek);
      expect(await adminApi.recipientId(zamalek), `'${zamalek}' is saved in 'الجهات'`).toBeGreaterThan(0);
      for (const name of ['كريم حسن', 'عمرو فتحي']) {
        await expectReceived(await asAnotherUser(credentialsOfPerson(club.person(name))), subject, name);
      }
    });
  });

  test(...scenario('ACM-07-13', `
    @Priority=3
    Scenario: Verify that adding a new entity from the registration form validates its data
    Given the user is registering a correspondence and clicks 'إضافة جهة'
    When the user clicks 'إضافة واختيار' with an empty name
    Then 'حقل مطلوب' is displayed under the name
    When the user enters the name and the email 'zamalek.club@'
    Then 'أدخل بريدًا إلكترونيًا صحيحًا' is displayed
    When the user clicks 'إلغاء'
    Then the dialog closes and no entity is added to 'الجهات'
    #Arabic: التحقق من التحقق من بيانات الجهة الجديدة المضافة من نموذج التسجيل
  `), async ({ signIn, runId, adminApi, cleanup, correspondenceForm }) => {
    const zamalek = autoName(runId, 'نادي الزمالك');
    await given(async () => {
      cleanup(() => adminApi.deleteAddressBookMatching(zamalek));
      await signIn('ADMIN');
      await correspondenceForm.open();
      await correspondenceForm.openAddEntity();
    });
    const empty = await when(() => correspondenceForm.addAndChoose());
    await then(async () => {
      expect(empty, 'nothing should be added with an empty name').toBeUndefined();
      await expect(correspondenceForm.newEntityDialog.getByText(/حقل مطلوب|مطلوب/).first(), "'حقل مطلوب' under the name").toBeVisible();
    });
    const invalid = await when(async () => {
      await correspondenceForm.fillNewEntity({ name: zamalek, email: 'zamalek.club@' });
      return correspondenceForm.addAndChoose();
    });
    await then(async () => {
      expect(invalid, "nothing should be added with the e-mail 'zamalek.club@'").toBeUndefined();
      await expect(correspondenceForm.newEntityDialog.getByText('أدخل بريدًا إلكترونيًا صحيحًا').first()).toBeVisible();
    });
    await when(() => correspondenceForm.newEntityDialog.getByRole('button', { name: 'إلغاء', exact: true }).click());
    await then(async () => {
      await expect(correspondenceForm.newEntityDialog, 'the dialog closes').toBeHidden();
      await expect(adminApi.recipientId(zamalek), "no entity is added to 'الجهات'").rejects.toThrow(/RECIPIENT_NOT_FOUND/);
    });
  });
});
