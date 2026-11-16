import type { Browser } from '@playwright/test';
import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { asSetup } from '../../../src/utils/core/setup-step';
import { autoEmail, autoName, autoPassword, autoUserName } from '../../../src/domain/acm-names';
import { completeFirstSignIn, type AcmApi } from '../../../src/api/acm-api';
import { LoginPage } from '../../../src/pages/auth/login.page';
import { AppShell } from '../../../src/pages/shell/app-shell.page';
import { userStatus } from '../../../src/pages/admin/users.page';
import { adminScreens, club, messages, operationalLinks, roles, routes, userStatusFilter, type ClubEntity } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-05 - Users and Permissions
// The test cases of "ACM-05 - Users and Permissions.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//========================================================================================

type ClubPerson = { name: string; email: string; userName: string; entityName: string };

/**
 * The sheet's club, made through the API (it is ACM-02's subject, not this story's): 'النادي الأهلي', its 3
 * sub-entities and the 5 persons, all `auto-test-<runId>-`. Removed after the case, persons before their entities.
 */
const createClub = async (adminApi: AcmApi, runId: string, cleanup: (step: () => Promise<unknown>) => void): Promise<ClubPerson[]> => {
  const entityNames: Record<ClubEntity, string> = {
    main: autoName(runId, club.main),
    football: autoName(runId, club.subEntities.football),
    members: autoName(runId, club.subEntities.members),
    finance: autoName(runId, club.subEntities.finance),
  };
  const ids = {} as Record<ClubEntity, number>;
  ids.main = await adminApi.createEntity(entityNames.main, { type: 1 });
  cleanup(() => adminApi.deleteAddressBookEntry(ids.main));
  for (const sub of ['football', 'members', 'finance'] as const) {
    ids[sub] = await adminApi.createEntity(entityNames[sub], { type: 1, parentId: ids.main });
    cleanup(() => adminApi.deleteAddressBookEntry(ids[sub]));
  }
  const persons: ClubPerson[] = [];
  for (const person of club.persons) {
    const name = autoName(runId, person.name);
    const email = autoEmail(runId, person.key);
    const id = await adminApi.createPerson(name, ids[person.entity], email);
    cleanup(() => adminApi.deleteAddressBookEntry(id));
    persons.push({ name, email, userName: autoUserName(runId, person.key), entityName: entityNames[person.entity] });
  }
  return persons;
};

/**
 * Signs in on the sign-in form in a separate browser (the admin's tab stays signed in), as the user would. Returns the
 * server's answer and whether the portal opened; the browser is closed again.
 */
