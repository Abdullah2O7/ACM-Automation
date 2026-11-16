# ACM Application Knowledge

Key technical and domain knowledge about **ACM — نظام الأرشيف والمراسلات** (`https://test-acm.3segypt.com/`).

---

## 1. Architecture & Frontend
- **SPA Framework:** Modern React/Vite application rendered into `<div id="root"></div>`.
- **Direction & Language:** Default language is Arabic (`ar`) with Right-to-Left (`rtl`) layout.
- **Language Switch:** Controlled via UI; stores `acm.lang` in `localStorage` (`ar` / `en`).
- **Theme:** Supports dark/light mode via `acm.theme` in `localStorage`.

## 2. Authentication & Security
- Standard web session / token-based authentication.
- Newly created users have OTP disabled by default when created by the admin.
- "Must change password" flag triggers forced password reset upon first login.
- Inactive / deactivated users are immediately blocked from logging in.

## 3. Data Entities
- **Hierarchy:** Main Entity (e.g., "النادي الأهلي") -> Sub-entities (e.g., "إدارة الكرة", "إدارة العضويات", "الإدارة المالية") -> Persons with unique emails.
- **External Entities:** Dedicated entity type for external parties (e.g., "الاتحاد المصري لكرة القدم").
- **Auto Reference Number Formats:**
  - Incoming Correspondence: `YYYY/N/I` (e.g. `2026/1/I`)
  - Outgoing Correspondence: `YYYY/N/O` (e.g. `2026/1/O`)
  - Archive References: `YYYY/N/A` (e.g. `2026/1/A`)

## 4. Archive & Indexing Templates
- Archive Folders: Nested hierarchies with live document count badges.
- Indexing Templates: Can be bound to specific archive folders.
- Index Fields: Supports Text, Number, Date, List (dropdown), and Boolean (نعم/لا) with mandatory and optional enforcement.

## 5. Test Data Lifecycle
- All runtime test data should be prefixed with `auto-test-`.
- Clean up test records after test suite completion to maintain pristine system state.

## 6. Learned on the live portal (2026-11-16, ACM-01 / ACM-06)

### Sign-in and session
- API sign-in: `POST /api/acm/auth/login {userName, password}` → `{status:'Ok', value:{token, tokenType:'Bearer', expiresAt (1 h), requiresTwoFactor}}`.
  Every API answer is wrapped `{status:'Ok', value}` or `{status:'<Error>', errorMessage}`.
- The portal keeps the token in **`sessionStorage['acm.accessToken']`** (localStorage only holds `acm.lang`, `acm.theme`), so
  Playwright's storageState does not keep a sign-in. The suite fetches a token and writes it into the tab
  (`src/fixtures/session.ts`), and keeps an `.env` account's token in `runtime/acm-session/` until 10 min before expiry.
- **Sign-ins are rate-limited per account**: too many → `429 "Too many attempts. Wait before trying again."`. Sign in as rarely as
  possible (shared admin account!); the API client waits and retries on 429.
- Wrong password: `401`, alert (role=alert) "اسم المستخدم أو كلمة المرور غير صحيحة." (EN "The username or password is incorrect.").
- With no language chosen, the portal follows the **browser's** language (runs use en-US) - the suite sets `acm.lang=ar` once per tab.
  Language button: aria-label "تغيير اللغة" / "Change language", text "English" / "العربية"; `<html dir lang>` switch rtl/ar ↔ ltr/en.
- Header account button (aria-label "الحساب"): initials, **full name and user name - no role**. Menu: "تغيير كلمة المرور", "تسجيل الخروج".
- Logging out lands on /login; every route then redirects to `/login?returnTo=...`.

