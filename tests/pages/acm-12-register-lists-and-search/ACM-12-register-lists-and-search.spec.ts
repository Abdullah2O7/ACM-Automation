import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-12 - Register Lists and Search
// The test cases of "ACM-12 - Register Lists and Search.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-12 Register Lists and Search', () => {

  test(...scenario('ACM-12-01', `
    @Priority=3
    Scenario: Verify that searching by subject and by body works with the 3-character minimum
    Given records exist with known subject and body text
    When the user searches by subject
    Then matching records are listed
    When the user enables 'البحث في متن الرسالة أيضًا' and types less than 3 characters
    Then the hint 'يتطلب البحث في المتن ثلاثة أحرف على الأقل.' is shown
    #Arabic: التحقق من البحث بالموضوع والمتن وشرط الثلاثة أحرف
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-12-02', `
    @Priority=3
    Scenario: Verify that filter and sort in the register return correct results
    Given the user is on 'الصادر و الوارد'
    When the user applies 'تصفية' ('الاتجاه', 'النوع', date range, 'مجلد البريد')
    And sorts by 'الموضوع', 'الرقم المرجعي' or 'التاريخ'
    Then only matching records are shown in the correct order
    #Arabic: التحقق من التصفية والترتيب في سجل الصادر والوارد
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-12-03', `
    @Priority=3
    Scenario: Verify that read/unread status updates when opening a correspondence
    Given an unread correspondence exists
    When the user opens it
    Then it is shown as 'مقروء'
    And the folder unread counter decreases
    #Arabic: التحقق من تحديث حالة المقروء/غير المقروء والعدادات
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-12-04', `
    @Priority=3
    Scenario: Verify that correspondence can be moved to Spam and Deleted and restored
    Given a record exists in 'الوارد'
    When the user marks it as spam or deletes it
    Then it moves to the 'المزعجة' or 'المحذوفة' folder
    And the user can restore it to its original folder
    #Arabic: التحقق من نقل المراسلة للمزعجة أو المحذوفة واسترجاعها
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-12-05', `
    @Priority=4
    Scenario: Verify that pagination in the register works correctly
    Given more than 50 records exist
    When the user navigates pages or changes page size
    Then the correct records and 'عرض x–y من z' are displayed
    #Arabic: التحقق من الترقيم والتنقل بين الصفحات في السجل
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
