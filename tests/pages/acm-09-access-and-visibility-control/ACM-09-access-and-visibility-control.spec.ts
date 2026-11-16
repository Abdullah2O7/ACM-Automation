import { test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { autoName } from '../../../src/domain/acm-names';
import { AcmApi } from '../../../src/api/acm-api';
import { credentialsOf } from '../../../src/config/auth-state';
import { createClub, createFootballAssociation, credentialsOfPerson, type Club } from '../../../src/fixtures/club';
import { expectDoesNotSee, expectReceived, expectSeesInRegister } from '../../../src/fixtures/visibility';
import { directions, documentTypes, subjects } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-09 - Access and Visibility Control
// The test cases of "ACM-09 - Access and Visibility Control.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// The mail is registered by a separate disposable user (not the admin and not a club person), so that whoever is
// checked does not see it only because they wrote it. Every club person gets a user ('مشغل').
//========================================================================================

type Cleanup = (step: () => Promise<unknown>) => void;

/** Registers an incoming e-mail from the football association directed to an entity or a person; returns its id. */
const registerDirectedMail = async (
  adminApi: AcmApi,
  author: { username: string; password: string },
  runId: string,
  cleanup: Cleanup,
  subject: string,
  to: { id: number; name: string },
): Promise<number> => {
  await createFootballAssociation(adminApi, runId, cleanup);
  cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
  const api = await AcmApi.as(author);
  try {
    return await api.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.email.id, recipients: [to] });
  } finally {
    await api.dispose();
  }
};

const personTarget = (club: Club, name: string): { id: number; name: string } => ({ id: club.person(name).personId, name: club.person(name).name });

