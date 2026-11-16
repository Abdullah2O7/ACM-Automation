import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-15 - Reports and Audit Log
// The test cases of "ACM-15 - Reports and Audit Log.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

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
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-15-02', `
    @Priority=3
    Scenario: Verify that 'معدل التشغيل', 'تتبّع مسار المستند', 'نشاط المستخدم' and 'مؤشرات أداء المديرين' reports generate correct data
    Given data exists for the selected parameters
    When the user generates each report ('معدل التشغيل', 'تتبّع مسار المستند', 'نشاط المستخدم', 'مؤشرات أداء المديرين')
    Then the report shows data consistent with the system records
    #Arabic: التحقق من صحة بيانات تقارير معدل التشغيل وتتبع المستند ونشاط المستخدم ومؤشرات المديرين
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-15-03', `
    @Priority=4
    Scenario: Verify that report validation prevents an invalid date range
    Given the user is on Reports
    When the user sets 'من تاريخ' later than 'إلى تاريخ' or leaves required parameters empty
    And clicks 'معاينة'
    Then a validation message is displayed and no report is generated
    #Arabic: التحقق من منع إنشاء تقرير بفترة تاريخ غير صحيحة
  `), async () => {
    test.fixme(true, 'Not automated yet');
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
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-15-05', `
    @Priority=2
    Scenario: Verify that user actions are recorded in the audit log
    Given a user logs in and performs actions (create, send, archive, delete)
    When the admin opens 'سجل التدقيق'
    And filters by user, event and date range
    Then each action is listed with user, event and timestamp
    #Arabic: التحقق من تسجيل إجراءات المستخدمين في سجل التدقيق والفلترة عليه
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
