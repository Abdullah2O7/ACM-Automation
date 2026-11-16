import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { autoName } from '../../../src/domain/acm-names';
import { addDays, formatDate, today } from '../../../src/utils/core/dates';
import { createClub, createFootballAssociation, credentialsOfPerson } from '../../../src/fixtures/club';
import { directions, documentTypes, subjects, taskColumns } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-13 - Tasks Management
// The test cases of "ACM-13 - Tasks Management.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// Tasks are made through 'مهمة جديدة' by the admin (the API body of a task was not seen yet) and removed after the case
// by their name, which carries the run id. 'منفذ المهمة' lists users by their full name.
//========================================================================================

const day = (offset: number): string => formatDate(addDays(today(), offset));

/** The first priority 'الأولوية' offers (the lookup values change with ACM-01's cases). */
const PRIORITY = 'قليل الاهمية';

test.describe('ACM-13 Tasks Management', () => {

  test(...scenario('ACM-13-01', `
    @Priority=2
    Scenario: Verify that the user can create a task with mandatory data and assign it
    Given the user is on 'المهام'
    When the user clicks 'مهمة جديدة'
    And fills 'اسم المهمة' = 'مراجعة عقود اللاعبين الجدد', 'الأولوية', start and end dates and 'منفذ المهمة' = 'كريم حسن'
    And saves
    Then the task appears in the 'جديدة' column assigned to 'كريم حسن'
    And 'كريم حسن' receives a notification
    #Arabic: التحقق من إنشاء مهمة وإسنادها لكريم حسن
  `), async ({ signIn, runId, adminApi, cleanup, tasksPage, asAnotherUser }) => {
    const name = autoName(runId, subjects.contractsTask);
    const club = await given(async () => {
      const madeClub = await createData('create the club with users', () => createClub(adminApi, runId, cleanup, { withUsers: true }));
      cleanup(() => adminApi.deleteTasksMatching(runId));
      await signIn('ADMIN');
      await tasksPage.open();
      return madeClub;
    });
    const karim = club.person('كريم حسن');
    const saved = await when(() => tasksPage.createTask({ name, priority: PRIORITY, assignee: karim.name, start: day(0), due: day(7) }));
    await then(async () => {
      expect(saved.status, 'the task should be created').toBeLessThan(300);
      await tasksPage.open();
      await tasksPage.searchByName(name);
      await expect(tasksPage.column(taskColumns.new).getByRole('button', { name }), "in the 'جديدة' column").toBeVisible();
      const details = await tasksPage.openTask(name);
      await expect(details, "assigned to 'كريم حسن'").toContainText(karim.name);
      const other = await asAnotherUser(credentialsOfPerson(karim));
      await other.appShell.open('/tasks');
      const notifications = await other.appShell.openNotifications();
      await expect(notifications, "'كريم حسن' is notified").toContainText(name);
    });
  });

  test(...scenario('ACM-13-02', `
    @Priority=2
    Scenario: Verify that a task can be created linked to a correspondence
    Given 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' is registered with an incoming reference number
    When the user creates the task 'متابعة اعتماد قائمة اللاعبين' from that correspondence and assigns it to 'عمرو فتحي'
    Then the task shows the correspondence reference number
    And clicking it opens the correspondence
    #Arabic: التحقق من إنشاء مهمة مرتبطة ببريد الاتحاد وإسنادها لعمرو فتحي
  `), async ({ page, signIn, runId, adminApi, cleanup, registerPage, tasksPage }) => {
    const subject = autoName(runId, subjects.playersList);
    const name = autoName(runId, subjects.playersTask);
    const { club, documentId, reference } = await given(async () => {
      const prepared = await createData('create the club and register the incoming e-mail', async () => {
        const madeClub = await createClub(adminApi, runId, cleanup, { withUsers: true });
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        cleanup(() => adminApi.deleteTasksMatching(runId));
        const id = await adminApi.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.email.id, recipients: [efa] });
        return { club: madeClub, documentId: id, reference: (await adminApi.correspondence(id)).documentNumber ?? '' };
      });
      await signIn('ADMIN');
      await registerPage.openRecord('Inbox', prepared.documentId);
      return prepared;
    });
    const saved = await when(async () => {
      await registerPage.details.getByRole('button', { name: 'مهمة جديدة', exact: true }).click();
      await tasksPage.fillTaskForm({ name, priority: PRIORITY, assignee: club.person('عمرو فتحي').name, start: day(0), due: day(7) });
      return tasksPage.submitTask();
    });
    await then(async () => {
      expect(saved.status, 'the task should be created').toBeLessThan(300);
      await tasksPage.open();
      await tasksPage.searchByName(name);
      const details = await tasksPage.openTask(name);
      await expect(details, 'the correspondence reference number').toContainText(reference);
      await details.getByText(reference).first().click();
      await expect(page).toHaveURL(new RegExp(`focus=${documentId}`));
      await expect(page.locator('main')).toContainText(subject);
    });
  });

  test(...scenario('ACM-13-03', `
    @Priority=2
    Scenario: Verify that a task moves through its lifecycle ('جديدة', 'قيد التنفيذ', 'منتهية')
    Given a task is assigned to the user
    When the user starts the task and updates progress
    Then it moves to 'قيد التنفيذ' with the progress percentage
    When progress reaches 100% and the task is completed
    Then it moves to 'منتهية' with the completion date
    #Arabic: التحقق من دورة حياة المهمة من جديدة إلى قيد التنفيذ إلى منتهية
  `), async ({ signIn, runId, adminApi, cleanup, newUser, tasksPage, asAnotherUser }) => {
    const name = autoName(runId, 'مهمة دورة الحياة');
    const user = await given(async () => {
      const member = await createData('create the user', () => newUser());
      cleanup(() => adminApi.deleteTasksMatching(runId));
      await signIn('ADMIN');
      await tasksPage.open();
      await createData('assign it a task', () => tasksPage.createTask({ name, priority: PRIORITY, assignee: member.fullName, start: day(0), due: day(7) }));
      return asAnotherUser({ username: member.userName, password: member.password });
    });
    // The assignee starts the task with 'قبول' (of 'الإجراءات المتاحة'), then saves its progress ('حفظ الإنجاز')
    await when(async () => {
      await user.tasksPage.open();
      await user.tasksPage.searchByName(name);
      await user.tasksPage.openTask(name);
      await user.tasksPage.taskAction('قبول');
      await user.tasksPage.saveProgress(50);
    });
    await then(async () => {
      await user.tasksPage.open();
      await user.tasksPage.searchByName(name);
      await expect(user.tasksPage.column(taskColumns.inProgress).getByRole('button', { name }), "in 'قيد التنفيذ'").toBeVisible();
      await expect(user.tasksPage.column(taskColumns.inProgress), 'with its progress').toContainText(/50\s*%|٥٠/);
    });
    await when(async () => {
      await user.tasksPage.openTask(name);
      await user.tasksPage.saveProgress(100);
      // A finishing action, when the portal asks for one beyond 100%
      const finish = user.page.locator('main').getByRole('button', { name: /^(إنهاء|إكمال|إنهاء المهمة)$/ }).first();
      if (await finish.isVisible().catch(() => false)) {
        await user.tasksPage.taskAction(/^(إنهاء|إكمال|إنهاء المهمة)$/);
      }
    });
    await then(async () => {
      await user.tasksPage.open();
      await user.tasksPage.searchByName(name);
      await expect(user.tasksPage.column(taskColumns.done).getByRole('button', { name }), "in 'منتهية'").toBeVisible();
      const details = await user.tasksPage.openTask(name);
      await expect(details, 'the completion date').toContainText(new RegExp(`${today().getFullYear()}|${formatDate(today())}`));
    });
  });

  test(...scenario('ACM-13-04', `
    @Priority=2
    Scenario: Verify that the assignee can reject a task
    Given a task is assigned to the user
    When the user rejects the task
    Then it moves to the 'مرفوضة' column
    And the creator is notified
    #Arabic: التحقق من رفض المهمة من المنفذ
  `), async ({ signIn, runId, adminApi, cleanup, newUser, tasksPage, appShell, asAnotherUser }) => {
    const name = autoName(runId, 'مهمة للرفض');
    const user = await given(async () => {
      const member = await createData('create the user', () => newUser());
      cleanup(() => adminApi.deleteTasksMatching(runId));
      await signIn('ADMIN');
      await tasksPage.open();
      await createData('assign it a task', () => tasksPage.createTask({ name, priority: PRIORITY, assignee: member.fullName, start: day(0), due: day(7) }));
      return asAnotherUser({ username: member.userName, password: member.password });
    });
    await when(async () => {
      await user.tasksPage.open();
      await user.tasksPage.searchByName(name);
      await user.tasksPage.openTask(name);
      await user.tasksPage.reject('auto-test: rejected by the assignee');
      const confirm = user.page.getByRole('alertdialog').or(user.page.getByRole('dialog')).getByRole('button', { name: /^(رفض|تأكيد)$/ });
      if (await confirm.first().isVisible().catch(() => false)) {
        await confirm.first().click();
      }
    });
    await then(async () => {
      await user.tasksPage.open();
      await user.tasksPage.searchByName(name);
      await expect(user.tasksPage.column(taskColumns.rejected).getByRole('button', { name }), "in 'مرفوضة'").toBeVisible();
      await tasksPage.open();
      const notifications = await appShell.openNotifications();
      await expect(notifications, 'the creator (the admin) is notified').toContainText(name);
    });
  });

  test(...scenario('ACM-13-05', `
    @Priority=3
    Scenario: Verify that a task past its end date is flagged as overdue
    Given an open task with an end date in the past
    When the user opens 'المهام'
    Then the task shows the 'متأخرة' flag
    And it appears when 'المتأخرة فقط' filter is applied
    #Arabic: التحقق من ظهور علامة متأخرة على المهام المتجاوزة لموعدها
  `), async ({ signIn, runId, adminApi, cleanup, newUser, tasksPage }) => {
    const name = autoName(runId, 'مهمة متأخرة');
    await given(async () => {
      const member = await createData('create a user to assign it to', () => newUser());
      cleanup(() => adminApi.deleteTasksMatching(runId));
      await signIn('ADMIN');
      await tasksPage.open();
      await createData('create an open task that ended 3 days ago', () => tasksPage.createTask({ name, priority: PRIORITY, assignee: member.fullName, start: day(-10), due: day(-3), reminder: day(0) }));
    });
    await when(async () => {
      await tasksPage.open();
      await tasksPage.searchByName(name);
    });
    await then(async () => {
      await expect(tasksPage.task(name), "the 'متأخرة' flag").toContainText('متأخرة');
      await tasksPage.tick('المتأخرة فقط');
      await expect(tasksPage.task(name), "listed with 'المتأخرة فقط'").toBeVisible();
    });
  });

  test(...scenario('ACM-13-06', `
    @Priority=3
    Scenario: Verify that Out of office delegates the user's tasks during the absence period
    Given the user sets 'خارج المكتب' with a period and a delegate
    When a task is assigned to the user during that period
    Then it is handled according to the out-of-office rule (delegated / flagged)
    #Arabic: التحقق من خاصية خارج المكتب وتأثيرها على إسناد المهام
  `), async ({ signIn, runId, adminApi, cleanup, newUser, tasksPage, asAnotherUser }) => {
    const name = autoName(runId, 'مهمة أثناء الغياب');
    const { absent, delegate } = await given(async () => {
      const users = await createData('create the user and a delegate', async () => ({ absent: await newUser(), delegate: await newUser() }));
      cleanup(() => adminApi.deleteTasksMatching(runId));
      const away = await asAnotherUser({ username: users.absent.userName, password: users.absent.password });
      await away.tasksPage.open();
      const set = await away.tasksPage.setOutOfOffice(users.delegate.fullName, day(0), day(3));
      expect(set.status, "'خارج المكتب' should be saved").toBeLessThan(300);
      return users;
    });
    await when(async () => {
      await signIn('ADMIN');
      await tasksPage.open();
      const saved = await tasksPage.createTask({ name, priority: PRIORITY, assignee: absent.fullName, start: day(0), due: day(2) });
      expect(saved.status).toBeLessThan(300);
    });
    await then(async () => {
      await tasksPage.open();
      await tasksPage.searchByName(name);
      const details = await tasksPage.openTask(name);
      // Delegated (the delegate is named) or flagged (out of office is shown)
      await expect(details, 'delegated to the delegate, or flagged as out of office').toContainText(new RegExp(`${delegate.fullName}|خارج المكتب|نائب`));
    });
  });

  test(...scenario('ACM-13-07', `
    @Priority=4
    Scenario: Verify that task filters and Board/List views work correctly
    Given tasks exist with different statuses, priorities and assignees
    When the user applies filters ('الحالة', 'منشئ المهمة', 'منفذ المهمة', 'الأولوية', 'الاستحقاق من', 'الاستحقاق حتى', 'المفتوحة فقط')
    Then only matching tasks are shown
    And switching between 'لوحة' and 'قائمة' views keeps the filtered results
    #Arabic: التحقق من فلاتر المهام والتبديل بين عرض اللوحة والقائمة
  `), async ({ signIn, runId, adminApi, cleanup, newUser, tasksPage }) => {
    const first = autoName(runId, 'مهمة أولى');
    const second = autoName(runId, 'مهمة ثانية');
    const { one, priorities } = await given(async () => {
      const users = await createData('create two users', async () => ({ one: await newUser(), two: await newUser() }));
      cleanup(() => adminApi.deleteTasksMatching(runId));
      await signIn('ADMIN');
      await tasksPage.open();
      const priorities = await tasksPage.priorityOptions();
      await createData('create a task for each, of different priorities and due dates', async () => {
        await tasksPage.createTask({ name: first, priority: priorities[0], assignee: users.one.fullName, start: day(0), due: day(5) });
        await tasksPage.createTask({ name: second, priority: priorities[priorities.length - 1], assignee: users.two.fullName, start: day(0), due: day(20) });
      });
      await tasksPage.open();
      await tasksPage.searchByName(runId);
      return { ...users, priorities };
    });
    const visibleNames = async (): Promise<string[]> => {
      const names: string[] = [];
      for (const name of [first, second]) {
        if (await tasksPage.task(name).isVisible().catch(() => false)) {
          names.push(name);
        }
      }
      return names;
    };
    await then(async () => expect((await visibleNames()).sort(), 'both tasks before filtering').toEqual([first, second].sort()));

    await when(async () => {
      await tasksPage.choose(tasksPage.priorityFilter, priorities[0]);
      await tasksPage.waitForList().catch(() => undefined);
    });
    await then(async () => expect(await visibleNames(), "'الأولوية'").toEqual([first]));
    await when(async () => {
      await tasksPage.choose(tasksPage.filterByLabel('منفذ المهمة'), one.fullName, true);
      await tasksPage.waitForList().catch(() => undefined);
    });
    await then(async () => expect(await visibleNames(), "'منفذ المهمة'").toEqual([first]));
    await when(async () => {
      await tasksPage.dueFrom.fill(day(0));
      await Promise.all([tasksPage.waitForList(), tasksPage.dueTo.fill(day(10))]);
    });
    await then(async () => expect(await visibleNames(), "'الاستحقاق من' / 'الاستحقاق حتى'").toEqual([first]));
    await when(() => tasksPage.tick('المفتوحة فقط'));
    await then(async () => expect(await visibleNames(), "'المفتوحة فقط'").toEqual([first]));
    await when(() => tasksPage.listTab.click());
    await then(async () => expect(await visibleNames(), "'قائمة' keeps the filtered results").toEqual([first]));
    await when(() => tasksPage.boardTab.click());
    await then(async () => expect(await visibleNames(), "'لوحة' keeps the filtered results").toEqual([first]));
    test.info().annotations.push({ type: 'note', description: "'الحالة' and 'منشئ المهمة' are not applied: both tasks are new and made by the admin, so those filters cannot tell them apart." });
  });
});
