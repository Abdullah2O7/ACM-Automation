/**
 * What the ACM portal really shows, read on the live portal (https://test-acm.3segypt.com, 2026-11-16), and the names the
 * sheet uses. A message is matched leniently (a regular expression of its key words), so a changed full stop or a
 * reworded tail does not fail a case - a different meaning does.
 */

export const messages = {
  /** Sign-in with a wrong user name or password ("Invalid user name or password." from the API). */
  invalidCredentials: /اسم المستخدم أو كلمة المرور غير صحيحة/,
  /** Sign-in with a temporary password: the form asks for a new one instead of signing in. */
  temporaryPasswordAccepted: /كلمة المرور المؤقتة صحيحة.*اختر كلمة مرور خاصة بك/,
  /** Under every empty mandatory field. */
  requiredField: /^حقل مطلوب$/,
  /** Shown after a new user is created. */
  temporaryPasswordDialog: /كلمة المرور المؤقتة/,
  /** 'حفظ الجدول' of 'أكواد النظام': "تم الحفظ: 1 إضافة و0 تعديل و0 نقل و0 حذف". */
  lookupSaved: /تم الحفظ:/,
  /** The 'إضافة' dialog of 'أكواد النظام' with a code the table already has. */
  duplicateLookupCode: /هذا الرمز مستخدم بالفعل/,
  /** 'الشعار' with a file that is not PNG, JPEG, GIF or BMP (answered by the server). */
  logoWrongType: /يجب أن يكون الشعار صورة بصيغة PNG أو JPEG أو GIF أو BMP/,
  /** 'الشعار' with a file over 1 MB (refused before it is sent). */
  logoTooLarge: /حجم الشعار يتجاوز ١ ميجابايت/,
  mailboxSaved: /تم حفظ صندوق البريد/,
  /** A mailbox card's password line: the password is never shown, only that one is saved. */
  appPasswordSaved: /تم حفظ كلمة مرور التطبيق/,
} as const;

/** Lookup tables of 'أكواد النظام': the label of 'نوع الكود' and the API name. */
export const lookupTables = {
  departments: { label: 'الأقسام', api: 'Department' },
  priority: { label: 'الأولوية', api: 'TaskPriority' },
  entityType: { label: 'نوع الجهة', api: 'AddressBookType' },
  documentType: { label: 'نوع الوثيقة', api: 'DocumentType' },
} as const;

/**
 * Lookup values that stay on the portal between runs. The server never deletes a value a record has used (409
 * "القيمة مستخدمة فى بيانات قائمة ولا يمكن حذفها", even after the record is purged), so a case that needs a used value
 * reactivates its own value each run instead of adding a new one. Between runs it is deactivated, so no dropdown shows it.
 */
export const keptLookupValues = {
  /** TC004 (ACM-01-04): a 'نوع الوثيقة' value that a draft uses, then is deactivated. */
  deactivationCase: { code: 'ATTC004', ar: 'auto-test-نوع وثيقة للتعطيل', en: 'auto-test-type-to-deactivate', fr: 'auto-test-type-a-desactiver' },
} as const;

/** Mailbox status on its card in 'استقبال البريد'. */
export const mailboxStatus = { receiving: 'يستقبل', stopped: 'متوقف' } as const;

/** Labels of the portal in both languages (TC002). */
export const languages = {
  ar: { dir: 'rtl', lang: 'ar', loginTitle: 'تسجيل الدخول إلى بوابة الأرشيف', firstNavigationLink: 'البريد الداخلي', languageButton: 'English' },
  en: { dir: 'ltr', lang: 'en', loginTitle: 'Sign in to the archive portal', firstNavigationLink: 'Internal mail', languageButton: 'العربية' },
} as const;

/** Role templates that ship with the portal (Admin > المستخدمون > قوالب الأدوار): code and Arabic name. */
export const roles = {
  operator: { code: 'operator', name: 'مشغل' },
  admin: { code: 'admin', name: 'مدير التطبيق' },
} as const;

/**
 * The sheet's club (ACM-02 / ACM-05): 'النادي الأهلي', its 3 sub-entities and the 5 persons with the entity each one is
 * under. `key` is the Latin label of the person's user name and e-mail (auto-test-<runId>-<key>).
 */
