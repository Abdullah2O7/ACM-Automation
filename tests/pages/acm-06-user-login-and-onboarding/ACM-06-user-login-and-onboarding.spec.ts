import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { asSetup } from '../../../src/utils/core/setup-step';
import { autoPassword } from '../../../src/domain/acm-names';
import { messages, routes } from '../../../test-data/acm/acm.data';

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
  `), async ({ page, newUser, runId, loginPage, appShell }) => {
    // A new account is flagged 'يجب تغيير كلمة المرور' by the portal itself (seen in the users list)
    const user = await given(() => asSetup('create a new user', () => newUser({ firstSignIn: false })));
    await when(async () => {
      await loginPage.open();
      await loginPage.signIn(user.userName, user.temporaryPassword);
    });
    await then(async () => {
      // Not signed in: the form asks for a new password instead
      await expect(page.getByText(messages.temporaryPasswordAccepted)).toBeVisible();
      await loginPage.expectOnLoginPage();
      // No page of the system opens before the password is changed
      await loginPage.expectRouteRedirectsToLogin(routes.register);
      // Setting a new password is what lets the user in
      await loginPage.open();
      await loginPage.signIn(user.userName, user.temporaryPassword);
      await loginPage.chooseNewPasswordLink.click();
      await loginPage.chooseNewPassword(user.userName, user.temporaryPassword, autoPassword(runId));
      await appShell.expectSignedIn();
    });
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
  `), async ({ newUser, loginPage }) => {
    // A user of the case's own: wrong passwords on a shared account could lock it for the team
    const user = await given(async () => {
      const created = await asSetup('create an active user', () => newUser());
      await loginPage.open();
      return created;
    });
    const status = await when(() => loginPage.signIn(user.userName, `${user.password}-wrong`));
    await then(async () => {
      expect(status, 'the server should refuse the sign-in').toBe(401);
      await expect(loginPage.alert).toContainText(messages.invalidCredentials);
      await loginPage.expectOnLoginPage();
    });
  });

  test(...scenario('ACM-06-03', `
    @Priority=2
    Scenario: Verify that the user can log out and protected pages are no longer accessible
    Given the user is logged in
    When the user logs out from the 'الحساب' menu
    Then the user is redirected to the login page
    And opening any system URL redirects back to login
    #Arabic: التحقق من تسجيل الخروج وعدم إمكانية الوصول للصفحات بعده
  `), async ({ newUser, signIn, appShell, loginPage }) => {
    await given(async () => {
      const user = await asSetup('create an active user', () => newUser());
      await signIn({ username: user.userName, password: user.password });
      await appShell.open(routes.dashboard);
    });
    await when(() => appShell.signOut());
    await then(async () => {
      await loginPage.expectOnLoginPage();
      for (const route of [routes.register, routes.archive, routes.tasks, routes.dashboard]) {
        await loginPage.expectRouteRedirectsToLogin(route);
      }
    });
  });
});
