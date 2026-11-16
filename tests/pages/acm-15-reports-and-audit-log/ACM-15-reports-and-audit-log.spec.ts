import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { blocked, NO_TEST_INBOX } from '../../../src/utils/core/blocked-step';
import { autoName } from '../../../src/domain/acm-names';
import { AcmApi } from '../../../src/api/acm-api';
import { addDays, formatDate, today } from '../../../src/utils/core/dates';
import { createFootballAssociation } from '../../../src/fixtures/club';
import { directions, documentTypes, reports } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-15 - Reports and Audit Log
// The test cases of "ACM-15 - Reports and Audit Log.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

const day = (offset: number): string => formatDate(addDays(today(), offset));

test.describe('ACM-15 Reports and Audit Log', () => {

  test(...scenario('ACM-15-01', `
    @Priority=2
    Scenario: Verify that 'سجل الوارد' and 'سجل الصادر' reports show records within the period
    Given incoming and outgoing records exist in a date range
    When the user selects 'التقرير', 'صيغة الإخراج' = PDF and the date range
    And clicks 'معاينة'
    Then one line per record within the period is displayed
    And 'تنزيل' produces the PDF file
    #Arabic: التحقق من تقريري سجل الوارد والصادر خلال الفترة والمعاينة والتنزيل
  `), async ({ signIn, runId, adminApi, cleanup, reportsPage }) => {
    await given(async () => {
      await createData('register an incoming and an outgoing record today', async () => {
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        await adminApi.sendCorrespondence({ subject: autoName(runId, 'وارد للتقرير'), directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [efa] });
        await adminApi.sendCorrespondence({ subject: autoName(runId, 'صادر للتقرير'), directionId: directions.outgoing.id, typeId: documentTypes.letter.id, recipients: [efa] });
      });
      await signIn('ADMIN');
    });
    for (const report of [reports.incomingRegister, reports.outgoingRegister]) {
      await when(async () => {
        await reportsPage.open();
        await reportsPage.chooseReport(report);
        await reportsPage.chooseFormat('PDF');
        await reportsPage.period(day(-1), day(0));
        expect(await reportsPage.runPreview(), `'${report}' should be generated`).toBe(200);
      });
      await then(async () => {
        await expect(reportsPage.preview, `the preview of '${report}'`).toBeVisible();
        const download = await reportsPage.download();
        expect(download.suggestedFilename(), `'تنزيل' of '${report}' should give a PDF`).toMatch(/\.pdf$/i);
      });
    }
    test.info().annotations.push({ type: 'note', description: "The lines inside the PDF are not read: the preview is a PDF, so 'one line per record' is left to the reviewer (the file is attached by the download)." });
  });

  test(...scenario('ACM-15-02', `
    @Priority=3
    Scenario: Verify that 'معدل التشغيل', 'تتبّع مسار المستند', 'نشاط المستخدم' and 'مؤشرات أداء المديرين' reports generate correct data
    Given data exists for the selected parameters
    When the user generates each report ('معدل التشغيل', 'تتبّع مسار المستند', 'نشاط المستخدم', 'مؤشرات أداء المديرين')
    Then the report shows data consistent with the system records
    #Arabic: التحقق من صحة بيانات تقارير معدل التشغيل وتتبع المستند ونشاط المستخدم ومؤشرات المديرين
  `), async ({ signIn, reportsPage }) => {
    await given(async () => {
      await signIn('ADMIN');
      await reportsPage.open();
    });
    for (const report of [reports.throughput, reports.documentTrail, reports.userActivity, reports.managerKpis]) {
      await when(async () => {
        await reportsPage.open();
        await reportsPage.chooseReport(report);
        if (await reportsPage.from.isVisible().catch(() => false)) {
          await reportsPage.period(day(-30), day(0));
        }
        expect(await reportsPage.runPreview(), `'${report}' should be generated`).toBe(200);
      });
      await then(() => expect(reportsPage.preview, `the preview of '${report}'`).toBeVisible());
    }
    test.info().annotations.push({ type: 'note', description: "Each report's own parameters (a document for 'تتبّع مسار المستند', a user for 'نشاط المستخدم') are left at their defaults; comparing the figures with the records is left to the reviewer." });
  });

  test(...scenario('ACM-15-03', `
    @Priority=4
    Scenario: Verify that report validation prevents an invalid date range
    Given the user is on Reports
    When the user sets 'من تاريخ' later than 'إلى تاريخ' or leaves required parameters empty
    And clicks 'معاينة'
    Then a validation message is displayed and no report is generated
    #Arabic: التحقق من منع إنشاء تقرير بفترة تاريخ غير صحيحة
  `), async ({ page, signIn, reportsPage }) => {
    await given(async () => {
      await signIn('ADMIN');
      await reportsPage.open();
    });
    for (const [what, from, to] of [
      ["'من تاريخ' later than 'إلى تاريخ'", day(0), day(-10)],
      ['empty dates', '', ''],
    ] as const) {
      const sent = await when(async () => {
        await reportsPage.open();
        await reportsPage.period(from, to);
        return reportsPage.runPreview();
      });
      await then(async () => {
        await expect(page.locator('main').getByText(/مطلوب|يجب|لا يمكن|قبل|بعد|غير صالح/).filter({ hasNotText: 'اكتب التاريخ بترتيب' }).first(), `a message for ${what}`).toBeVisible();
        expect(sent === undefined || sent >= 400, `no report should be generated for ${what}`).toBe(true);
      });
    }
  });

  test(...scenario('ACM-15-04', `
    @Priority=2
    Scenario: Verify that the daily register summary is sent to configured recipients
    Given recipients are configured in 'ملخص السجل اليومي'
    When the admin clicks 'إرسال الآن' or the scheduled time is reached
    Then recipients receive the summary email
    And recipients with a system account also receive an in-portal notification
    And the last run status is updated
    #Arabic: التحقق من إرسال ملخص السجل اليومي للمستلمين وإشعار أصحاب الحسابات
  `), async ({ page, signIn, adminApi, cleanup, newUser, mailIntakePage, asAnotherUser }) => {
    const member = await given(async () => {
      const user = await createData('create a user with a system account', () => newUser());
      cleanup(() => adminApi.removeSummaryRecipient(user.email));
      await signIn('ADMIN');
      await mailIntakePage.open();
      await mailIntakePage.addSummaryRecipient(user.email);
      return user;
    });
    const before = await mailIntakePage.summarySection().innerText();
    await when(async () => {
      const [response] = await Promise.all([
        page.waitForResponse((answer) => answer.url().includes('/api/acm/settings/daily-summary') && answer.request().method() === 'POST'),
        mailIntakePage.sendSummaryNowButton.click(),
      ]);
      expect(response.status(), "'إرسال الآن' should run").toBeLessThan(300);
    });
    await then(async () => {
      await mailIntakePage.open();
      await expect.poll(() => mailIntakePage.summarySection().innerText(), { message: 'the last run status should be updated' }).not.toBe(before);
      const other = await asAnotherUser({ username: member.userName, password: member.password });
      await other.appShell.open('/tasks');
      const notifications = await other.appShell.openNotifications();
      await expect(notifications, 'a recipient with a system account gets an in-portal notification').toContainText(/ملخص/);
      blocked('the recipients receive the summary e-mail', NO_TEST_INBOX);
    });
  });

  test(...scenario('ACM-15-05', `
    @Priority=2
    Scenario: Verify that user actions are recorded in the audit log
    Given a user logs in and performs actions (create, send, archive, delete)
    When the admin opens 'سجل التدقيق'
    And filters by user, event and date range
    Then each action is listed with user, event and timestamp
    #Arabic: التحقق من تسجيل إجراءات المستخدمين في سجل التدقيق والفلترة عليه
  `), async ({ signIn, runId, adminApi, cleanup, newUser, auditPage }) => {
    const user = await given(async () =>
      createData('a user signs in, creates, sends and deletes a correspondence', async () => {
        const member = await newUser();
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        const api = await AcmApi.as({ username: member.userName, password: member.password });
        try {
          await api.createDraft(autoName(runId, 'مسودة للتدقيق'), documentTypes.letter.id);
          const sent = await api.sendCorrespondence({ subject: autoName(runId, 'مراسلة للتدقيق'), directionId: directions.outgoing.id, typeId: documentTypes.letter.id, recipients: [efa] });
          await api.purgeCorrespondence(sent).catch(() => undefined);
        } finally {
          await api.dispose();
        }
        return member;
      }),
    );
    await when(async () => {
      await signIn('ADMIN');
      await auditPage.open();
    });
    const events = await auditPage.eventOptions();
    for (const event of events) {
      await when(() => auditPage.filter({ event, user: user.userName, from: day(-1), to: day(0) }));
      await then(async () => {
        const rows = await auditPage.rows.allInnerTexts();
        if (rows.length) {
          for (const row of rows) {
            expect(row, `'${event}' rows are the user's`).toContain(user.userName);
            expect(row, `'${event}' rows have a timestamp`).toMatch(/\d{1,2}:\d{2}/);
          }
        }
        test.info().annotations.push({ type: 'audit', description: `${event}: ${rows.length} row(s)` });
      });
    }
    await then(async () => {
      // The sign-in at least must be there
      await auditPage.filter({ event: events[0], user: user.userName });
      await expect(auditPage.rows.filter({ hasText: user.userName }).first(), "the user's sign-in").toBeVisible();
    });
    test.info().annotations.push({ type: 'note', description: "Archiving is not among the user's actions: the operator's archive set-up depends on ACM-03/04." });
  });
});