export const club = {
  main: 'النادي الأهلي',
  subEntities: { football: 'إدارة الكرة', members: 'إدارة العضويات', finance: 'الإدارة المالية' },
  persons: [
    { name: 'محمد عادل', key: 'mohamed-adel', entity: 'main' },
    { name: 'كريم حسن', key: 'karim-hassan', entity: 'football' },
    { name: 'عمرو فتحي', key: 'amr-fathy', entity: 'football' },
    { name: 'منى سعيد', key: 'mona-saeed', entity: 'members' },
    { name: 'هشام رضا', key: 'hesham-reda', entity: 'finance' },
  ],
  /** The external entity the club corresponds with. */
  externalEntity: 'الاتحاد المصري لكرة القدم',
} as const;

/** The Registry entity that ships with the portal: internal requests for external mail are sent to it (ACM-11). */
export const registryName = 'السجل / Registry';

/** Subjects of the sheet's correspondence (each case prefixes them with auto-test-<runId>-). */
export const subjects = {
  incomingLetter: 'إخطار بمواعيد مباريات الدور الأول',
  outgoingFax: 'تأكيد حضور اجتماع لجنة المسابقات',
  playersList: 'طلب اعتماد قائمة اللاعبين المقيدين – الموسم 2026/2027',
  broadcastClaim: 'مطالبة بمستحقات حقوق البث – الدور الأول',
  coachReport: 'تقرير تقييم أداء الجهاز الفني',
  membershipFees: 'تحديث قيمة اشتراكات الأعضاء لعام 2027',
  generalAssembly: 'دعوة لحضور اجتماع الجمعية العمومية العادية',
  bonuses: 'طلب صرف مكافآت الفوز بالدوري',
  registryReply: 'رد النادي الأهلي بشأن اعتماد قائمة اللاعبين المقيدين',
  contractsTask: 'مراجعة عقود اللاعبين الجدد',
  playersTask: 'متابعة اعتماد قائمة اللاعبين',
} as const;

/** 'الاتجاه' and 'النوع' of the register: label, and API id (GET /config/DocumentDirection, /config/DocumentType). */
export const directions = { incoming: { label: 'وارد', id: 1 }, outgoing: { label: 'صادر', id: 2 } } as const;
export const documentTypes = { email: { label: 'بريد الكترونى', id: 1 }, fax: { label: 'فاكس', id: 2 }, letter: { label: 'خطاب', id: 3 } } as const;

/** Reference numbers: YYYY/N/I (incoming), YYYY/N/O (outgoing), YYYY/N/A (archive). */
export const referencePattern = {
  incoming: /^\d{4}\/\d+\/I$/,
  outgoing: /^\d{4}\/\d+\/O$/,
  archive: /^\d{4}\/\d+\/A$/,
} as const;

/** Folders of 'الصادر و الوارد' (?folder=) with their names, and of 'البريد الداخلي' (opened from the search palette). */
export const registerFolders = {
  Triage: 'غير مصنّف',
  Register: 'بانتظار التسجيل',
  Inbox: 'الوارد',
  Outbox: 'الصادر',
  Draft: 'المسودات',
  Spam: 'المزعجة',
  Deleted: 'المحذوفة',
} as const;
export const mailboxFolders = { inbox: 'الرسائل الواردة', sent: 'الرسائل الصادرة', drafts: 'المسودات', deleted: 'المحذوفات' } as const;

/** Columns of 'المهام' (board). */
export const taskColumns = { new: 'جديدة', inProgress: 'قيد التنفيذ', rejected: 'مرفوضة', done: 'منتهية' } as const;

/** Reports of 'التقارير' (#report-picker). */
export const reports = {
  incomingRegister: 'سجل الوارد',
  outgoingRegister: 'سجل الصادر',
  throughput: 'معدل التشغيل',
  documentTrail: 'تتبّع مسار المستند',
  userActivity: 'نشاط المستخدم',
  managerKpis: 'مؤشرات أداء المديرين',
} as const;

export type ClubEntity = 'main' | keyof typeof club.subEntities;

