import type { Page } from '@playwright/test';
import { expect, test } from '../../../src/fixtures/acm.fixture';
import type { MailboxPage } from '../../../src/pages/mailbox/mailbox.page';
import type { CorrespondenceFormPage } from '../../../src/pages/register/correspondence-form.page';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { blocked, NO_TEST_INBOX } from '../../../src/utils/core/blocked-step';
import { autoEmail, autoName } from '../../../src/domain/acm-names';
import { AcmApi } from '../../../src/api/acm-api';
import { createClub, createFootballAssociation, credentialsOfPerson } from '../../../src/fixtures/club';
import { writeTestFile } from '../../../src/utils/core/test-files';
import { directions, documentTypes, referencePattern, registryName, subjects } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-11 - Registry External Sending
// The test cases of "ACM-11 - Registry External Sending.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// A request for external mail is an internal message to 'السجل / Registry' (the entity that ships with the portal); it
// waits in 'الصادر و الوارد' > 'بانتظار التسجيل' (?folder=Register) until the Registry registers and sends it.
//========================================================================================

/**
 * كريم حسن's request to 'السجل / Registry' (internal mail, as he sends it). Seen live (2026-11-16): it reaches the
 * Registry's 'البريد الداخلي' (the admin's inbox). Returns its document id.
 */
const requestToRegistry = async (adminApi: AcmApi, karim: { username: string; password: string }, subject: string): Promise<number> => {
  const registry = { id: await adminApi.recipientId(registryName), name: registryName };
  const api = await AcmApi.as(karim);
  try {
    return await api.sendCorrespondence({ subject, register: false, recipients: [registry] });
  } finally {
    await api.dispose();
  }
};

/**
 * The Registry opens the pending request and starts registering it as outgoing e-mail. NOT YET SEEN: the action that
 * turns a request into a register record; the record offers 'إرسال بالبريد' (seen on register records), tried first.
 */
const startRegistering = async (page: Page, mailboxPage: MailboxPage, correspondenceForm: CorrespondenceFormPage, subject: string): Promise<void> => {
  await mailboxPage.open();
  await mailboxPage.search(subject);
  await mailboxPage.openMessage(subject);
  await page.locator('main').getByRole('button', { name: /^(تسجيل|قيد|إرسال بالبريد|تسجيل كصادر)$/ }).first().click();
  await correspondenceForm.chooseDirection(directions.outgoing.label);
  await correspondenceForm.chooseType(documentTypes.email.label);
};