test.describe('ACM-09 Access and Visibility Control', () => {

  test(...scenario('ACM-09-01', `
    @Priority=1
    Scenario: Verify that mail directed to a specific person in an internal entity is visible only to that person
    Given 'تقرير تقييم أداء الجهاز الفني' is directed to the person 'كريم حسن' in 'إدارة الكرة'
    When 'كريم حسن' logs in
    Then the mail is visible to him
    When 'عمرو فتحي' (same sub-entity), 'محمد عادل' (main entity), 'منى سعيد', 'هشام رضا' or the admin logs in
    Then the mail is not visible in lists, counters or 'البحث في كل السجلات'
    And opening its direct URL is denied
    #Arabic: التحقق من أن البريد الموجّه لكريم حسن لا يطّلع عليه أحد غيره حتى زميله في نفس الإدارة أو الأدمن
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const subject = autoName(runId, subjects.coachReport);
    const { club, documentId } = await given(() =>
      createData('create the club with users and the mail directed to كريم حسن', async () => {
        const madeClub = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const author = await newUser();
        const id = await registerDirectedMail(adminApi, { username: author.userName, password: author.password }, runId, cleanup, subject, personTarget(madeClub, 'كريم حسن'));
        return { club: madeClub, documentId: id };
      }),
    );
    const karim = await when(() => asAnotherUser(credentialsOfPerson(club.person('كريم حسن'))));
    await then(() => expectReceived(karim, subject, 'كريم حسن'));
    for (const name of ['عمرو فتحي', 'محمد عادل', 'منى سعيد', 'هشام رضا', 'admin']) {
      const other = await when(() => asAnotherUser(name === 'admin' ? credentialsOf('ADMIN') : credentialsOfPerson(club.person(name))));
      await then(() => expectDoesNotSee(other, documentId, subject, name));
    }
    test.info().annotations.push({ type: 'note', description: 'Counters are not compared here: they count every record of the shared portal, so one record more or less cannot be told apart reliably.' });
  });

  test(...scenario('ACM-09-02', `
    @Priority=1
    Scenario: Verify that mail directed to a sub-entity is visible to the persons under that sub-entity
    Given 'تحديث قيمة اشتراكات الأعضاء لعام 2027' is directed to 'إدارة العضويات'
    When 'منى سعيد' (person of 'إدارة العضويات') logs in
    Then the mail is visible to her
    #Arabic: التحقق من أن البريد الموجّه لإدارة العضويات يظهر للأشخاص تحتها
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const subject = autoName(runId, subjects.membershipFees);
    const club = await given(() =>
      createData('create the club with users and the mail directed to إدارة العضويات', async () => {
        const madeClub = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const author = await newUser();
        await registerDirectedMail(adminApi, { username: author.userName, password: author.password }, runId, cleanup, subject, { id: madeClub.entityIds.members, name: madeClub.entityNames.members });
        return madeClub;
      }),
    );
    const mona = await when(() => asAnotherUser(credentialsOfPerson(club.person('منى سعيد'))));
    await then(() => expectReceived(mona, subject, 'منى سعيد'));
  });

  test(...scenario('ACM-09-03', `
    @Priority=1
    Scenario: Verify that mail directed to a sub-entity is not visible to users outside it, even from the main entity
    Given 'تحديث قيمة اشتراكات الأعضاء لعام 2027' is directed to 'إدارة العضويات'
    When 'محمد عادل' (main entity 'النادي الأهلي') logs in
    Or 'كريم حسن', 'عمرو فتحي' and 'هشام رضا' log in
    Then the mail is not visible to any of them
    And opening its direct URL is denied
    #Arabic: التحقق من عدم ظهور بريد إدارة العضويات لمن هم خارجها حتى لو من الجهة الرئيسية
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const subject = autoName(runId, subjects.membershipFees);
    const { club, documentId } = await given(() =>
      createData('create the club with users and the mail directed to إدارة العضويات', async () => {
        const madeClub = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const author = await newUser();
        const id = await registerDirectedMail(adminApi, { username: author.userName, password: author.password }, runId, cleanup, subject, { id: madeClub.entityIds.members, name: madeClub.entityNames.members });
        return { club: madeClub, documentId: id };
      }),
    );
    for (const name of ['محمد عادل', 'كريم حسن', 'عمرو فتحي', 'هشام رضا']) {
      const other = await when(() => asAnotherUser(credentialsOfPerson(club.person(name))));
      await then(() => expectDoesNotSee(other, documentId, subject, name));
    }
  });

  test(...scenario('ACM-09-04', `
    @Priority=1
    Scenario: Verify that mail directed to the main entity is visible to all persons under it, including sub-entities
    Given 'دعوة لحضور اجتماع الجمعية العمومية العادية' is directed to 'النادي الأهلي'
    When 'محمد عادل', 'كريم حسن', 'عمرو فتحي', 'منى سعيد' and 'هشام رضا' log in
    Then the mail is visible to all of them
    #Arabic: التحقق من أن البريد الموجّه للنادي الأهلي يظهر لكل الأشخاص تحته بما فيهم أشخاص الإدارات الفرعية
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const subject = autoName(runId, subjects.generalAssembly);
    const club = await given(() =>
      createData('create the club with users and the mail directed to النادي الأهلي', async () => {
        const madeClub = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const author = await newUser();
        await registerDirectedMail(adminApi, { username: author.userName, password: author.password }, runId, cleanup, subject, { id: madeClub.entityIds.main, name: madeClub.entityNames.main });
        return madeClub;
      }),
    );
    for (const person of club.persons) {
      const other = await when(() => asAnotherUser(credentialsOfPerson(person)));
      await then(() => expectReceived(other, subject, person.sheetName));
    }
  });

  test(...scenario('ACM-09-05', `
    @Priority=1
    Scenario: Verify that the admin can view mail directed to entities but not mail directed to a specific person
    Given 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' is directed to 'إدارة الكرة'
    And 'تقرير تقييم أداء الجهاز الفني' is directed to the person 'كريم حسن'
    When the admin logs in
    Then 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' is visible to the admin
    And 'تقرير تقييم أداء الجهاز الفني' is not visible in lists, search or by direct URL
    #Arabic: التحقق من أن الأدمن يرى البريد الموجّه لإدارة الكرة ولا يرى البريد الموجّه لكريم حسن
  `), async ({ runId, adminApi, cleanup, newUser, asAnotherUser }) => {
    const toEntity = autoName(runId, subjects.playersList);
    const toPerson = autoName(runId, subjects.coachReport);
    const personMailId = await given(() =>
      createData('create the club and the two mails', async () => {
        const madeClub = await createClub(adminApi, runId, cleanup);
        const author = await newUser();
        const credentials = { username: author.userName, password: author.password };
        await registerDirectedMail(adminApi, credentials, runId, cleanup, toEntity, { id: madeClub.entityIds.football, name: madeClub.entityNames.football });
        return registerDirectedMail(adminApi, credentials, `${runId}-2`, cleanup, toPerson, personTarget(madeClub, 'كريم حسن'));
      }),
    );
    const admin = await when(() => asAnotherUser(credentialsOf('ADMIN')));
    await then(async () => {
      await expectSeesInRegister(admin, 'Inbox', toEntity, 'the admin');
      await expectDoesNotSee(admin, personMailId, toPerson, 'the admin');
    });
  });
});
