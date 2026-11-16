import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-06 - User Login and Onboarding
// The test cases of "ACM-06 - User Login and Onboarding.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-06 User Login and Onboarding', () => {

  test(...scenario('ACM-06-01', `
    @Priority=2
    Scenario: Verify that a user flagged 'يجب تغيير كلمة المرور' is forced to change it on first login
    Given a new user account is flagged 'يجب تغيير كلمة المرور'
    When the user logs in for the first time
    Then the system forces the user to set a new password before accessing the system
    #Arabic: التحقق من إجبار المستخدم الجديد على تغيير كلمة المرور عند أول دخول
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-06-02', `
    @Priority=2
    Scenario: Verify that login fails with an invalid password
    Given the user is on the login page
    When the user enters a valid 'اسم المستخدم' and a wrong 'كلمة المرور'
    And clicks 'تسجيل الدخول'
    Then an invalid credentials error message is displayed
    And the user stays on the login page
    #Arabic: التحقق من رفض تسجيل الدخول بكلمة مرور خاطئة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-06-03', `
    @Priority=2
    Scenario: Verify that the user can log out and protected pages are no longer accessible
    Given the user is logged in
    When the user logs out from the 'الحساب' menu
    Then the user is redirected to the login page
    And opening any system URL redirects back to login
    #Arabic: التحقق من تسجيل الخروج وعدم إمكانية الوصول للصفحات بعده
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
