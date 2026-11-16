import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-13 - Tasks Management
// The test cases of "ACM-13 - Tasks Management.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

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
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-13-02', `
    @Priority=2
    Scenario: Verify that a task can be created linked to a correspondence
    Given 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' is registered with an incoming reference number
    When the user creates the task 'متابعة اعتماد قائمة اللاعبين' from that correspondence and assigns it to 'عمرو فتحي'
    Then the task shows the correspondence reference number
    And clicking it opens the correspondence
    #Arabic: التحقق من إنشاء مهمة مرتبطة ببريد الاتحاد وإسنادها لعمرو فتحي
  `), async () => {
    test.fixme(true, 'Not automated yet');
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
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-13-04', `
    @Priority=2
    Scenario: Verify that the assignee can reject a task
    Given a task is assigned to the user
    When the user rejects the task
    Then it moves to the 'مرفوضة' column
    And the creator is notified
    #Arabic: التحقق من رفض المهمة من المنفذ
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-13-05', `
    @Priority=3
    Scenario: Verify that a task past its end date is flagged as overdue
    Given an open task with an end date in the past
    When the user opens 'المهام'
    Then the task shows the 'متأخرة' flag
    And it appears when 'المتأخرة فقط' filter is applied
    #Arabic: التحقق من ظهور علامة متأخرة على المهام المتجاوزة لموعدها
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-13-06', `
    @Priority=3
    Scenario: Verify that Out of office delegates the user's tasks during the absence period
    Given the user sets 'خارج المكتب' with a period and a delegate
    When a task is assigned to the user during that period
    Then it is handled according to the out-of-office rule (delegated / flagged)
    #Arabic: التحقق من خاصية خارج المكتب وتأثيرها على إسناد المهام
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-13-07', `
    @Priority=4
    Scenario: Verify that task filters and Board/List views work correctly
    Given tasks exist with different statuses, priorities and assignees
    When the user applies filters ('الحالة', 'منشئ المهمة', 'منفذ المهمة', 'الأولوية', 'الاستحقاق من', 'الاستحقاق حتى', 'المفتوحة فقط')
    Then only matching tasks are shown
    And switching between 'لوحة' and 'قائمة' views keeps the filtered results
    #Arabic: التحقق من فلاتر المهام والتبديل بين عرض اللوحة والقائمة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
