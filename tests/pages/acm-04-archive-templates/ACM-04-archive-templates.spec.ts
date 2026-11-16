import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-04 - Archive Templates
// The test cases of "ACM-04 - Archive Templates.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-04 Archive Templates', () => {

  test(...scenario('ACM-04-01', `
    @Priority=1
    Scenario: Verify that the admin can create one archive template with mandatory and optional index fields of every data type
    Given the folders 'أرشيف إدارة الكرة', 'أرشيف إدارة العضويات' and 'أرشيف الإدارة المالية' exist
    When the admin is on 'القوالب' and creates 'قالب أرشفة مراسلات النادي الأهلي'
    And links it to the 3 sub-folders under 'أرشيف النادي الأهلي 2026'
    And adds the mandatory index fields 'رقم خطاب الجهة' (نص), 'القيمة المالية' (رقم), 'تاريخ الخطاب' (تاريخ), 'تصنيف المراسلة' (قائمة: طلب / إخطار / مطالبة) and 'يتطلب رد' (نعم/لا)
    And adds the optional index fields 'ملاحظات الأرشفة' (نص), 'عدد الصفحات' (رقم), 'تاريخ المتابعة' (تاريخ), 'درجة الأهمية' (قائمة: عادي / مهم / عاجل) and 'تم الرد' (نعم/لا)
    And saves
    Then the template card shows 10 index fields and 3 folders
    And each field keeps its data type and its mandatory / optional setting when the template is reopened
    And the template is available when archiving into any of the 3 sub-folders
    #Arabic: التحقق من إنشاء قالب أرشفة واحد للنادي الأهلي فيه حقل إلزامي وحقل اختياري لكل نوع بيانات
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-04-02', `
    @Priority=3
    Scenario: Verify that the admin can edit and delete an archive template
    Given 'قالب أرشفة مراسلات النادي الأهلي' exists
    When the admin adds the optional index field 'رقم الفاتورة' (نص) and saves
    Then the template card shows 11 index fields and the new field appears in new archives
    And documents archived before the change keep their values
    When the admin deletes the unused template 'قالب أرشفة مؤقت'
    Then it is removed from the list
    #Arabic: التحقق من تعديل قالب أرشفة النادي الأهلي وحذف قالب غير مستخدم
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
