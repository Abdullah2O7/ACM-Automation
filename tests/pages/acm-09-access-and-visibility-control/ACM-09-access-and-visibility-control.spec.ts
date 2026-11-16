import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-09 - Access and Visibility Control
// The test cases of "ACM-09 - Access and Visibility Control.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

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
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-09-02', `
    @Priority=1
    Scenario: Verify that mail directed to a sub-entity is visible to the persons under that sub-entity
    Given 'تحديث قيمة اشتراكات الأعضاء لعام 2027' is directed to 'إدارة العضويات'
    When 'منى سعيد' (person of 'إدارة العضويات') logs in
    Then the mail is visible to her
    #Arabic: التحقق من أن البريد الموجّه لإدارة العضويات يظهر للأشخاص تحتها
  `), async () => {
    test.fixme(true, 'Not automated yet');
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
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-09-04', `
    @Priority=1
    Scenario: Verify that mail directed to the main entity is visible to all persons under it, including sub-entities
    Given 'دعوة لحضور اجتماع الجمعية العمومية العادية' is directed to 'النادي الأهلي'
    When 'محمد عادل', 'كريم حسن', 'عمرو فتحي', 'منى سعيد' and 'هشام رضا' log in
    Then the mail is visible to all of them
    #Arabic: التحقق من أن البريد الموجّه للنادي الأهلي يظهر لكل الأشخاص تحته بما فيهم أشخاص الإدارات الفرعية
  `), async () => {
    test.fixme(true, 'Not automated yet');
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
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