const signInElsewhere = async (browser: Browser, userName: string, password: string): Promise<{ status: number; signedIn: boolean }> => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const page = await context.newPage();
    const loginPage = new LoginPage(page);
    await loginPage.open();
    const status = await loginPage.signIn(userName, password);
    const signedIn = await new AppShell(page)
      .expectSignedIn()
      .then(() => true)
      .catch(() => false);
    if (!signedIn) {
      await loginPage.expectOnLoginPage();
    }
    return { status, signedIn };
  } finally {
    await context.close();
  }
};

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
  `), async ({ signIn, runId, adminApi, cleanup, usersPage }) => {
    const persons = await given(async () => {
      const created = await asSetup('create the club and its 5 persons', () => createClub(adminApi, runId, cleanup));
      await signIn('ADMIN');
      return created;
    });
    await when(async () => {
      for (const person of persons) {
        cleanup(() => adminApi.deleteUserNamed(person.userName));
        await usersPage.open();
        await usersPage.createUser({ person: person.name, userName: person.userName, role: roles.operator.name });
      }
    });
    await then(async () => {
      for (const person of persons) {
        await usersPage.open();
        await usersPage.search(person.userName);
        const row = usersPage.row(person.userName);
        await expect(row, `the user of ${person.name}`).toBeVisible();
        await expect(row.locator('[data-column="fullName"]')).toHaveText(person.name);
        await expect(row.locator('[data-column="email"]')).toHaveText(person.email);
        // The state cell starts with the status ('مُفعّل'), then any flag such as 'يجب تغيير كلمة المرور'
        await expect(row.locator('[data-column="state"]')).toHaveText(/^\s*مُ?فعّل/);
        // Linked to the person: the user's page shows the person's name and e-mail
        await usersPage.openUser(person.userName);
        await usersPage.expectDetail('اسم المستخدم', person.userName);
        await usersPage.expectDetail('الاسم الكامل', person.name);
        await usersPage.expectDetail('البريد الإلكتروني', person.email);
        await usersPage.expectDetail('الحالة', userStatus.active);
      }
      // ...and taken: the picker no longer offers any of the 5 persons for a new user
      await usersPage.open();
      await usersPage.openNewUserDialog();
      expect(await usersPage.personOptions(runId), 'persons that already have a user should not be offered').toEqual([]);
      test.info().annotations.push({
        type: 'note',
        description: 'The entity of a user is not shown on its page or in the list; the link to the entity is that of its person (made under the entity in the Given).',
      });
    });
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
  `), async ({ browser, signIn, runId, adminApi, cleanup, usersPage }) => {
    const persons = await given(async () => {
      const created = await asSetup('create the club and its 5 persons', () => createClub(adminApi, runId, cleanup));
      await signIn('ADMIN');
      return created;
    });
    // createUser checks the OTP switch is off before saving, and that saving shows the temporary password straight away
    // (no one-time code is asked of the admin)
    const temporaryPasswords = await when(async () => {
      const passwords: string[] = [];
      for (const person of persons) {
        cleanup(() => adminApi.deleteUserNamed(person.userName));
        await usersPage.open();
        passwords.push(await usersPage.createUser({ person: person.name, userName: person.userName, role: roles.operator.name }));
      }
      return passwords;
    });
    await then(async () => {
      for (const person of persons) {
        await usersPage.open();
        await usersPage.openUser(person.userName);
        await usersPage.expectDetail('طلب رمز تحقق عبر البريد عند تسجيل الدخول', 'لا');
      }
    });
    const [first] = persons;
    const result = await when(async () => {
      const password = autoPassword(runId);
      await asSetup('replace the temporary password', () => completeFirstSignIn(first.userName, temporaryPasswords[0], password));
      return signInElsewhere(browser, first.userName, password);
    });
    await then(async () => {
      expect(result.status, 'the server should sign the user in').toBe(200);
      expect(result.signedIn, 'the portal should open with no one-time code asked').toBe(true);
    });
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
  `), async ({ signIn, runId, adminApi, cleanup, usersPage }) => {
    const karim = club.persons[1];
    const hesham = club.persons[4];
    const karimName = autoName(runId, karim.name);
    const heshamName = autoName(runId, hesham.name);
    const karimUserName = autoUserName(runId, karim.key);
    await given(async () => {
      await asSetup('create كريم حسن with a user, and هشام رضا without one', async () => {
        const entityId = await adminApi.createEntity(autoName(runId, club.subEntities.football), { type: 1 });
        cleanup(() => adminApi.deleteAddressBookEntry(entityId));
        const karimId = await adminApi.createPerson(karimName, entityId, autoEmail(runId, karim.key));
        cleanup(() => adminApi.deleteAddressBookEntry(karimId));
        const heshamId = await adminApi.createPerson(heshamName, entityId, autoEmail(runId, hesham.key));
        cleanup(() => adminApi.deleteAddressBookEntry(heshamId));
        const user = await adminApi.createUser(karimId, karimUserName, karimName, autoEmail(runId, karim.key));
        cleanup(() => adminApi.deleteUser(user.appUserId));
      });
      await signIn('ADMIN');
      await usersPage.open();
    });

    // 1. The same person again
    const offered = await when(async () => {
      await usersPage.openNewUserDialog();
      return usersPage.personOptions(karimName);
    });
    await then(async () => {
      expect(offered, `'${karim.name}' already has a user and should not be available for selection`).not.toContain(karimName);
    });

    // 2. Another person with the user name of an existing user
    const status = await when(async () => {
      await usersPage.pickPerson(heshamName);
      await usersPage.userName.fill(karimUserName);
      return usersPage.submitNewUser();
    });
    await then(async () => {
      expect(status, 'the server should refuse a user name that is taken').toBeGreaterThanOrEqual(400);
      await expect(usersPage.temporaryPasswordDialog, 'no user should be created').toBeHidden();
      await expect(usersPage.dialog.filter({ hasText: 'مستخدم جديد' }), 'the form should stay open with the message').toBeVisible();
      const message = await usersPage.dialog.locator('[role="alert"], [data-slot="form-message"], .text-destructive').allInnerTexts();
      test.info().annotations.push({ type: 'message', description: message.join(' | ') || '(no message element found)' });
      expect(message.join(' '), 'a duplicate validation message should be displayed').not.toBe('');
      expect(await adminApi.countUsersNamed(karimUserName), 'still exactly one user with the name').toBe(1);
      // هشام رضا got no user: the picker still offers him
      await usersPage.open();
      await usersPage.openNewUserDialog();
      expect(await usersPage.personOptions(heshamName), `'${hesham.name}' should still have no user`).toContain(heshamName);
    });
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
  `), async ({ browser, signIn, newUser, usersPage }) => {
    const user = await given(async () => {
      const created = await asSetup('create an active user', () => newUser());
      await signIn('ADMIN');
      await usersPage.open();
      await usersPage.openUser(created.userName);
      await usersPage.expectDetail('الحالة', userStatus.active);
      return created;
    });
    await when(() => usersPage.deactivate());
    await then(async () => {
      await usersPage.expectDetail('الحالة', userStatus.inactive);
      const attempt = await signInElsewhere(browser, user.userName, user.password);
      expect(attempt.signedIn, 'a deactivated user should not get in').toBe(false);
      expect(attempt.status, 'the server should refuse the sign-in').not.toBe(200);
    });
    await when(() => usersPage.activate());
    await then(async () => {
      await usersPage.expectDetail('الحالة', userStatus.active);
      const attempt = await signInElsewhere(browser, user.userName, user.password);
      expect(attempt.status).toBe(200);
      expect(attempt.signedIn, 'the reactivated user should get in').toBe(true);
    });
  });

  test(...scenario('ACM-05-05', `
    @Priority=4
    Scenario: Verify that users list search and status filter work
    Given users with different statuses exist
    When the admin searches by 'اسم المستخدم', 'الاسم الكامل' or 'البريد الإلكتروني'
    And filters by 'المفعّل وغير المفعّل'
    Then only matching users are shown
    #Arabic: التحقق من البحث والفلترة في قائمة المستخدمين
  `), async ({ signIn, runId, newUser, adminApi, usersPage }) => {
    const { active, inactive } = await given(async () => {
      const users = await asSetup('create an active and a deactivated user', async () => {
        const first = await newUser();
        const second = await newUser();
        await adminApi.setUserActive(second.appUserId, false);
        return { active: first, inactive: second };
      });
      await signIn('ADMIN');
      await usersPage.open();
      return users;
    });
    for (const [by, text] of [
      ['اسم المستخدم', active.userName],
      ['الاسم الكامل', active.fullName],
      ['البريد الإلكتروني', active.email],
    ] as const) {
      await when(() => usersPage.search(text));
      await then(async () => {
        await expect.poll(() => usersPage.listedUserNames(), { message: `search by '${by}'` }).toEqual([active.userName]);
      });
    }

    await when(async () => {
      await usersPage.search(runId);
      await usersPage.filterStatus(userStatusFilter.inactiveOnly);
    });
    await then(async () => {
      await expect.poll(() => usersPage.listedUserNames(), { message: `'${userStatusFilter.inactiveOnly}'` }).toEqual([inactive.userName]);
    });
    await when(() => usersPage.filterStatus(userStatusFilter.activeOnly));
    await then(async () => {
      await expect.poll(() => usersPage.listedUserNames(), { message: `'${userStatusFilter.activeOnly}'` }).toEqual([active.userName]);
    });
    await when(() => usersPage.filterStatus(userStatusFilter.all));
    await then(async () => {
      await expect.poll(async () => (await usersPage.listedUserNames()).sort(), { message: `'${userStatusFilter.all}' should show both users` }).toEqual([active.userName, inactive.userName].sort());
    });
  });

  test(...scenario('ACM-05-06', `
    @Priority=3
    Scenario: Verify that a disabled role cannot be assigned to users
    Given a role template is disabled
    When the admin creates or edits a user
    Then the disabled role is not available for selection
    #Arabic: التحقق من عدم إمكانية إسناد دور معطّل للمستخدمين
  `), async ({ signIn, runId, adminApi, cleanup, roleTemplatesPage, usersPage }) => {
    const template = {
      code: autoName(runId, 'role-off'),
      nameAr: autoName(runId, 'دور معطل'),
      nameEn: autoName(runId, 'disabled role'),
      permissions: ['mailbox:view'],
      disabled: true,
    };
    await given(async () => {
      await signIn('ADMIN');
      await roleTemplatesPage.open();
      cleanup(() => adminApi.deleteRoleTemplate(template.code));
      await roleTemplatesPage.create(template);
      await expect(roleTemplatesPage.row(template.code)).toContainText('معطّل');
    });
    const options = await when(async () => {
      await usersPage.open();
      await usersPage.openNewUserDialog();
      return usersPage.roleOptions();
    });
    await then(async () => {
      expect(options, 'the role list should still offer the enabled roles').toContain(roles.operator.name);
      expect(options, 'the disabled role should not be offered').not.toContain(template.nameAr);
    });
  });

  test(...scenario('ACM-05-07', `
    @Priority=1
    Scenario: Verify that a user's access follows the permissions of the assigned role
    Given a user is assigned the 'مشغل' role
    When the user logs in
    Then operational modules are available
    And 'الإدارة' screens are hidden and blocked by direct URL
    #Arabic: التحقق من تطبيق صلاحيات الدور ومنع المشغّل من الوصول لشاشات الإدارة
  `), async ({ page, newUser, signIn, appShell, usersPage }) => {
    const user = await given(() => asSetup('create a user with the role مشغل', () => newUser({ role: 'operator' })));
    await when(async () => {
      await signIn({ username: user.userName, password: user.password });
      await appShell.open(routes.dashboard);
    });
    await then(async () => {
      const links = await appShell.navigationLabels();
      for (const link of operationalLinks) {
        expect(links, `the operational module '${link}'`).toContain(link);
      }
      for (const screen of adminScreens) {
        expect(links, `the 'الإدارة' screen '${screen.link}' should be hidden`).not.toContain(screen.link);
      }
      for (const screen of adminScreens) {
        await appShell.open(screen.route);
        await expect
          .poll(
            async () => !new URL(page.url()).pathname.startsWith(screen.route) || (await page.getByText(/غير مصرح|لا تملك|ليس لديك|صلاحية|403/).first().isVisible()),
            { message: `'${screen.link}' (${screen.route}) should be blocked by direct URL` },
          )
          .toBe(true);
      }
      await expect(usersPage.newUserButton).toBeHidden();
    });
  });
  test(...scenario('ACM-05-08', `
    @Priority=1
    Scenario: Verify that a system user is created for the external entity person and linked to the external entity
    Given the person 'مسؤول المراسلات' exists under 'الاتحاد المصري لكرة القدم'
    When the admin is on 'الإدارة' > 'المستخدمون' and clicks 'مستخدم جديد'
    And selects 'مسؤول المراسلات' from the persons list
    And fills 'اسم المستخدم' = 'efa.correspondence' and the role and saves
    Then the user appears in 'المستخدمون' as 'مفعّل' with the person's name and email
    And the user is linked to 'الاتحاد المصري لكرة القدم'
    #Arabic: التحقق من إنشاء يوزر لشخص الجهة الخارجية وربطه بالاتحاد المصري لكرة القدم
  `), async ({ signIn, runId, adminApi, cleanup, usersPage }) => {
    const personName = autoName(runId, 'مسؤول المراسلات');
    const email = autoEmail(runId, 'external.entity');
    const userName = autoUserName(runId, 'efa.correspondence');
    await given(async () => {
      await asSetup('create الاتحاد المصري لكرة القدم and مسؤول المراسلات', async () => {
        const efaId = await adminApi.createEntity(autoName(runId, club.externalEntity), { type: 2 });
        cleanup(() => adminApi.deleteAddressBookEntry(efaId));
        const personId = await adminApi.createPerson(personName, efaId, email);
        cleanup(() => adminApi.deleteAddressBookEntry(personId));
      });
      cleanup(() => adminApi.deleteUserNamed(userName));
      await signIn('ADMIN');
      await usersPage.open();
    });
    await when(() => usersPage.createUser({ person: personName, userName, role: roles.operator.name }));
    await then(async () => {
      await usersPage.open();
      await usersPage.search(userName);
      const row = usersPage.row(userName);
      await expect(row.locator('[data-column="fullName"]')).toHaveText(personName);
      await expect(row.locator('[data-column="email"]')).toHaveText(email);
      await expect(row.locator('[data-column="state"]')).toHaveText(/^\s*مُ?فعّل/);
      // Linked to the person (and so to its entity): the picker no longer offers the person
      await usersPage.openNewUserDialog();
      expect(await usersPage.personOptions(personName), 'the person already has a user').not.toContain(personName);
      test.info().annotations.push({ type: 'note', description: "The user's page does not show its entity; the link to 'الاتحاد المصري لكرة القدم' is that of its person." });
    });
  });

  test(...scenario('ACM-05-09', `
    @Priority=1
    Scenario: Verify that the generated one-time password is shown once on user creation and works for the first login
    Given the admin creates the user of 'منى سعيد'
    When the user creation is saved
    Then a random one-time password is displayed once with a copy option
    And the user is listed with 'يجب تغيير كلمة المرور'
    When the admin closes the dialog and reopens the user
    Then the one-time password is no longer displayed
    When 'منى سعيد' logs in with the copied one-time password
    Then the login succeeds and she is asked to set a new password
    #Arabic: التحقق من ظهور كلمة المرور المؤقتة مرة واحدة عند إنشاء اليوزر وصلاحيتها لأول دخول
  `), async ({ page, browser, signIn, runId, adminApi, cleanup, usersPage }) => {
    const mona = autoName(runId, 'منى سعيد');
    const userName = autoUserName(runId, 'mona-saeed');
    await given(async () => {
      await asSetup('create منى سعيد under إدارة العضويات', async () => {
        const entityId = await adminApi.createEntity(autoName(runId, club.subEntities.members), { type: 1 });
        cleanup(() => adminApi.deleteAddressBookEntry(entityId));
        const personId = await adminApi.createPerson(mona, entityId, autoEmail(runId, 'mona-saeed'));
        cleanup(() => adminApi.deleteAddressBookEntry(personId));
      });
      cleanup(() => adminApi.deleteUserNamed(userName));
      await signIn('ADMIN');
      await usersPage.open();
      await usersPage.openNewUserDialog();
      await usersPage.pickPerson(mona);
      await usersPage.userName.fill(userName);
      await usersPage.chooseRole(roles.operator.name);
    });
    const answer = await when(() => usersPage.submitNewUserAnswer());
    const password = answer.temporaryPassword as string;
    await then(async () => {
      expect(password, 'a one-time password is made').toBeTruthy();
      await expect(usersPage.temporaryPasswordDialog, 'shown in the dialog').toContainText(password);
      await expect(usersPage.temporaryPasswordDialog.getByRole('button', { name: /نسخ|Copy/ }).first(), 'with a copy option').toBeVisible();
      await usersPage.takeTemporaryPassword(password);
      await usersPage.open();
      await usersPage.search(userName);
      await expect(usersPage.row(userName), "listed with 'يجب تغيير كلمة المرور'").toContainText('يجب تغيير كلمة المرور');
    });
    await when(() => usersPage.openUser(userName));
    await then(() => expect(page.locator('main'), 'the password is no longer displayed').not.toContainText(password));
    const firstLogin = await when(async () => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const other = await context.newPage();
      const loginPage = new LoginPage(other);
      await loginPage.open();
      const status = await loginPage.signIn(userName, password);
      const asked = await other.getByText(messages.temporaryPasswordAccepted).isVisible({ timeout: 10_000 }).catch(() => false);
      await context.close();
      return { status, asked };
    });
    await then(() => {
      expect(firstLogin.asked, 'the password is accepted and she is asked to set a new one').toBe(true);
      return Promise.resolve();
    });
  });

  test(...scenario('ACM-05-10', `
    @Priority=2
    Scenario: Verify that the one-time password no longer works after the user sets a new password
    Given 'منى سعيد' has logged in with the one-time password and set a new password
    When she logs out and logs in again with the one-time password
    Then the login fails with an invalid credentials message
    When she logs in with the new password
    Then the login succeeds
    #Arabic: التحقق من عدم صلاحية كلمة المرور المؤقتة بعد تغييرها
  `), async ({ browser, runId, newUser }) => {
    const user = await given(() =>
      asSetup('create the user and replace its one-time password', async () => {
        const created = await newUser({ firstSignIn: false });
        const password = autoPassword(runId);
        await completeFirstSignIn(created.userName, created.temporaryPassword, password);
        return { ...created, password };
      }),
    );
    const withTemporary = await when(() => signInElsewhere(browser, user.userName, user.temporaryPassword));
    await then(() => {
      expect(withTemporary.signedIn, 'the one-time password no longer signs in').toBe(false);
      expect(withTemporary.status, 'the server refuses it').toBe(401);
      return Promise.resolve();
    });
    const withNew = await when(() => signInElsewhere(browser, user.userName, user.password));
    await then(() => {
      expect(withNew.status).toBe(200);
      expect(withNew.signedIn, 'the new password signs in').toBe(true);
      return Promise.resolve();
    });
  });

  test(...scenario('ACM-05-11', `
    @Priority=2
    Scenario: Verify that a user cannot be created without the mandatory data or with an invalid username
    Given the admin is on 'المستخدمون' and clicks 'مستخدم جديد'
    When the admin leaves the person, 'اسم المستخدم', 'القسم' or the role empty
    Then 'إنشاء المستخدم' stays disabled or 'حقل مطلوب' is displayed for each empty field
    When the admin enters 'اسم المستخدم' = 'كريم حسن 2' (Arabic letters and a space)
    Then a validation message says only Latin letters, digits, dot and dash are allowed
    And no user is created
    #Arabic: التحقق من إلزامية بيانات اليوزر ورفض اسم مستخدم بحروف أو رموز غير مسموحة
  `), async ({ page, signIn, runId, adminApi, cleanup, usersPage }) => {
    const karim = autoName(runId, 'كريم حسن');
    const invalidName = 'كريم حسن 2';
    await given(async () => {
      await asSetup('create كريم حسن with no user', async () => {
        const entityId = await adminApi.createEntity(autoName(runId, club.subEntities.football), { type: 1 });
        cleanup(() => adminApi.deleteAddressBookEntry(entityId));
        const personId = await adminApi.createPerson(karim, entityId, autoEmail(runId, 'karim-hassan'));
        cleanup(() => adminApi.deleteAddressBookEntry(personId));
      });
      await signIn('ADMIN');
      await usersPage.open();
      await usersPage.openNewUserDialog();
    });
    // 1. Everything empty
    const emptySent = await when(async () => {
      if (await usersPage.createButton.isDisabled()) {
        return 'disabled' as const;
      }
      const status = await usersPage.submitNewUser().catch(() => undefined);
      return status;
    });
    await then(async () => {
      if (emptySent !== 'disabled') {
        expect(emptySent === undefined || emptySent >= 400, 'nothing should be created with the mandatory data empty').toBe(true);
        await expect(usersPage.dialog.getByText(/مطلوب/).first(), "'حقل مطلوب'").toBeVisible();
      }
    });
    // 2. An Arabic user name with a space
    const invalidSent = await when(async () => {
      await usersPage.pickPerson(karim);
      await usersPage.userName.fill(invalidName);
      await usersPage.chooseRole(roles.operator.name);
      if (await usersPage.createButton.isDisabled()) {
        return 'disabled' as const;
      }
      return usersPage.submitNewUserAnswer().then((answer) => answer.status).catch(() => undefined);
    });
    await then(async () => {
      expect(invalidSent === 'disabled' || invalidSent === undefined || invalidSent >= 400, `'${invalidName}' should be refused`).toBe(true);
      await expect(page.getByText(/لاتيني|Latin|غير مسموح|غير صالح/).filter({ hasNotText: 'حروف لاتينية وأرقام ونقطة وشرطة. لا يمكن تغييره لاحقًا' }).first(), 'a message on the allowed characters').toBeVisible();
      await expect(usersPage.temporaryPasswordDialog, 'no user is created').toBeHidden();
      expect(await adminApi.countUsersNamed(invalidName), 'no user with that name').toBe(0);
    });
  });
});
