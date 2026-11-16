import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-03 - Archive Folders
// The test cases of "ACM-03 - Archive Folders.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-03 Archive Folders', () => {

  test(...scenario('ACM-03-01', `
    @Priority=1
    Scenario: Verify that the admin can create a main archive folder with sub-folders for the entity
    Given the admin is on 'الأرشيف'
    When the admin clicks 'مجلد رئيسي جديد' and creates 'أرشيف النادي الأهلي 2026'
    And creates the sub-folders 'أرشيف إدارة الكرة', 'أرشيف إدارة العضويات' and 'أرشيف الإدارة المالية' under it
    Then the hierarchy shows 'أرشيف النادي الأهلي 2026' with the 3 sub-folders nested under it
    And each folder shows a documents count of 0
    #Arabic: التحقق من إنشاء مجلد أرشيف رئيسي للنادي الأهلي وتحته مجلدات فرعية لكل إدارة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-03-02', `
    @Priority=3
    Scenario: Verify that archive folder management allows renaming and deleting folders
    Given 'أرشيف إدارة العضويات' exists under 'أرشيف النادي الأهلي 2026'
    When the user renames it to 'أرشيف شؤون العضويات'
    Then the new name is shown in the hierarchy
    When the user deletes the empty folder 'مجلد مؤقت'
    Then it is removed
    #Arabic: التحقق من إعادة تسمية مجلد أرشيف العضويات وحذف مجلد فارغ
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
