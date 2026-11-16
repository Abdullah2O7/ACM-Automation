import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-02 - Entities and Persons
// The test cases of "ACM-02 - Entities and Persons.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-02 Entities and Persons', () => {

  test(...scenario('ACM-02-01', `
    @Priority=1
    Scenario: Verify that the admin can create an internal main entity with three sub-entities
    Given the admin is on 'الجهات'
    When the admin creates the internal main entity 'النادي الأهلي'
    And creates the sub-entities 'إدارة الكرة', 'إدارة العضويات' and 'الإدارة المالية' under it
    Then the tree shows 'النادي الأهلي' with the 3 sub-entities nested under it
    And 'نوع الجهة' is internal
    #Arabic: التحقق من إنشاء جهة رئيسية داخلية (النادي الأهلي) وتحتها 3 جهات فرعية
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-02-02', `
    @Priority=1
    Scenario: Verify that persons can be registered under the main entity and each sub-entity with a unique email
    Given 'النادي الأهلي' and its 3 sub-entities exist
    When the admin clicks 'شخص جديد' and adds 'محمد عادل' under 'النادي الأهلي'
    And adds 'كريم حسن' and 'عمرو فتحي' under 'إدارة الكرة'
    And adds 'منى سعيد' under 'إدارة العضويات' and 'هشام رضا' under 'الإدارة المالية'
    And each person has a unique email
    Then each person appears under the correct entity in the tree
    #Arabic: التحقق من تسجيل أشخاص تحت النادي الأهلي وكل إدارة فرعية ببريد مختلف لكل شخص
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-02-03', `
    @Priority=1
    Scenario: Verify that an external entity can be created with a person
    Given the admin is on 'الجهات'
    When the admin creates the external entity 'الاتحاد المصري لكرة القدم'
    And adds the person 'مسؤول المراسلات' with email 'external.entity@example.com'
    Then the entity appears with 'نوع الجهة' external
    And it can be selected as 'الجهة المستقبِلة' for outgoing correspondence
    #Arabic: التحقق من إنشاء الجهة الخارجية الاتحاد المصري لكرة القدم وإضافة شخص ببريد إلكتروني عليها
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-02-04', `
    @Priority=3
    Scenario: Verify that an entity or person can be edited and deleted
    Given an entity or person is selected
    When the user edits its data and saves
    Then the changes are displayed
    When the user deletes a record not used in correspondence
    Then it is removed from the tree
    #Arabic: التحقق من تعديل وحذف جهة أو شخص
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-02-05', `
    @Priority=4
    Scenario: Verify that searching entities and persons filters the tree
    Given the entities tree contains many records
    When the user searches by name
    Then only matching entities and persons are displayed
    #Arabic: التحقق من البحث في الجهات والأشخاص
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
