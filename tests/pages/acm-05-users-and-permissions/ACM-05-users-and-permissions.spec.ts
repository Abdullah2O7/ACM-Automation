import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-05 - Users and Permissions
// The test cases of "ACM-05 - Users and Permissions.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-05 Users and Permissions', () => {

  test(...scenario('ACM-05-01', `
    @Priority=1
    Scenario: Verify that a system user is created for each person by selecting the person from the persons list
    Given the 5 persons exist under 'النادي الأهلي' and its sub-entities
    When the admin is on 'الإدارة' > 'المستخدمون' and clicks 'مستخدم جديد'
    And searches the persons list for 'محمد عادل' and selects him
    And fills 'اسم المستخدم' and the role and saves
    And repeats the same for 'كريم حسن', 'عمرو فتحي', 'منى سعيد' and 'هشام رضا'
    Then each user appears in 'المستخدمون' list as 'مفعّل' with the selected person's name and email
    And each user is linked to the correct person and entity
    #Arabic: التحقق من إنشاء يوزر لكل شخص من أشخاص النادي الأهلي باختياره من قائمة الأشخاص وربطه بجهته
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-05-02', `
    @Priority=1
    Scenario: Verify that OTP is disabled automatically for users created by the admin
    Given the admin creates the users of 'محمد عادل', 'كريم حسن', 'عمرو فتحي', 'منى سعيد' and 'هشام رضا'
    When each user creation is saved
    Then OTP is disabled for the user by default
    And the admin is not asked for any OTP during creation
    When any of the new users logs in
    Then no OTP is requested
    #Arabic: التحقق من تعطيل الـ OTP تلقائياً ليوزرز النادي الأهلي وعدم طلبه أثناء الإنشاء أو الدخول
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-05-03', `
    @Priority=2
    Scenario: Verify that a duplicate username or a second user for the same person is rejected
    Given a user already exists for the person 'كريم حسن'
    When the admin clicks 'مستخدم جديد' and selects 'كريم حسن' again
    Or enters an 'اسم المستخدم' that already exists for another user
    And saves
    Then a duplicate validation message is displayed, or 'كريم حسن' is not available for selection
    And no new user is created
    #Arabic: التحقق من رفض تكرار اسم المستخدم أو إنشاء يوزر ثاني لنفس الشخص
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-05-04', `
    @Priority=2
    Scenario: Verify that the admin can deactivate and reactivate a user
    Given an active user exists
    When the admin deactivates the user
    Then the status shows 'معطّل' and the user cannot log in
    When the admin reactivates the user
    Then the user can log in again
    #Arabic: التحقق من تعطيل وإعادة تفعيل المستخدم
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-05-05', `
    @Priority=4
    Scenario: Verify that users list search and status filter work
    Given users with different statuses exist
    When the admin searches by 'اسم المستخدم', 'الاسم الكامل' or 'البريد الإلكتروني'
    And filters by 'المفعّل وغير المفعّل'
    Then only matching users are shown
    #Arabic: التحقق من البحث والفلترة في قائمة المستخدمين
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-05-06', `
    @Priority=3
    Scenario: Verify that a disabled role cannot be assigned to users
    Given a role template is disabled
    When the admin creates or edits a user
    Then the disabled role is not available for selection
    #Arabic: التحقق من عدم إمكانية إسناد دور معطّل للمستخدمين
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-05-07', `
    @Priority=1
    Scenario: Verify that a user's access follows the permissions of the assigned role
    Given a user is assigned the 'مشغل' role
    When the user logs in
    Then operational modules are available
    And 'الإدارة' screens are hidden and blocked by direct URL
    #Arabic: التحقق من تطبيق صلاحيات الدور ومنع المشغّل من الوصول لشاشات الإدارة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
