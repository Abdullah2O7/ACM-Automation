import { expect, test, type OtherUser } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { autoName } from '../../../src/domain/acm-names';
import { credentialsOf } from '../../../src/config/auth-state';
import { createClub, credentialsOfPerson } from '../../../src/fixtures/club';
import { expectDoesNotSee, expectSeesInMailbox } from '../../../src/fixtures/visibility';
import { mailboxFolders, subjects } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-10 - Internal Mail
// The test cases of "ACM-10 - Internal Mail.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// Folders of 'البريد الداخلي' are opened through the 'البحث في كل السجلات' palette ('البريد الداخلي · <folder>').
//========================================================================================

const section = (folder: string): string => `البريد الداخلي · ${folder}`;

const todayText = (offsetDays = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

/** Sends an internal message as the user of that browser ('رسالة جديدة'); returns its document id. */
const sendMessage = async (sender: OtherUser, to: string[], subject: string): Promise<number> => {
  await sender.correspondenceForm.openCompose();
  await sender.correspondenceForm.fillMessage({ to, subject, body: subject });
  const sent = await sender.correspondenceForm.send();
  expect(sent.status, `the message should be sent: ${sent.error ?? ''}`).toBe(200);
  return sent.documentId as number;
};

test.describe('ACM-10 Internal Mail', () => {

  test(...scenario('ACM-10-01', `
    @Priority=1
    Scenario: Verify that internal mail between two employees is private to sender and recipient only
    Given 'كريم حسن' sends the internal message 'طلب صرف مكافآت الفوز بالدوري' to 'هشام رضا' from 'البريد الداخلي'
    When 'هشام رضا' logs in
    Then the message is in his 'الرسائل الواردة' and in 'كريم حسن' 'الرسائل الصادرة'
    When 'عمرو فتحي', 'محمد عادل' (entity manager) or the admin logs in
    Then the message is not visible in mailbox, 'البحث في كل السجلات', reports or by direct URL
    #Arabic: التحقق من خصوصية الرسالة الداخلية بين كريم حسن وهشام رضا وعدم اطّلاع مدير الجهة أو الأدمن عليها
  `), async ({ runId, adminApi, cleanup, asAnotherUser }) => {
    const subject = autoName(runId, subjects.bonuses);
    const { club, karim, documentId } = await given(async () => {
      const madeClub = await createData('create the club with users', () => createClub(adminApi, runId, cleanup, { withUsers: true }));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      // كريم حسن writes the message himself, from 'البريد الداخلي' > 'رسالة جديدة'
      const sender = await asAnotherUser(credentialsOfPerson(madeClub.person('كريم حسن')));
      await sender.correspondenceForm.openCompose();
      await sender.correspondenceForm.fillMessage({ to: [madeClub.person('هشام رضا').name], subject, body: subject });
      const sent = await sender.correspondenceForm.send();
      expect(sent.status, `the message should be sent: ${sent.error ?? ''}`).toBe(200);
      return { club: madeClub, karim: sender, documentId: sent.documentId as number };
    });
    const hesham = await when(() => asAnotherUser(credentialsOfPerson(club.person('هشام رضا'))));
    await then(async () => {
      await expectSeesInMailbox(hesham, section(mailboxFolders.inbox), subject, 'هشام رضا');
      await expectSeesInMailbox(karim, section(mailboxFolders.sent), subject, 'كريم حسن');
    });
    for (const name of ['عمرو فتحي', 'محمد عادل', 'admin']) {
      const other = await when(() => asAnotherUser(name === 'admin' ? credentialsOf('ADMIN') : credentialsOfPerson(club.person(name))));
      await then(() => expectDoesNotSee(other, documentId, subject, name));
    }
    test.info().annotations.push({ type: 'note', description: "'التقارير' are not searched here: the registers report official correspondence, not internal mail." });
  });

  test(...scenario('ACM-10-02', `
    @Priority=3
    Scenario: Verify that an internal message can be saved as a draft and deleted
    Given the user is composing an internal message
    When the user saves it as a draft
    Then it appears in 'المسودات'
    When the user deletes a message
    Then it moves to 'المحذوفات'
    #Arabic: التحقق من حفظ الرسالة الداخلية كمسودة وحذفها
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const draftSubject = autoName(runId, 'مسودة رسالة داخلية');
    const { user } = await given(async () => {
      const { member, colleague } = await createData('create the user and a colleague', async () => {
        // Deleting needs 'mailbox:delete': the 'مشغل' role has none (its selection offers only 'إلغاء التحديد'), so the
        // user is given 'مدير التطبيق', the role template that has it
        const created = await newUser({ role: 'admin' });
        const other = await newUser();
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        return { member: created, colleague: other };
      });
      const opened = await asAnotherUser({ username: member.userName, password: member.password });
      await opened.correspondenceForm.openCompose();
      await opened.correspondenceForm.fillMessage({ to: [colleague.fullName], subject: draftSubject, body: draftSubject });
      return { user: opened };
    });
    const saved = await when(() => user.correspondenceForm.saveDraft());
    await then(async () => {
      expect(saved.status, 'the draft should be saved').toBe(200);
      await expectSeesInMailbox(user, section(mailboxFolders.drafts), draftSubject, 'the user');
    });
    // A received message offers no delete action (seen live 2026-11-16: only 'رد', 'رد على الجميع', 'إعادة إرسال');
    // the user's own draft is deleted with 'تجاهل' of its form
    await when(async () => {
      await user.mailboxPage.open();
      await user.appShell.goTo(section(mailboxFolders.drafts));
      await user.mailboxPage.search(draftSubject);
      // Deleting in 'البريد الداخلي' (seen live 2026-11-16): tick the message, then the selection's 'حذف المحدّد'
      await user.mailboxPage.deleteSelected(draftSubject);
    });
    await then(() => expectSeesInMailbox(user, section(mailboxFolders.deleted), draftSubject, 'the user'));
  });

  test(...scenario('ACM-10-03', `
    @Priority=4
    Scenario: Verify that the internal mailbox filters work (unread only, date range, subject)
    Given messages exist in the inbox
    When the user applies 'غير المقروءة فقط', a date range or searches by subject
    Then only matching messages are displayed
    #Arabic: التحقق من فلاتر البريد الداخلي (غير المقروء، التاريخ، الموضوع)
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const read = autoName(runId, 'رسالة مقروءة');
    const unread = autoName(runId, 'رسالة غير مقروءة');
    const user = await given(async () => {
      const member = await createData('create the user and two messages to it', async () => {
        const created = await newUser();
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        for (const subject of [read, unread]) {
          await adminApi.sendCorrespondence({ subject, register: false, recipients: [{ id: created.personId, name: created.fullName }] });
        }
        return created;
      });
      const opened = await asAnotherUser({ username: member.userName, password: member.password });
      await opened.mailboxPage.open();
      await opened.mailboxPage.search(read);
      await opened.mailboxPage.openMessage(read);
      await opened.mailboxPage.open();
      return opened;
    });
    // Which of the case's two messages the list shows, once it has settled
    const listed = async (): Promise<string[]> => {
      const rows = await user.mailboxPage.rows.allInnerTexts();
      return [read, unread].filter((subject) => rows.some((row) => row.includes(subject))).sort();
    };
    const expectListed = (expected: string[], message: string): Promise<void> => expect.poll(listed, { message }).toEqual([...expected].sort());

    await when(() => user.mailboxPage.search(runId));
    await then(() => expectListed([read, unread], 'both messages by the run id'));

    await when(() => user.mailboxPage.toggleUnreadOnly());
    await then(() => expectListed([unread], "'غير المقروءة فقط'"));
    await when(() => user.mailboxPage.toggleUnreadOnly());

    await when(() => user.mailboxPage.dateRange(todayText(-1), todayText()));
    await then(() => expectListed([read, unread], 'both messages are of today'));
    await when(() => user.mailboxPage.dateRange(todayText(-30), todayText(-10)));
    await then(() => expectListed([], 'none is in a past range'));
    await when(() => user.mailboxPage.dateRange(todayText(-1), todayText()));

    await when(() => user.mailboxPage.search(unread));
    await then(() => expectListed([unread], 'search by subject'));
  });
  test(...scenario('ACM-10-04', `
    @Priority=1
    Scenario: Verify that internal mail sent from a sub-entity user to the main entity is received by all persons under it
    Given 'كريم حسن' in 'إدارة الكرة' is on 'البريد الداخلي'
    When he sends 'دعوة لحضور حفل تكريم أبطال الدوري' to 'النادي الأهلي'
    Then the message appears in his 'الرسائل الصادرة'
    And it appears in 'الرسائل الواردة' of 'محمد عادل', 'عمرو فتحي', 'منى سعيد' and 'هشام رضا'
    And it is not visible to users outside 'النادي الأهلي'
    #Arabic: التحقق من وصول البريد الداخلي المرسل من إدارة الكرة للنادي الأهلي لكل الأشخاص تحته وظهوره في صادر المرسل
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const subject = autoName(runId, 'دعوة لحضور حفل تكريم أبطال الدوري');
    const { club, karim, outsider } = await given(async () => {
      const prepared = await createData('create the club with users, and a user outside it', async () => ({
        madeClub: await createClub(adminApi, runId, cleanup, { withUsers: true }),
        other: await newUser(),
      }));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      return { club: prepared.madeClub, karim: await asAnotherUser(credentialsOfPerson(prepared.madeClub.person('كريم حسن'))), outsider: prepared.other };
    });
    const documentId = await when(() => sendMessage(karim, [club.entityNames.main], subject));
    await then(async () => {
      await expectSeesInMailbox(karim, section(mailboxFolders.sent), subject, 'كريم حسن');
      for (const name of ['محمد عادل', 'عمرو فتحي', 'منى سعيد', 'هشام رضا']) {
        await expectSeesInMailbox(await asAnotherUser(credentialsOfPerson(club.person(name))), section(mailboxFolders.inbox), subject, name);
      }
      await expectDoesNotSee(await asAnotherUser({ username: outsider.userName, password: outsider.password }), documentId, subject, 'a user outside النادي الأهلي');
    });
  });

  test(...scenario('ACM-10-05', `
    @Priority=2
    Scenario: Verify that internal mail sent to another department reaches only that department
    Given 'هشام رضا' in 'الإدارة المالية' is on 'البريد الداخلي'
    When he sends 'طلب كشف اشتراكات الأعضاء المتأخرة' to 'إدارة العضويات'
    Then the message appears in his 'الرسائل الصادرة' and in 'منى سعيد' 'الرسائل الواردة'
    And it is not visible to 'كريم حسن', 'عمرو فتحي' or 'محمد عادل'
    #Arabic: التحقق من وصول البريد الداخلي الموجّه لإدارة العضويات لأشخاصها فقط
  `), async ({ runId, adminApi, cleanup, asAnotherUser }) => {
    const subject = autoName(runId, 'طلب كشف اشتراكات الأعضاء المتأخرة');
    const { club, hesham } = await given(async () => {
      const madeClub = await createData('create the club with users', () => createClub(adminApi, runId, cleanup, { withUsers: true }));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      return { club: madeClub, hesham: await asAnotherUser(credentialsOfPerson(madeClub.person('هشام رضا'))) };
    });
    const documentId = await when(() => sendMessage(hesham, [club.entityNames.members], subject));
    await then(async () => {
      await expectSeesInMailbox(hesham, section(mailboxFolders.sent), subject, 'هشام رضا');
      await expectSeesInMailbox(await asAnotherUser(credentialsOfPerson(club.person('منى سعيد'))), section(mailboxFolders.inbox), subject, 'منى سعيد');
      for (const name of ['كريم حسن', 'عمرو فتحي', 'محمد عادل']) {
        await expectDoesNotSee(await asAnotherUser(credentialsOfPerson(club.person(name))), documentId, subject, name);
      }
    });
  });

  test(...scenario('ACM-10-06', `
    @Priority=2
    Scenario: Verify that internal mail between two colleagues of the same department is private to them
    Given 'كريم حسن' and 'عمرو فتحي' are both in 'إدارة الكرة'
    When 'كريم حسن' sends 'ملاحظات على خطة الإعداد البدني' to 'عمرو فتحي'
    Then the message appears in 'كريم حسن' 'الرسائل الصادرة' and 'عمرو فتحي' 'الرسائل الواردة'
    When 'محمد عادل', 'منى سعيد', 'هشام رضا' or the admin logs in
    Then the message is not visible in mailbox, 'البحث في كل السجلات' or by direct URL
    #Arabic: التحقق من خصوصية البريد الداخلي بين زميلين في نفس الإدارة
  `), async ({ runId, adminApi, cleanup, asAnotherUser }) => {
    const subject = autoName(runId, 'ملاحظات على خطة الإعداد البدني');
    const { club, karim } = await given(async () => {
      const madeClub = await createData('create the club with users', () => createClub(adminApi, runId, cleanup, { withUsers: true }));
      cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
      return { club: madeClub, karim: await asAnotherUser(credentialsOfPerson(madeClub.person('كريم حسن'))) };
    });
    const documentId = await when(() => sendMessage(karim, [club.person('عمرو فتحي').name], subject));
    await then(async () => {
      await expectSeesInMailbox(karim, section(mailboxFolders.sent), subject, 'كريم حسن');
      await expectSeesInMailbox(await asAnotherUser(credentialsOfPerson(club.person('عمرو فتحي'))), section(mailboxFolders.inbox), subject, 'عمرو فتحي');
    });
    for (const name of ['محمد عادل', 'منى سعيد', 'هشام رضا', 'admin']) {
      const other = await when(() => asAnotherUser(name === 'admin' ? credentialsOf('ADMIN') : credentialsOfPerson(club.person(name))));
      await then(() => expectDoesNotSee(other, documentId, subject, name));
    }
  });
});
