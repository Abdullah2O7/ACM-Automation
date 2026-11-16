import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-14 - Dashboard and Notifications
// The test cases of "ACM-14 - Dashboard and Notifications.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-14 Dashboard and Notifications', () => {

  test(...scenario('ACM-14-01', `
    @Priority=3
    Scenario: Verify that dashboard counters match the actual number of records in each list
    Given the user is logged in
    When the user opens 'اللوحة الرئيسية'
    Then counters ('تحتاج تصنيفًا', 'مهام جديدة', 'البريد الوارد', 'بانتظار الحفظ', 'مسودات', 'قيد التنفيذ') match the records in their lists
    And clicking each counter opens the related filtered list
    #Arabic: التحقق من تطابق عدادات اللوحة الرئيسية مع عدد السجلات الفعلي وفتح القائمة الصحيحة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-14-02', `
    @Priority=4
    Scenario: Verify that dashboard quick actions open the correct screens
    Given the user is on the dashboard
    When the user clicks 'تسجيل مراسلة', 'إرسال رسالة داخلية', 'ابدأ مهامي الجديدة' and 'ابحث في الأرشيف'
    Then each action opens its related screen
    #Arabic: التحقق من أن الإجراءات السريعة في اللوحة الرئيسية تفتح الشاشات الصحيحة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-14-03', `
    @Priority=3
    Scenario: Verify that the global search returns matching records from all modules
    Given records exist with a known subject
    When the user searches the subject using 'البحث في كل السجلات'
    Then matching records are listed
    And opening a result shows the record details
    #Arabic: التحقق من البحث العام في كل السجلات وفتح النتيجة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-14-04', `
    @Priority=3
    Scenario: Verify that in-portal notifications are received and open the related record
    Given a task is assigned or a message is sent to the user
    When the user opens 'الإشعارات'
    Then a new notification is displayed
    And clicking it opens the related record
    #Arabic: التحقق من استلام الإشعارات داخل البوابة وفتح السجل المرتبط
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
