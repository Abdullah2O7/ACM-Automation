import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-01 - Login and System Settings
// The test cases of "ACM-01 - Login and System Settings.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-01 Login and System Settings', () => {

  test(...scenario('ACM-01-01', `
    @Priority=1
    Scenario: Verify that an active user can log in with valid credentials
    Given the user is on the login page
    When the user enters a valid 'اسم المستخدم' and 'كلمة المرور'
    And clicks 'تسجيل الدخول'
    Then the user is redirected to the dashboard
    And the user name and role appear in the header
    #Arabic: التحقق من تسجيل الدخول بنجاح ببيانات صحيحة لمستخدم مفعّل
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-02', `
    @Priority=4
    Scenario: Verify that switching language between Arabic and English updates the UI and layout direction
    Given the UI is in Arabic (default)
    When the user clicks 'تغيير اللغة'
    Then labels are displayed in English with LTR layout
    And switching back restores Arabic with RTL layout
    #Arabic: التحقق من تبديل اللغة بين العربية والإنجليزية واتجاه الصفحة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-03', `
    @Priority=2
    Scenario: Verify that the admin can add a lookup value and it appears in related dropdowns
    Given the admin is on 'أكواد النظام'
    When the admin selects a 'نوع الكود' ('الأقسام', 'الأولوية', 'نوع الجهة', 'نوع الوثيقة')
    And clicks 'إضافة' and fills 'الكود', 'العربية', 'الإنجليزية' and 'الفرنسية'
    And clicks 'حفظ الجدول'
    Then the value is saved
    And appears in the related dropdowns across the system
    #Arabic: التحقق من إضافة قيمة في أكواد النظام وظهورها في القوائم المرتبطة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-04', `
    @Priority=3
    Scenario: Verify that a deactivated lookup value no longer appears in dropdowns
    Given a lookup value is active
    When the admin deactivates it and saves
    Then it is no longer available in new records
    And existing records keep their value
    #Arabic: التحقق من إخفاء قيمة الكود المعطّلة من القوائم مع الحفاظ على السجلات القديمة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-05', `
    @Priority=4
    Scenario: Verify that lookup values display according to their sort order and duplicate codes are rejected
    Given lookup values exist
    When the admin changes the order and saves
    Then dropdowns display values in the new order
    When the admin adds a value with an existing code
    Then a duplicate validation message is shown
    #Arabic: التحقق من ترتيب قيم الأكواد ورفض الكود المكرر
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-06', `
    @Priority=1
    Scenario: Verify that the admin can create a role template with selected permissions
    Given the admin is on 'قوالب الأدوار'
    When the admin clicks 'قالب جديد' and fills 'الكود', 'الاسم' and selected 'الصلاحيات'
    Then it appears in the list with the correct permissions count and 'مفعّل' status
    #Arabic: التحقق من إنشاء قالب دور بصلاحيات محددة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-07', `
    @Priority=3
    Scenario: Verify that entity identity and logo are saved and printed on labels and cover
    Given the admin is on 'الإعدادات' > 'هوية الجهة'
    When the admin saves 'اسم الجهة', 'الاسم المختصر', 'العنوان' and uploads 'الشعار' (PNG/JPEG/GIF/BMP ≤ 1 MB)
    Then the short name is printed on labels
    And the logo appears on the correspondence cover
    #Arabic: التحقق من حفظ هوية الجهة والشعار وظهورهم في الملصقات وغلاف المراسلة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-08', `
    @Priority=4
    Scenario: Verify that uploading a logo larger than 1 MB or unsupported type is rejected
    Given the admin is on 'الإعدادات' > 'الشعار'
    When the admin uploads a file larger than 1 MB or of an unsupported type
    Then the upload is rejected with a validation message
    #Arabic: التحقق من رفض شعار أكبر من 1 ميجابايت أو بصيغة غير مدعومة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-09', `
    @Priority=1
    Scenario: Verify that the admin can add an IMAP mailbox and the service connects
    Given the admin is on 'الإعدادات' > 'استقبال البريد'
    When the admin clicks 'إضافة صندوق بريد' and fills server, port, SSL and 'كلمة مرور التطبيق'
    Then the mailbox is saved with status 'يستقبل'
    And the password is never displayed again, only 'saved' status
    #Arabic: التحقق من إضافة صندوق بريد IMAP واتصاله وعدم عرض كلمة المرور
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-01-10', `
    @Priority=1
    Scenario: Verify that SMTP settings can be saved and a test email is delivered
    Given the admin is on 'الإعدادات' > 'البريد الخارجي (SMTP)'
    When the admin enables 'تفعيل الإرسال الخارجي' and fills 'خادم SMTP', 'المنفذ', 'وضع التشفير', 'عنوان المرسل', 'اسم المرسل', 'مستخدم SMTP' and 'كلمة المرور'
    And clicks 'حفظ' then 'إرسال بريد اختبار'
    Then the test email is received successfully
    #Arabic: التحقق من حفظ إعدادات SMTP وإرسال بريد اختبار
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
