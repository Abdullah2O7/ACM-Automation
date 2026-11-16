import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { autoName } from '../../../src/domain/acm-names';
import { addDays, formatDate, today } from '../../../src/utils/core/dates';
import { createFootballAssociation } from '../../../src/fixtures/club';
import { dashboardCounters, quickActions } from '../../../src/pages/dashboard/dashboard.page';
import { directions, documentTypes } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-14 - Dashboard and Notifications
// The test cases of "ACM-14 - Dashboard and Notifications.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

/** The z of "عرض x–y من z" of the list shown, or the number of task cards when there is none. */
const listTotal = async (page: import('@playwright/test').Page): Promise<number> => {
  const range = page.getByText(/عرض \S+–\S+ من \S+/).first();
  if (await range.isVisible().catch(() => false)) {
    const text = (await range.innerText()).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    return Number(text.match(/\d+/g)?.pop() ?? 'NaN');
  }
  return page.locator('main tbody tr').count();
};

test.describe('ACM-14 Dashboard and Notifications', () => {

  test(...scenario('ACM-14-01', `
    @Priority=3
    Scenario: Verify that dashboard counters match the actual number of records in each list
    Given the user is logged in
    When the user opens 'اللوحة الرئيسية'
    Then counters ('تحتاج تصنيفًا', 'مهام جديدة', 'البريد الوارد', 'بانتظار الحفظ', 'مسودات', 'قيد التنفيذ') match the records in their lists
    And clicking each counter opens the related filtered list
    #Arabic: التحقق من تطابق عدادات اللوحة الرئيسية مع عدد السجلات الفعلي وفتح القائمة الصحيحة
  `), async ({ page, signIn, dashboardPage }) => {
    await given(() => signIn('ADMIN'));
    await when(() => dashboardPage.open());
    for (const counter of dashboardCounters) {
      await then(async () => {
        await dashboardPage.open();
        const shown = await dashboardPage.counterValue(counter.label);
        await dashboardPage.counter(counter.label).click();
        await expect(page, `'${counter.label}' should open its list`).toHaveURL(counter.url);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        expect(await listTotal(page), `'${counter.label}' should match its list`).toBe(shown);
      });
    }
  });

  test(...scenario('ACM-14-02', `
    @Priority=4
    Scenario: Verify that dashboard quick actions open the correct screens
    Given the user is on the dashboard
    When the user clicks 'تسجيل مراسلة', 'إرسال رسالة داخلية', 'ابدأ مهامي الجديدة' and 'ابحث في الأرشيف'
    Then each action opens its related screen
    #Arabic: التحقق من أن الإجراءات السريعة في اللوحة الرئيسية تفتح الشاشات الصحيحة
  `), async ({ page, signIn, dashboardPage }) => {
    await given(async () => {
      await signIn('ADMIN');
      await dashboardPage.open();
    });
    for (const action of quickActions) {
      await when(async () => {
        await dashboardPage.open();
        await dashboardPage.quickAction(action.label).click();
      });
      await then(() => expect(page, `'${action.label}' should open its screen`).toHaveURL(action.url));
    }
  });

  test(...scenario('ACM-14-03', `
    @Priority=3
    Scenario: Verify that the global search returns matching records from all modules
    Given records exist with a known subject
    When the user searches the subject using 'البحث في كل السجلات'
    Then matching records are listed
    And opening a result shows the record details
    #Arabic: التحقق من البحث العام في كل السجلات وفتح النتيجة
  `), async ({ page, signIn, runId, adminApi, cleanup, appShell }) => {
    const subject = autoName(runId, 'بحث عام');
    await given(async () => {
      await createData('register a record with a known subject', async () => {
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        await adminApi.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [efa] });
      });
      await signIn('ADMIN');
      await appShell.open('/secretary/register?folder=Inbox');
    });
    const results = await when(() => appShell.searchEverything(subject));
    await then(async () => {
      await expect(results.first(), 'the record should be found').toBeVisible();
      await results.first().click();
      await expect(page.locator('main'), 'the record details').toContainText(subject);
      await expect(page.locator('main').getByText('تفاصيل الرسالة').first()).toBeVisible();
    });
  });

  test(...scenario('ACM-14-04', `
    @Priority=3
    Scenario: Verify that in-portal notifications are received and open the related record
    Given a task is assigned or a message is sent to the user
    When the user opens 'الإشعارات'
    Then a new notification is displayed
    And clicking it opens the related record
    #Arabic: التحقق من استلام الإشعارات داخل البوابة وفتح السجل المرتبط
  `), async ({ signIn, runId, adminApi, cleanup, newUser, tasksPage, asAnotherUser }) => {
    const name = autoName(runId, 'مهمة للإشعار');
    const user = await given(async () => {
      const member = await createData('create the user', () => newUser());
      cleanup(() => adminApi.deleteTasksMatching(runId));
      await signIn('ADMIN');
      await tasksPage.open();
      await createData('assign it a task', () =>
        tasksPage.createTask({ name, priority: 'قليل الاهمية', assignee: member.fullName, start: formatDate(today()), due: formatDate(addDays(today(), 5)) }),
      );
      return asAnotherUser({ username: member.userName, password: member.password });
    });
    const panel = await when(async () => {
      await user.appShell.open('/tasks');
      return user.appShell.openNotifications();
    });
    await then(async () => {
      const notification = panel.getByText(name).first();
      await expect(notification, 'a notification of the task').toBeVisible();
      await notification.click();
      await expect(user.page, 'it opens the task').toHaveURL(/\/tasks/);
      await expect(user.page.locator('body')).toContainText(name);
    });
  });
});
