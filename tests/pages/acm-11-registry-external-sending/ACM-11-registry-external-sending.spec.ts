import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-11 - Registry External Sending
// The test cases of "ACM-11 - Registry External Sending.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-11 Registry External Sending', () => {

  test(...scenario('ACM-11-01', `
    @Priority=1
    Scenario: Verify that an internal user sends an external mail request with an attachment to the Registry
    Given 'كريم حسن' in 'إدارة الكرة' needs to reply to 'الاتحاد المصري لكرة القدم'
    When he creates 'رد النادي الأهلي بشأن اعتماد قائمة اللاعبين المقيدين' directed to 'السجل / Registry'
    And attaches 'قائمة_اللاعبين_المعتمدة.pdf'
    And clicks 'إرسال'
    Then the correspondence appears in the Registry's 'بانتظار التسجيل' list with the attachment
    #Arabic: التحقق من إرسال طلب البريد الخارجي بمرفق من إدارة الكرة إلى السجل
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-11-02', `
    @Priority=1
    Scenario: Verify that the Registry sends the external mail with its attachment to the external entity
    Given 'رد النادي الأهلي بشأن اعتماد قائمة اللاعبين المقيدين' is pending at the Registry
    When the admin (or a user with admin permissions) registers it as 'صادر' of type 'بريد الكترونى' to 'الاتحاد المصري لكرة القدم' ('external.entity@example.com')
    And clicks 'إرسال'
    Then it gets a reference number in format YYYY/N/O with status 'تم الإرسال الخارجي'
    And the external entity receives the email with the same subject, body and 'قائمة_اللاعبين_المعتمدة.pdf' opening correctly
    #Arabic: التحقق من إرسال السجل البريد الخارجي للاتحاد ووصوله فعلياً بالمرفق سليم
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-11-03', `
    @Priority=2
    Scenario: Verify that an internal non-Registry user cannot send external mail directly
    Given 'كريم حسن' in 'إدارة الكرة' has no admin permissions
    When he tries to send a correspondence directly to 'الاتحاد المصري لكرة القدم'
    Then direct external sending is not allowed
    And he is guided to route it through 'السجل / Registry'
    #Arabic: التحقق من أن الإرسال الخارجي من إدارة الكرة يتم عبر السجل فقط
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
