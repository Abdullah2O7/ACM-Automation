import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-07 - Official Correspondence
// The test cases of "ACM-07 - Official Correspondence.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-07 Official Correspondence', () => {

  test(...scenario('ACM-07-01', `
    @Priority=1
    Scenario: Verify that the user can register an incoming letter with all mandatory fields
    Given the user is on the correspondence creation page ('الصادر و الوارد' > 'إنشاء')
    When the user selects 'الاتجاه' = 'وارد' and 'النوع' = 'خطاب'
    And fills 'تاريخ المراسلة', 'الجهة المستقبِلة' = 'النادي الأهلي', 'الموضوع' = 'إخطار بمواعيد مباريات الدور الأول' and 'النص'
    And sets the sender as 'الاتحاد المصري لكرة القدم'
    And clicks 'إرسال'
    Then the record is saved with an auto reference number in format YYYY/N/I
    And it appears in the 'الوارد' folder
    #Arabic: التحقق من تسجيل خطاب وارد من الاتحاد المصري لكرة القدم للنادي الأهلي وتوليد الرقم المرجعي بصيغة الوارد
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-02', `
    @Priority=1
    Scenario: Verify that the user can create and send an outgoing fax correspondence
    Given the user is on the correspondence creation page ('الصادر و الوارد' > 'إنشاء')
    When the user selects 'الاتجاه' = 'صادر' and 'النوع' = 'فاكس'
    And fills 'الموضوع' = 'تأكيد حضور اجتماع لجنة المسابقات', 'النص' and the other mandatory fields
    And selects 'الجهة المستقبِلة' = 'الاتحاد المصري لكرة القدم'
    And clicks 'إرسال'
    Then the record gets a reference number in format YYYY/N/O
    And it appears in the 'الصادر' folder
    #Arabic: التحقق من إنشاء وإرسال فاكس صادر للاتحاد المصري لكرة القدم وتوليد الرقم المرجعي بصيغة الصادر
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-03', `
    @Priority=2
    Scenario: Verify that mandatory field validation is shown when saving empty correspondence
    Given the user is on the correspondence creation page ('الصادر و الوارد' > 'إنشاء')
    When the user clicks 'إرسال' without filling 'تاريخ المراسلة', 'الجهة المستقبِلة', 'الموضوع' and 'النص'
    Then 'حقل مطلوب' is displayed under each mandatory field
    And the record is not saved
    #Arabic: التحقق من ظهور رسائل الحقول الإلزامية عند الإرسال بدون بيانات
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-04', `
    @Priority=2
    Scenario: Verify that a correspondence saved as draft remains editable
    Given the user filled the correspondence form
    When the user clicks 'حفظ كمسودة'
    Then the record appears in the 'المسودات' folder
    And the user can open and edit it
    #Arabic: التحقق من حفظ المراسلة كمسودة وإمكانية تعديلها
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-05', `
    @Priority=1
    Scenario: Verify that a sent or registered correspondence becomes read-only
    Given a correspondence has been sent
    When the user opens it
    Then all fields are read-only
    And no edit action is available
    #Arabic: التحقق من أن المراسلة بعد الإرسال أو القيد تصبح للقراءة فقط
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-06', `
    @Priority=2
    Scenario: Verify that attachments are uploaded within the allowed types and size
    Given the user is creating a correspondence
    When the user uploads PDF, image and Office files under 25 MB
    Then the files are attached successfully
    And they can be downloaded after saving
    #Arabic: التحقق من رفع المرفقات المسموحة بحجم أقل من 25 ميجابايت
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-07', `
    @Priority=3
    Scenario: Verify that attachments larger than 25 MB or of unsupported type are rejected
    Given the user is creating a correspondence
    When the user uploads a file larger than 25 MB or with an unsupported extension
    Then the upload is rejected with a clear validation message
    #Arabic: التحقق من رفض المرفقات الأكبر من 25 ميجابايت أو غير المدعومة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-08', `
    @Priority=1
    Scenario: Verify that a confidential correspondence is visible only to authorized users
    Given a correspondence is marked as 'سرّي'
    When a user without access opens the register
    Then the record has flag confidential
    And the confidential badge appears for authorized users
    #Arabic: التحقق من أن المراسلة السرّية تظهر للمستخدمين المصرّح لهم فقط
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-09', `
    @Priority=2
    Scenario: Verify that the user can reply, reply all and resend a correspondence
    Given a received correspondence exists
    When the user clicks 'رد', 'رد على الجميع' or 'إعادة إرسال'
    Then a new draft is created prefixed with 'رد :' or 'اعادة ارسال :'
    And recipients are pre-filled according to the selected action
    #Arabic: التحقق من الرد والرد على الجميع وإعادة الإرسال وتعبئة المستلمين تلقائياً
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-07-10', `
    @Priority=2
    Scenario: Verify that sending an email correspondence to an entity without an email address is handled
    Given the selected entity has no email address
    When the user sends an outgoing correspondence of type 'بريد الكترونى'
    Then the system shows a clear message that the entity has no email address
    And the external sending is not reported as successful
    #Arabic: التحقق من التعامل مع إرسال بريد إلكتروني لجهة بدون عنوان بريد
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