/**
 * The sheet's archive set-up (ACM-03 / ACM-04 / ACM-08): the folders and 'قالب أرشفة مراسلات النادي الأهلي' with its
 * 10 index fields. On the portal a field is one of 5 data types (GET /config/TemplateFieldDataType: 1 نص, 2 كود,
 * 3 تاريخ, 4 رقم صحيح, 5 رقم عشري) with an optional list of options - a 'قائمة' or 'نعم/لا' field is a text field
 * with options.
 */
export const archive = {
  mainFolder: 'أرشيف النادي الأهلي 2026',
  subFolders: { football: 'أرشيف إدارة الكرة', members: 'أرشيف إدارة العضويات', finance: 'أرشيف الإدارة المالية' },
  template: 'قالب أرشفة مراسلات النادي الأهلي',
  fields: [
    { name: 'رقم خطاب الجهة', type: 'نص', mandatory: true },
    { name: 'القيمة المالية', type: 'رقم', mandatory: true },
    { name: 'تاريخ الخطاب', type: 'تاريخ', mandatory: true },
    { name: 'تصنيف المراسلة', type: 'قائمة', mandatory: true, options: ['طلب', 'إخطار', 'مطالبة'] },
    { name: 'يتطلب رد', type: 'نعم/لا', mandatory: true },
    { name: 'ملاحظات الأرشفة', type: 'نص', mandatory: false },
    { name: 'عدد الصفحات', type: 'رقم', mandatory: false },
    { name: 'تاريخ المتابعة', type: 'تاريخ', mandatory: false },
    { name: 'درجة الأهمية', type: 'قائمة', mandatory: false, options: ['عادي', 'مهم', 'عاجل'] },
    { name: 'تم الرد', type: 'نعم/لا', mandatory: false },
  ],
} as const;

export type ArchiveFieldName = (typeof archive.fields)[number]['name'];

/**
 * The archive ACM-08 archives into, kept on the portal between runs (team decision, 2026-11-16). The server never
 * deletes a folder that has held an archived document - not even after the document is purged - nor a template linked to
 * one, so a folder set made per run would stay behind every time. ACM-08 reuses this set instead: made on first use,
 * never removed. Its names carry no run id, so a sweep of a run's leftovers (auto-test-<runId>-...) leaves it alone.
 */
export const keptArchive = {
  mainFolder: `auto-test-kept-${archive.mainFolder}`,
  subFolders: {
    football: `auto-test-kept-${archive.subFolders.football}`,
    members: `auto-test-kept-${archive.subFolders.members}`,
    finance: `auto-test-kept-${archive.subFolders.finance}`,
  },
  template: `auto-test-kept-${archive.template}`,
} as const;

/** Status filter of 'المستخدمون' ('حالة الحساب'). */
export const userStatusFilter = { all: 'المفعّل وغير المفعّل', activeOnly: 'المفعّل فقط', inactiveOnly: 'غير المفعّل فقط' } as const;

/** Navigation links of the operational modules, which the operator ('مشغل') works in. */
export const operationalLinks = ['البريد الداخلي', 'الصادر و الوارد', 'الأرشيف', 'المهام'] as const;

/** The 'الإدارة' screens: navigation link and route. An operator must neither see nor open them. */
export const adminScreens = [
  { link: 'أكواد النظام', route: '/secretary/admin/lookups' },
  { link: 'المستخدمون', route: '/secretary/admin/users' },
  { link: 'سجل التدقيق', route: '/secretary/admin/audit' },
  { link: 'الإعدادات', route: '/secretary/settings' },
] as const;

/** Routes of the portal. */
export const routes = {
  dashboard: '/',
  login: '/login',
  register: '/secretary/register',
  archive: '/secretary/archive',
  addressBook: '/secretary/addressbook',
  templates: '/secretary/templates',
  lookups: '/secretary/admin/lookups',
  users: '/secretary/admin/users',
  roleTemplates: '/secretary/admin/users/role-templates',
  audit: '/secretary/admin/audit',
  settings: '/secretary/settings',
  tasks: '/tasks',
  reports: '/secretary/reports',
  mailbox: '/correspondence/mailbox',
} as const;
