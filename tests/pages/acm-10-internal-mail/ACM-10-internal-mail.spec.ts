import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-10 - Internal Mail
// The test cases of "ACM-10 - Internal Mail.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-10 Internal Mail', () => {

  test(...scenario('ACM-10-01', `
    @Priority=1
    Scenario: Verify that internal mail between two employees is private to sender and recipient only
    Given 'كريم حسن' sends the internal message 'طلب صرف مكافآت الفوز بالدوري' to 'هشام رضا' from 'البريد الداخلي'
    When 'هشام رضا' logs in
    Then the message is in his 'الرسائل الواردة' and in 'كريم حسن' 'الرسائل الصادرة'
    When 'عمرو فتحي', 'محمد عادل' (entity manager) or the admin logs in
    Then the message is not visible in mailbox, 'البحث في كل السجلات', reports or by direct URL
    #Arabic: التحقق من خصوصية الرسالة الداخلية بين كريم حسن وهشام رضا وعدم اطّلاع مدير الجهة أو الأدمن عليها
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-10-02', `
    @Priority=3
    Scenario: Verify that an internal message can be saved as a draft and deleted
    Given the user is composing an internal message
    When the user saves it as a draft
    Then it appears in 'المسودات'
    When the user deletes a message
    Then it moves to 'المحذوفات'
    #Arabic: التحقق من حفظ الرسالة الداخلية كمسودة وحذفها
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-10-03', `
    @Priority=4
    Scenario: Verify that the internal mailbox filters work (unread only, date range, subject)
    Given messages exist in the inbox
    When the user applies 'غير المقروءة فقط', a date range or searches by subject
    Then only matching messages are displayed
    #Arabic: التحقق من فلاتر البريد الداخلي (غير المقروء، التاريخ، الموضوع)
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