### Users (الإدارة > المستخدمون)
- "مستخدم جديد": person picker (#user-person, fills full name and e-mail), #user-name, #user-department, role template
  (#user-template), copy-from, OTP switch, expiry. No password field: on create the portal shows a **temporary password**
  dialog, and the user is flagged **"يجب تغيير كلمة المرور"**.
- API: `POST /api/acm/users {addressBookEntryId, userName, fullName, email, departmentId}` → `{appUserId, temporaryPassword,
  twoFactorEnabled:true}`; the UI then sends `PUT /users/{id}/security {twoFactorEnabled:false}` and
  `POST /users/{id}/access/apply-template {userRoleTemplateId, mode:'Replace'}`. A role is a set of permissions applied to the
  user, not a stored "role" of the user.
- First sign-in with the temporary password: no token (401 `PasswordChangeRequired`); the form shows "كلمة المرور المؤقتة
  صحيحة. اختر كلمة مرور خاصة بك قبل تسجيل الدخول." and a link "اختر كلمة مرور جديدة" → /login/password (#firstUseUserName,
  #firstUseCurrentPassword, #firstUseNewPassword, #firstUseConfirmPassword, "حفظ كلمة المرور وتسجيل الدخول") →
  `POST /api/acm/auth/password/first-use` → dashboard, **no OTP asked**.
- Password policy (`GET /api/acm/auth/password-policy`): 6+ characters, upper and lower case Latin, a digit, a symbol.
- "إيقاف وإزالة من القوائم" = `DELETE /api/acm/users/{id}`: closes the account and hides it; history is kept.
- Role templates: `GET/POST /api/acm/users/role-templates`, `DELETE .../{id}`; list shows code, name, permissions count, مفعّل/معطّل.
- (ACM-05, 2026-11-16) List cells carry `data-column="userName|fullName|email|state"`; status texts are **'مُفعّل' / 'غير مُفعّل'**
  (with a damma). Search box → `GET /users?Keyword=...`. Status filter 'حالة الحساب': المفعّل وغير المفعّل / المفعّل فقط /
  غير المفعّل فقط (`IsActive=false`) / الحسابات المُزالة. **Seen: 'المفعّل وغير المفعّل' (no IsActive sent) did NOT list a
  deactivated user** - suspected bug, checked by ACM-05-05.
- Person picker offers only persons with no user yet; role picker offers only enabled templates (a disabled one is hidden).
  OTP switch `#user-two-factor` is off by default, even when the person has an e-mail.
- Clicking a row opens `?user=<id>`: 'إيقاف' / 'تفعيل' ask to confirm (optional reason) → `PUT /users/{id}/status
  {isActive, reason}`, toast "تم إيقاف الحساب". The user's page does not show the person's entity.

### Address book (الجهات)
- `POST /api/acm/addressbook` entity `{name, addressBookTypeId (1 داخلى, 2 خارجى), parentId?, isPerson:false}` / person
  `{parentId, name, email, isPerson:true}`; `DELETE /api/acm/addressbook/{id}` ("لا يمكن حذف سجل يضم أشخاصًا أو مذكور في مراسلة").

### Lookups (أكواد النظام)
- Tables: الأقسام = `Department`, الأولوية = `TaskPriority`, نوع الجهة = `AddressBookType`, نوع الوثيقة = `DocumentType`.
- "إضافة" opens a dialog (#lookup-add-code/-ar/-en/-fr, switch مُفعّل); nothing is stored until "حفظ الجدول" →
  "تم الحفظ: 1 إضافة و0 تعديل و0 نقل و0 حذف". Duplicate code: "هذا الرمز مستخدم بالفعل في الجدول." (in the dialog).
- `GET /config/{table}` gives ACTIVE values only; `GET /config/{table}/translations` gives all with ids.
- **A value a record has used can never be deleted** (409 "القيمة مستخدمة فى بيانات قائمة ولا يمكن حذفها" - even after the
  record is purged). Cases that need a used value keep one value of their own (test-data/acm/acm.data.ts `keptLookupValues`).

### Settings (الإعدادات)
- A new receiving mailbox is saved as **"متوقف"** (receiving off); "يستقبل" needs the card's switch "الاستقبال من هذا الصندوق".
  The app password is never shown again: the card says "تم حفظ كلمة مرور التطبيق" and the edit form's field is empty.
  `POST/DELETE /api/acm/settings/mail-ingestion[/{id}]`.
- Logo: wrong type → server 400 "يجب أن يكون الشعار صورة بصيغة PNG أو JPEG أو GIF أو BMP."; over 1 MB → refused in the browser
  "حجم الشعار يتجاوز ١ ميجابايت." (nothing is sent).
- SMTP password: "كلمة المرور محفوظة. اترك الحقل فارغًا للاحتفاظ بها." (saving with it empty keeps it).

### Correspondence
- Draft: `POST /api/acm/correspondence {..., saveAsDraft:true, draftModule:2}` → id; "حذف" is a soft delete (to المحذوفة);
  `DELETE /api/acm/correspondence/{id}/purge` removes it for good.

### Correspondence, tasks, archive, reports (explored 2026-11-16 for ACM-07..15)
- Register form `/secretary/register/new`: #directionId (وارد/صادر/تعميمات), #typeId (بريد الكترونى=1, فاكس=2, خطاب=3), #date,
  #correspondent (label 'الجهة المستقبِلة', becomes **'الجهة المرسِلة'** with 'وارد'), #subject, #body (rich editor), #notes,
  'وضع علامة سرّي', file input. 'إرسال' → `POST /correspondence {documentDirectionId, documentTypeId, documentDate, subject, body,
  bodyText, isSecure, inboxMode:true, saveAsDraft:false, draftModule:2, recipients:[{name, addressBookEntryId}]}` → id; toast
  "تم تسجيل المراسلة #id"; the record opens at `?focus=id` and shows the reference (e.g. 2026/79/I) instead of #id.
- Internal mail: `/correspondence/mailbox` (search, 'غير المقروءة فقط', #mailbox-date-from/-to), compose `/correspondence/compose`
  (recipients #to). Folders are reached through the 'البحث في كل السجلات' palette ('البريد الداخلي · المسودات', ...).
- Opened record: 'رد', 'رد على الجميع', 'إعادة إرسال', 'طباعة الملصق', 'حذف', 'مهمة جديدة'. Unclassified (Triage) record:
  #classify-type-<id>, 'قبول في الوارد', 'توجيه داخلي'. 'تصفية' is a dialog of radio buttons + #filter-date-from/-to.
- Tasks dialog: #task-form-name/-description/-priority/-percent/-executer/-start/-due/-reminder, 'إنشاء'. Out of office:
  'النائب', #out-of-office-start/-end. Priorities: قليل الاهمية, متوسط الاهمية, ...
- Archive: tabs المستندات / بحث متقدم (#archive-advanced-text, #archive-advanced-cabinet, -from/-to) / إدارة المجلد. Template
  field data types are only **نص(1), كود(2), تاريخ(3), رقم صحيح(4), رقم عشري(5)** with an `options` list - no list or yes/no
  type of their own. A folder (cabinet) carries its template. **No archive action was found on a record's page.**
- Reports: #report-picker, #format-picker, #report-from/-to, 'معاينة', 'تنزيل'. Audit: #audit-from/-to, #audit-user, #audit-event.
- Settings: intake log #ledger-outcome/-from/-to/-search + 'فتح الوثيقة'; daily summary #daily-summary-address, 'حفظ العناوين',
  'إرسال الآن'.
- **No 'اللوحة الرئيسية' found**: the admin's '/' lands on 'البريد الداخلي', and neither the menu nor the palette lists a dashboard.

### Learned in the smoke runs (2026-11-16)
- Correspondence list search parameter is **`SearchTerm`** (not Keyword); tasks list uses `Keyword`. Folders accepted by
  `GET /correspondence?Folder=`: Triage, Register, Inbox, Outbox, Draft, Spam, Deleted, **All**, MailboxInbox,
  **MailboxOutbox**, MailboxDeleted (MailboxSent / MailboxDraft are refused).
- **Internal mail is sent in two calls**: `POST /correspondence {inboxMode:false, saveAsDraft:true, draftModule:1,
  recipients:[{..., mailAddressTypeId:1}]}` then `POST /correspondence/{id}/send`. Opening a message marks it read with
  `POST /correspondence/{id}/read`. A received message offers only 'رد', 'رد على الجميع', 'إعادة إرسال' (no delete);
  an opened draft shows 'رجوع' and 'تعديل'.
- Tasks: every field of 'مهمة جديدة' is required except 'الوصف', **'التذكير' included, and it may not be before today**
  ("لا يصحّ أن يسبق تاريخ التذكير يوم اليوم."). Board columns are `<section aria-label="جديدة|قيد التنفيذ|مرفوضة|منتهية">`.
  An opened task is a page (/tasks?focus=<id>): 'قبول', 'رفض', 'إحالة', 'تعليق' (رفض/إحالة/تعليق stay disabled until
  'السبب أو التعليق' is filled), 'نسبة الإنجاز' + 'حفظ الإنجاز'.
- Address book entries named in any correspondence cannot be deleted ("السجل مستخدم فى مستندات قائمة"), so a case purges
  its correspondence before its users/persons/entities (the `cleanup` fixture is torn down before `newUser`).

### Archive folders and templates (confirmed 2026-11-16, ACM-03 / ACM-04)
- Folders: 'مجلد رئيسي جديد' / a folder's 'إضافة مجلد فرعي' open an inline form (#cabinet-create-name, 'إضافة') ->
  `POST /cabinets {name:{ar,en}, parentCabinetId?, isPublicArchive:false}`. 'إعادة تسمية' is an inline box saved with Enter
  (`PUT /cabinets/{id}`); 'حذف المجلد' asks "حذف المجلد «name»؟". The tree shows name + count, and 'بدون نموذج فهرسة' only for
  a folder without a template.
- A folder's template: 'إدارة المجلد' > 'نموذج الفهرسة' (#cabinet-template) saves **as soon as it is picked**
  (`PUT /cabinets/{id} {name, archiveTemplateId, isPublicArchive}`); the tab's 'حفظ' is for the access rights.
- Templates: 'قالب جديد' dialog (#new-template-name, #new-template-description) -> `POST /templates {name:{ar,en}, fields:[]}`
  -> /secretary/templates/<id>. 'إضافة حقل' adds a field (#<p>-label, #<p>-type, #<p>-maxlen, a list's 'إضافة خيار' with
  #<p>-optK-value/-ar/-en, an 'إلزامي' checkbox); 'حفظ القالب' -> `PUT /templates/{id}/fields {fields:[{archiveTemplateFieldId:0,
  fieldName, fieldLabel:{ar,en}, templateFieldDataTypeId, isRequired, orderLevel, options:[{value, translations:{ar,en},
  sortOrder}]}]}`. Types: نص(1), **كود (قائمة)(2)**, تاريخ(3), رقم صحيح(4), رقم عشري(5) - no yes/no type.
- Users: the temporary password is in the answer of `POST /users` (value.temporaryPassword); the dialog shows the same.