test.describe('ACM-11 Registry External Sending', () => {

  test(...scenario('ACM-11-01', `
    @Priority=1
    Scenario: Verify that an internal user sends an external mail request with an attachment to the Registry
    Given 'كريم حسن' in 'إدارة الكرة' needs to reply to 'الاتحاد المصري لكرة القدم'
    When he creates 'رد النادي الأهلي بشأن اعتماد قائمة اللاعبين المقيدين' directed to 'السجل / Registry'
    And attaches 'قائمة_اللاعبين_المعتمدة.pdf'
    And clicks 'إرسال'
    Then the correspondence appears in the Registry's 'بانتظار التسجيل' list with the attachment
    #Arabic: التحقق من إرسال طلب البريد الخارجي بمرفق من إدارة الكرة إلى السجل
  `), async ({ signIn, runId, adminApi, cleanup, asAnotherUser, registerPage }, testInfo) => {
    const subject = autoName(runId, subjects.registryReply);
    const attachment = writeTestFile(testInfo.outputPath('attachments'), 'قائمة_اللاعبين_المعتمدة', 'pdf', 150 * 1024);
    const karim = await given(async () => {
      const club = await createData('create the club with users and the football association', async () => {
        const madeClub = await createClub(adminApi, runId, cleanup, { withUsers: true });
        await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        return madeClub;
      });
      return asAnotherUser(credentialsOfPerson(club.person('كريم حسن')));
    });
    const sent = await when(async () => {
      await karim.correspondenceForm.openCompose();
      await karim.correspondenceForm.fillMessage({ to: [registryName], subject, body: subject });
      await karim.correspondenceForm.attach(attachment);
      await expect(karim.correspondenceForm.attachment('قائمة_اللاعبين_المعتمدة')).toBeVisible();
      return karim.correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the request should be sent to the Registry: ${sent.error ?? ''}`).toBe(200);
      // The Registry: the admin (the .env admin account works the Registry)
      await signIn('ADMIN');
      await registerPage.openFolder('Register');
      await registerPage.search(subject);
      await expect(registerPage.row(subject), "in 'بانتظار التسجيل'").toHaveCount(1);
      await expect(registerPage.row(subject), 'with the attachment').toContainText('به مرفقات');
    });
  });

  test(...scenario('ACM-11-02', `
    @Priority=1
    Scenario: Verify that the Registry sends the external mail with its attachment to the external entity
    Given 'رد النادي الأهلي بشأن اعتماد قائمة اللاعبين المقيدين' is pending at the Registry
    When the admin (or a user with admin permissions) registers it as 'صادر' of type 'بريد الكترونى' to 'الاتحاد المصري لكرة القدم' ('external.entity@example.com')
    And clicks 'إرسال'
    Then it gets a reference number in format YYYY/N/O with status 'تم الإرسال الخارجي'
    And the external entity receives the email with the same subject, body and 'قائمة_اللاعبين_المعتمدة.pdf' opening correctly
    #Arabic: التحقق من إرسال السجل البريد الخارجي للاتحاد ووصوله فعلياً بالمرفق سليم
  `), async ({ page, signIn, runId, adminApi, cleanup, registerPage, correspondenceForm }) => {
    const subject = autoName(runId, subjects.registryReply);
    const { documentId, efa } = await given(async () => {
      const prepared = await createData("create the request pending at the Registry, from كريم حسن", async () => {
        const club = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const association = await createFootballAssociation(adminApi, runId, cleanup, { email: 'external.entity@example.com' });
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        const registry = { id: await adminApi.recipientId(registryName), name: registryName };
        const karim = await AcmApi.as(credentialsOfPerson(club.person('كريم حسن')));
        try {
          const id = await karim.sendCorrespondence({ subject, register: false, recipients: [registry] });
          return { documentId: id, efa: association };
        } finally {
          await karim.dispose();
        }
      });
      await signIn('ADMIN');
      await registerPage.openRecord('Register', prepared.documentId);
      return prepared;
    });
    const sent = await when(async () => {
      // NOT YET SEEN: how a pending request is registered. Expected: the record gives the form back to complete
      // ('الاتجاه', 'النوع', the party) and send.
      const register = page.getByRole('button', { name: /^(تسجيل|قيد|تسجيل وإرسال)$/ }).first();
      if (await register.isVisible().catch(() => false)) {
        await register.click();
      }
      await correspondenceForm.chooseDirection(directions.outgoing.label);
      await correspondenceForm.chooseType(documentTypes.email.label);
      await correspondenceForm.pickRecipient(efa.name);
      return correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the Registry should send it: ${sent.error ?? ''}`).toBe(200);
      await registerPage.openRecord('Outbox', sent.documentId ?? documentId);
      expect(await registerPage.referenceNumber(), 'the outgoing reference number').toMatch(referencePattern.outgoing);
      await expect(registerPage.details, "the status 'تم الإرسال الخارجي'").toContainText('تم الإرسال الخارجي');
      blocked("the football association receives the e-mail with 'قائمة_اللاعبين_المعتمدة.pdf'", NO_TEST_INBOX);
    });
  });

  test(...scenario('ACM-11-03', `
    @Priority=2
    Scenario: Verify that an internal non-Registry user cannot send external mail directly
    Given 'كريم حسن' in 'إدارة الكرة' has no admin permissions
    When he tries to send a correspondence directly to 'الاتحاد المصري لكرة القدم'
    Then direct external sending is not allowed
    And he is guided to route it through 'السجل / Registry'
    #Arabic: التحقق من أن الإرسال الخارجي من إدارة الكرة يتم عبر السجل فقط
  `), async ({ runId, adminApi, cleanup, asAnotherUser }) => {
    const subject = autoName(runId, subjects.registryReply);
    const { karim, efa } = await given(async () => {
      const prepared = await createData('create the club with users and the football association', async () => {
        const club = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const association = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        return { club, association };
      });
      return { karim: await asAnotherUser(credentialsOfPerson(prepared.club.person('كريم حسن'))), efa: prepared.association };
    });
    const sent = await when(async () => {
      await karim.correspondenceForm.openCompose();
      await karim.correspondenceForm.fillMessage({ to: [efa.name], subject, body: subject });
      return karim.correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, 'sending straight to an external entity should be refused').not.toBe(200);
      await expect(karim.page.getByText(/السجل|Registry/).first(), "the message should point to 'السجل / Registry'").toBeVisible();
    });
  });
  test(...scenario('ACM-11-04', `
    @Priority=1
    Scenario: Verify that the Registry sends external mail to an external entity that is not registered in the system
    Given 'كريم حسن' sent 'طلب ودية تحضيرية' to 'السجل / Registry'
    And the entity 'نادي الإسماعيلي' does not exist in 'الجهات'
    When the admin registers it as 'صادر' of type 'بريد الكترونى'
    And adds 'نادي الإسماعيلي' with email 'ismaily.club@example.com' as 'الجهة المستقبِلة' and clicks 'إرسال'
    Then it gets a reference number in format YYYY/N/O with status 'تم الإرسال الخارجي'
    And 'نادي الإسماعيلي' receives the email with the same subject, body and attachments
    And 'نادي الإسماعيلي' is saved in 'الجهات' as external
    #Arabic: التحقق من إرسال السجل بريداً خارجياً لجهة غير مسجلة في النظام بعد إضافتها
  `), async ({ page, signIn, runId, adminApi, cleanup, mailboxPage, correspondenceForm, registerPage }) => {
    const subject = autoName(runId, 'طلب ودية تحضيرية');
    const ismaily = autoName(runId, 'نادي الإسماعيلي');
    await given(async () => {
      await createData('create the club with users and كريم حسن\'s request', async () => {
        const club = await createClub(adminApi, runId, cleanup, { withUsers: true });
        cleanup(() => adminApi.deleteAddressBookMatching(ismaily));
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        await requestToRegistry(adminApi, credentialsOfPerson(club.person('كريم حسن')), subject);
      });
      await signIn('ADMIN');
    });
    const sent = await when(async () => {
      await startRegistering(page, mailboxPage, correspondenceForm, subject);
      await correspondenceForm.openAddEntity();
      await correspondenceForm.fillNewEntity({ name: ismaily, email: autoEmail(runId, 'ismaily.club') });
      expect(await correspondenceForm.addAndChoose(), `'${ismaily}' should be added`).toBeLessThan(300);
      return correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the Registry should send it: ${sent.error ?? ''}`).toBe(200);
      await registerPage.openRecord('Outbox', sent.documentId as number);
      expect(await registerPage.referenceNumber(), 'the outgoing reference number').toMatch(referencePattern.outgoing);
      await expect(registerPage.details, "the status 'تم الإرسال الخارجي'").toContainText('تم الإرسال الخارجي');
      expect(await adminApi.recipientId(ismaily), `'${ismaily}' is saved in 'الجهات'`).toBeGreaterThan(0);
      blocked(`'${ismaily}' receives the e-mail`, NO_TEST_INBOX);
    });
  });

  test(...scenario('ACM-11-05', `
    @Priority=2
    Scenario: Verify that the Registry sends external mail to a sub-entity of the external entity
    Given 'لجنة المسابقات' exists under 'الاتحاد المصري لكرة القدم' with its email
    And 'كريم حسن' sent 'طلب تعديل موعد مباراة الأسبوع العاشر' to 'السجل / Registry'
    When the admin registers it as 'صادر' of type 'بريد الكترونى' to 'لجنة المسابقات' and clicks 'إرسال'
    Then it gets a reference number in format YYYY/N/O
    And the email is delivered to 'competitions.committee@example.com' only
    #Arabic: التحقق من إرسال السجل بريداً خارجياً للجنة المسابقات التابعة للاتحاد
  `), async ({ page, signIn, runId, adminApi, cleanup, mailboxPage, correspondenceForm, registerPage }) => {
    const subject = autoName(runId, 'طلب تعديل موعد مباراة الأسبوع العاشر');
    const committee = autoName(runId, 'لجنة المسابقات');
    await given(async () => {
      await createData('create the club with users, لجنة المسابقات and كريم حسن\'s request', async () => {
        const club = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        const committeeId = await adminApi.createEntity(committee, { type: 2, parentId: efa.id, email: autoEmail(runId, 'competitions.committee') });
        cleanup(() => adminApi.deleteAddressBookEntry(committeeId));
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        await requestToRegistry(adminApi, credentialsOfPerson(club.person('كريم حسن')), subject);
      });
      await signIn('ADMIN');
    });
    const sent = await when(async () => {
      await startRegistering(page, mailboxPage, correspondenceForm, subject);
      await correspondenceForm.pickRecipient(committee);
      return correspondenceForm.send();
    });
    await then(async () => {
      expect(sent.status, `the Registry should send it: ${sent.error ?? ''}`).toBe(200);
      await registerPage.openRecord('Outbox', sent.documentId as number);
      expect(await registerPage.referenceNumber(), 'the outgoing reference number').toMatch(referencePattern.outgoing);
      blocked(`the e-mail is delivered to '${committee}' only`, NO_TEST_INBOX);
    });
  });

  test(...scenario('ACM-11-06', `
    @Priority=2
    Scenario: Verify that external sending is blocked when the new external entity has an invalid email
    Given a correspondence from 'إدارة الكرة' is pending at 'السجل / Registry'
    When the admin adds a new external entity with the email 'ismaily.club@@example' while registering it as 'صادر' of type 'بريد الكترونى'
    Then 'أدخل بريدًا إلكترونيًا صحيحًا' is displayed
    And the correspondence stays pending at the Registry and is not sent
    #Arabic: التحقق من منع الإرسال الخارجي لجهة جديدة ببريد إلكتروني غير صحيح
  `), async ({ page, signIn, runId, adminApi, cleanup, mailboxPage, correspondenceForm }) => {
    const subject = autoName(runId, 'طلب من إدارة الكرة');
    const ismaily = autoName(runId, 'نادي الإسماعيلي');
    const requestId = await given(async () => {
      const id = await createData('create the club with users and a request pending at the Registry', async () => {
        const club = await createClub(adminApi, runId, cleanup, { withUsers: true });
        cleanup(() => adminApi.deleteAddressBookMatching(ismaily));
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        return requestToRegistry(adminApi, credentialsOfPerson(club.person('كريم حسن')), subject);
      });
      await signIn('ADMIN');
      return id;
    });
    const added = await when(async () => {
      await startRegistering(page, mailboxPage, correspondenceForm, subject);
      await correspondenceForm.openAddEntity();
      await correspondenceForm.fillNewEntity({ name: ismaily, email: 'ismaily.club@@example' });
      return correspondenceForm.addAndChoose();
    });
    await then(async () => {
      expect(added, 'an entity with that e-mail should not be added').toBeUndefined();
      await expect(correspondenceForm.newEntityDialog.getByText('أدخل بريدًا إلكترونيًا صحيحًا').first()).toBeVisible();
      expect(await adminApi.correspondenceIds('MailboxInbox', subject), 'the request stays pending at the Registry').toContain(requestId);
      expect(await adminApi.correspondenceIds('Outbox', subject), 'nothing is sent').toEqual([]);
    });
  });
});
