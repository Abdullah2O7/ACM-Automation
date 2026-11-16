import { test } from '../../../src/fixtures/acm.fixture';
import { scenario } from '../../../src/utils/core/scenario-test';

//========================================================================
// ACM-08 - External Intake and Archiving
// The test cases of "ACM-08 - External Intake and Archiving.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

test.describe('ACM-08 External Intake and Archiving', () => {

  test(...scenario('ACM-08-01', `
    @Priority=1
    Scenario: Verify that an email from the external entity is fetched into the unclassified list with its attachment
    Given the system mailbox is connected with status 'يستقبل'
    When 'الاتحاد المصري لكرة القدم' sends 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' with the attachment 'قائمة_اللاعبين_المقيدين.pdf' to the system mailbox
    And the mailbox sync runs
    Then the email appears in 'غير مصنّف' with the sender, subject and body
    And the attachment 'قائمة_اللاعبين_المقيدين.pdf' opens correctly
    #Arabic: التحقق من وصول بريد الاتحاد المصري لكرة القدم إلى قائمة غير مصنّف بالمرفق سليم
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-02', `
    @Priority=1
    Scenario: Verify that the unclassified email is classified as incoming and directed to the sub-entity
    Given the email 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' exists in 'غير مصنّف'
    When the admin (or a user with admin permissions) sets 'الاتجاه' = 'وارد' and 'النوع' = 'بريد الكترونى'
    And directs it to 'إدارة الكرة' and registers it
    Then it gets a reference number in format YYYY/N/I
    And it moves from 'غير مصنّف' to 'الوارد' and the 'تحتاج تصنيفًا' counter decreases
    And it is visible to 'كريم حسن' and 'عمرو فتحي' (persons of 'إدارة الكرة')
    #Arabic: التحقق من تصنيف بريد الاتحاد كوارد وتوجيهه لإدارة الكرة وظهوره لأشخاصها
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-03', `
    @Priority=2
    Scenario: Verify that classification cannot be completed without direction, type and directed entity
    Given an email exists in the 'غير مصنّف' folder
    When the user tries to register or archive it without 'الاتجاه', 'النوع' or the directed entity
    Then validation messages are displayed for the missing fields
    And the record stays in 'غير مصنّف'
    #Arabic: التحقق من إلزامية الاتجاه والنوع والجهة قبل تصنيف البريد
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-04', `
    @Priority=1
    Scenario: Verify that the classified email is archived into the sub-entity folder with all template fields filled
    Given the registered email 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' is directed to 'إدارة الكرة'
    When the user archives it into 'أرشيف النادي الأهلي 2026' > 'أرشيف إدارة الكرة'
    And selects 'قالب أرشفة مراسلات النادي الأهلي'
    And fills the mandatory fields 'رقم خطاب الجهة' = 'EFA/2026/1184', 'القيمة المالية' = '25000', 'تاريخ الخطاب' = '14/11/2026', 'تصنيف المراسلة' = 'طلب' and 'يتطلب رد' = 'نعم'
    And fills the optional fields 'ملاحظات الأرشفة' = 'قائمة مبدئية بانتظار توقيع المدير الفني', 'عدد الصفحات' = '12', 'تاريخ المتابعة' = '20/11/2026', 'درجة الأهمية' = 'عاجل' and 'تم الرد' = 'لا'
    Then it gets an archive reference in format YYYY/N/A
    And it appears in 'أرشيف إدارة الكرة' with the attachment and all 10 entered index values
    And the 'بانتظار الحفظ' counter decreases
    #Arabic: التحقق من أرشفة بريد الاتحاد الموجّه لإدارة الكرة في مجلدها مع تعبئة كل حقول القالب الإلزامية والاختيارية
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-05', `
    @Priority=1
    Scenario: Verify that a correspondence can be archived with only the mandatory template fields filled
    Given 'هشام رضا' registered the outgoing 'مطالبة بمستحقات حقوق البث – الدور الأول' from 'الإدارة المالية' to 'الاتحاد المصري لكرة القدم'
    When the user archives it into 'أرشيف النادي الأهلي 2026' > 'أرشيف الإدارة المالية'
    And selects 'قالب أرشفة مراسلات النادي الأهلي'
    And fills only the mandatory fields 'رقم خطاب الجهة' = 'AHLY-FIN/2026/0457', 'القيمة المالية' = '1250000', 'تاريخ الخطاب' = '10/11/2026', 'تصنيف المراسلة' = 'مطالبة' and 'يتطلب رد' = 'نعم'
    And leaves all optional fields empty
    Then it is archived with a reference in format YYYY/N/A
    And the optional fields are saved as empty
    And it appears in 'أرشيف الإدارة المالية'
    #Arabic: التحقق من أرشفة مطالبة الإدارة المالية بتعبئة الحقول الإلزامية فقط وترك الاختيارية فارغة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-06', `
    @Priority=2
    Scenario: Verify that only the mandatory template fields are enforced when archiving
    Given a registered correspondence directed to 'إدارة الكرة'
    When the user archives it into 'أرشيف إدارة الكرة' using 'قالب أرشفة مراسلات النادي الأهلي'
    And fills only the optional fields and leaves the mandatory fields empty
    Then 'حقل مطلوب' is shown under 'رقم خطاب الجهة', 'القيمة المالية', 'تاريخ الخطاب', 'تصنيف المراسلة' and 'يتطلب رد'
    And no validation is shown under the optional fields
    And the correspondence is not archived
    #Arabic: التحقق من إلزامية الحقول الإلزامية فقط في القالب وعدم ظهور رسالة للحقول الاختيارية
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-07', `
    @Priority=2
    Scenario: Verify that each index field accepts only values of its data type, mandatory or optional
    Given the user is archiving with 'قالب أرشفة مراسلات النادي الأهلي'
    When the user enters 'خمسة وعشرون ألف' in 'القيمة المالية' (رقم - إلزامي) and 'اثنا عشر' in 'عدد الصفحات' (رقم - اختياري)
    And enters '31/02/2026' in 'تاريخ الخطاب' (تاريخ - إلزامي) and 'تاريخ المتابعة' (تاريخ - اختياري)
    Then a validation message is shown for each invalid value
    And 'تصنيف المراسلة' and 'درجة الأهمية' allow selecting only their listed options
    And 'يتطلب رد' and 'تم الرد' accept only 'نعم' or 'لا'
    #Arabic: التحقق من أن كل حقل فهرسة إلزامي أو اختياري يقبل قيم نوع البيانات الخاص به فقط
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-08', `
    @Priority=2
    Scenario: Verify that advanced search returns archived documents by mandatory and optional index values
    Given 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027' is archived in 'أرشيف إدارة الكرة' with 'رقم خطاب الجهة' = 'EFA/2026/1184' and 'درجة الأهمية' = 'عاجل'
    When the user runs 'بحث متقدم' by 'رقم خطاب الجهة' = 'EFA/2026/1184'
    Or by 'درجة الأهمية' = 'عاجل' within 'أرشيف إدارة الكرة'
    Then the archived email is returned with its index values and attachment
    #Arabic: التحقق من البحث المتقدم في الأرشيف بقيم الحقول الإلزامية والاختيارية
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-09', `
    @Priority=3
    Scenario: Verify that selecting an archive folder shows its documents and the count is correct
    Given 'أرشيف إدارة الكرة' contains the archived 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027'
    When the user selects 'أرشيف إدارة الكرة'
    Then its documents are displayed
    And the count beside the folder matches the number of documents
    #Arabic: التحقق من عرض مستندات أرشيف إدارة الكرة وتطابق العدد
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-10', `
    @Priority=2
    Scenario: Verify that emails from a blocked (spam) address are excluded from intake
    Given a sender address is added to the mailbox 'عناوين السبام' list
    When that sender sends an email to the mailbox
    And the sync runs
    Then the email is not registered
    And it is recorded as excluded in 'سجل الاستلام'
    #Arabic: التحقق من استبعاد الإيميلات الواردة من العناوين المحجوبة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });

  test(...scenario('ACM-08-11', `
    @Priority=3
    Scenario: Verify that the intake log shows fetched messages and links to the created document
    Given emails were fetched from the mailbox
    When the admin opens 'سجل الاستلام' and filters by 'النتيجة' and date
    Then each message shows result, seen time and message id
    And 'فتح الوثيقة' opens the registered correspondence
    #Arabic: التحقق من سجل الاستلام وفلاتره وفتح الوثيقة المرتبطة
  `), async () => {
    test.fixme(true, 'Not automated yet');
  });
});
