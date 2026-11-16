import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { asSetup } from '../../../src/utils/core/setup-step';
import { autoEmail, autoName } from '../../../src/domain/acm-names';
import { club, directions } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-02 - Entities and Persons
// The test cases of "ACM-02 - Entities and Persons.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// What a case creates through the screen is removed after it by its run id (persons first, then entities).
//========================================================================================

/** 'نوع الجهة' as the details of a selected entity show it. */
const entityType = { internal: 'داخلى', external: 'خارجى' } as const;

test.describe('ACM-02 Entities and Persons', () => {

  test(...scenario('ACM-02-01', `
    @Priority=1
    Scenario: Verify that the admin can create an internal main entity with three sub-entities
    Given the admin is on 'الجهات'
    When the admin creates the internal main entity 'النادي الأهلي'
    And creates the sub-entities 'إدارة الكرة', 'إدارة العضويات' and 'الإدارة المالية' under it
    Then the tree shows 'النادي الأهلي' with the 3 sub-entities nested under it
    And 'نوع الجهة' is internal
    #Arabic: التحقق من إنشاء جهة رئيسية داخلية (النادي الأهلي) وتحتها 3 جهات فرعية
  `), async ({ signIn, runId, adminApi, cleanup, entitiesPage }) => {
    const mainEntity = autoName(runId, club.main);
    const subEntities = Object.values(club.subEntities).map((name) => autoName(runId, name));

    await given(async () => {
      cleanup(() => adminApi.deleteAddressBookMatching(runId));
      await signIn('ADMIN');
      await entitiesPage.open();
    });

    await when(async () => {
      await entitiesPage.createEntity({ name: mainEntity, type: 'internal' });
      for (const sub of subEntities) {
        await entitiesPage.createEntity({ name: sub, type: 'internal', parentName: mainEntity });
      }
    });

    await then(async () => {
      await entitiesPage.search(runId);
      const mainNode = entitiesPage.node(mainEntity);
      await expect(mainNode).toBeVisible();
      for (const sub of subEntities) {
        // Nested: the sub-entity's node is inside the main entity's node
        await expect(mainNode.getByRole('treeitem').filter({ has: entitiesPage.nameButton(sub) }), `'${sub}' under '${mainEntity}'`).toHaveCount(1);
      }
      for (const name of [mainEntity, ...subEntities]) {
        await entitiesPage.select(name);
        await expect(entitiesPage.details(), `'نوع الجهة' of '${name}'`).toContainText(entityType.internal);
      }
    });
  });

  test(...scenario('ACM-02-02', `
    @Priority=1
    Scenario: Verify that persons can be registered under the main entity and each sub-entity with a unique email
    Given 'النادي الأهلي' and its 3 sub-entities exist
    When the admin clicks 'شخص جديد' and adds 'محمد عادل' under 'النادي الأهلي'
    And adds 'كريم حسن' and 'عمرو فتحي' under 'إدارة الكرة'
    And adds 'منى سعيد' under 'إدارة العضويات' and 'هشام رضا' under 'الإدارة المالية'
    And each person has a unique email
    Then each person appears under the correct entity in the tree
    #Arabic: التحقق من تسجيل أشخاص تحت النادي الأهلي وكل إدارة فرعية ببريد مختلف لكل شخص
  `), async ({ signIn, runId, entitiesPage, adminApi, cleanup }) => {
    const entityNames = {
      main: autoName(runId, club.main),
      football: autoName(runId, club.subEntities.football),
      members: autoName(runId, club.subEntities.members),
      finance: autoName(runId, club.subEntities.finance),
    };

    await given(async () => {
      await asSetup('create النادي الأهلي and its 3 sub-entities', async () => {
        // Removed after the case: the persons made through the screen first, then the entities
        cleanup(() => adminApi.deleteAddressBookMatching(runId));
        const mainId = await adminApi.createEntity(entityNames.main, { type: 1 });
        for (const sub of ['football', 'members', 'finance'] as const) {
          await adminApi.createEntity(entityNames[sub], { type: 1, parentId: mainId });
        }
      });
      await signIn('ADMIN');
      await entitiesPage.open();
    });

    const persons = club.persons.map((person) => ({ name: autoName(runId, person.name), entity: entityNames[person.entity], email: autoEmail(runId, person.key) }));

    await when(async () => {
      for (const person of persons) {
        await entitiesPage.createPerson({ name: person.name, entityName: person.entity, email: person.email });
      }
    });

    await then(async () => {
      await entitiesPage.search(runId);
      for (const person of persons) {
        await expect(entitiesPage.node(person.entity).getByRole('treeitem').filter({ has: entitiesPage.nameButton(person.name) }), `'${person.name}' under '${person.entity}'`).not.toHaveCount(0);
      }
      expect(new Set(persons.map((person) => person.email)).size, 'each person has a unique e-mail').toBe(persons.length);
    });
  });

  test(...scenario('ACM-02-03', `
    @Priority=1
    Scenario: Verify that an external entity can be created with a person
    Given the admin is on 'الجهات'
    When the admin creates the external entity 'الاتحاد المصري لكرة القدم'
    And adds the person 'مسؤول المراسلات' with email 'external.entity@example.com'
    Then the entity appears with 'نوع الجهة' external
    And it can be selected as 'الجهة المستقبِلة' for outgoing correspondence
    #Arabic: التحقق من إنشاء الجهة الخارجية الاتحاد المصري لكرة القدم وإضافة شخص ببريد إلكتروني عليها
  `), async ({ signIn, runId, adminApi, cleanup, entitiesPage, correspondenceForm }) => {
    const externalEntity = autoName(runId, club.externalEntity);
    const personName = autoName(runId, 'مسؤول المراسلات');
    // The sheet's address, made unique per run so runs do not collide
    const email = autoEmail(runId, 'external.entity');

    await given(async () => {
      cleanup(() => adminApi.deleteAddressBookMatching(runId));
      await signIn('ADMIN');
      await entitiesPage.open();
    });

    await when(async () => {
      await entitiesPage.createEntity({ name: externalEntity, type: 'external' });
      await entitiesPage.createPerson({ name: personName, entityName: externalEntity, email });
    });

    await then(async () => {
      await entitiesPage.select(externalEntity);
      await expect(entitiesPage.details(), "'نوع الجهة' external").toContainText(entityType.external);
      // The search by the run id shows the entity with the person under it
      await entitiesPage.search(runId);
      await expect(entitiesPage.node(externalEntity).getByRole('treeitem').filter({ has: entitiesPage.nameButton(personName) })).toHaveCount(1);
      // Selectable as 'الجهة المستقبِلة' of an outgoing correspondence
      await correspondenceForm.open();
      await correspondenceForm.chooseDirection(directions.outgoing.label);
      await correspondenceForm.pickRecipient(externalEntity);
    });
  });

  test(...scenario('ACM-02-04', `
    @Priority=3
    Scenario: Verify that an entity or person can be edited and deleted
    Given an entity or person is selected
    When the user edits its data and saves
    Then the changes are displayed
    When the user deletes a record not used in correspondence
    Then it is removed from the tree
    #Arabic: التحقق من تعديل وحذف جهة أو شخص
  `), async ({ signIn, runId, entitiesPage, adminApi, cleanup }) => {
    const initialName = autoName(runId, 'جهة للتعديل');
    const updatedName = autoName(runId, 'جهة معدلة');

    await given(async () => {
      await asSetup('create an entity', async () => {
        cleanup(() => adminApi.deleteAddressBookMatching(runId));
        await adminApi.createEntity(initialName, { type: 1 });
      });
      await signIn('ADMIN');
      await entitiesPage.open();
    });

    await when(() => entitiesPage.editNode(initialName, updatedName));
    await then(async () => {
      await entitiesPage.search(runId);
      await expect(entitiesPage.node(updatedName), 'the new name').toBeVisible();
      await expect(entitiesPage.node(initialName), 'the old name is gone').toHaveCount(0);
    });

    await when(() => entitiesPage.deleteNode(updatedName));
    await then(async () => {
      await entitiesPage.searchInput.fill(runId);
      await expect(entitiesPage.node(updatedName), 'removed from the tree').toHaveCount(0);
    });
  });

  test(...scenario('ACM-02-05', `
    @Priority=4
    Scenario: Verify that searching entities and persons filters the tree
    Given the entities tree contains many records
    When the user searches by name
    Then only matching entities and persons are displayed
    #Arabic: التحقق من البحث في الجهات والأشخاص
  `), async ({ signIn, runId, entitiesPage, adminApi, cleanup }) => {
    const targetEntity = autoName(runId, 'جهة للبحث فريدة');
    const targetPerson = autoName(runId, 'شخص للبحث فريد');
    const otherEntity = autoName(runId, 'جهة أخرى مختلفة تماما');

    await given(async () => {
      await asSetup('create the records to search', async () => {
        cleanup(() => adminApi.deleteAddressBookMatching(runId));
        const id = await adminApi.createEntity(targetEntity, { type: 1 });
        await adminApi.createPerson(targetPerson, id, autoEmail(runId, 'search'));
        await adminApi.createEntity(otherEntity, { type: 1 });
      });
      await signIn('ADMIN');
      await entitiesPage.open();
    });

    await when(() => entitiesPage.search(`${runId}-جهة للبحث`));
    await then(async () => {
      await expect(entitiesPage.node(targetEntity), 'the matching entity').toBeVisible();
      await expect(entitiesPage.node(otherEntity), 'a record that does not match').toHaveCount(0);
    });
    await when(() => entitiesPage.search(targetPerson));
    await then(async () => {
      await expect(entitiesPage.node(targetPerson), 'the matching person').toBeVisible();
      await expect(entitiesPage.node(otherEntity)).toHaveCount(0);
    });
  });
  test(...scenario('ACM-02-06', `
    @Priority=2
    Scenario: Verify that the admin can create a sub-entity under the external entity with its own person
    Given the external entity 'الاتحاد المصري لكرة القدم' exists
    When the admin is on 'الجهات' and creates the sub-entity 'لجنة المسابقات' under 'الاتحاد المصري لكرة القدم'
    And adds the person 'منسق لجنة المسابقات' with email 'competitions.committee@example.com' under it
    Then the tree shows 'لجنة المسابقات' nested under 'الاتحاد المصري لكرة القدم' with 'نوع الجهة' external
    And 'لجنة المسابقات' can be selected as 'الجهة المستقبِلة' for outgoing correspondence
    #Arabic: التحقق من إنشاء جهة فرعية (لجنة المسابقات) تحت الجهة الخارجية الاتحاد المصري لكرة القدم بشخص وبريد خاص بها
  `), async ({ signIn, runId, adminApi, cleanup, entitiesPage, correspondenceForm }) => {
    const efa = autoName(runId, club.externalEntity);
    const committee = autoName(runId, 'لجنة المسابقات');
    const coordinator = autoName(runId, 'منسق لجنة المسابقات');
    await given(async () => {
      await asSetup('create the football association', async () => {
        cleanup(() => adminApi.deleteAddressBookMatching(runId));
        await adminApi.createEntity(efa, { type: 2 });
      });
      await signIn('ADMIN');
      await entitiesPage.open();
    });
    await when(async () => {
      await entitiesPage.createEntity({ name: committee, type: 'external', parentName: efa });
      // The sheet's address, made unique per run
      await entitiesPage.createPerson({ name: coordinator, entityName: committee, email: autoEmail(runId, 'competitions.committee') });
    });
    await then(async () => {
      await entitiesPage.search(runId);
      await expect(entitiesPage.node(efa).getByRole('treeitem').filter({ has: entitiesPage.nameButton(committee) }), `'${committee}' under '${efa}'`).not.toHaveCount(0);
      await entitiesPage.select(committee);
      await expect(entitiesPage.details(), "'نوع الجهة' external").toContainText(entityType.external);
      await correspondenceForm.open();
      await correspondenceForm.chooseDirection(directions.outgoing.label);
      await correspondenceForm.pickRecipient(committee);
    });
  });

  test(...scenario('ACM-02-07', `
    @Priority=2
    Scenario: Verify that a person cannot be saved with an invalid email or an email already used by another person
    Given 'كريم حسن' exists under 'إدارة الكرة' with his email
    When the admin clicks 'شخص جديد' under 'إدارة العضويات' and enters 'مروة علي' with the email 'marwa.ali@'
    Then a validation message for the email format is displayed and the person is not saved
    When the admin enters the same email used by 'كريم حسن'
    Then a duplicate email validation message is displayed
    And no second person is created with that email
    #Arabic: التحقق من رفض حفظ شخص ببريد غير صحيح أو ببريد مستخدم لشخص آخر
  `), async ({ page, signIn, runId, adminApi, cleanup, entitiesPage }) => {
    const members = autoName(runId, club.subEntities.members);
    const marwa = autoName(runId, 'مروة علي');
    const karimEmail = autoEmail(runId, 'karim-hassan');
    await given(async () => {
      await asSetup('create كريم حسن under إدارة الكرة, and إدارة العضويات', async () => {
        cleanup(() => adminApi.deleteAddressBookMatching(runId));
        const mainId = await adminApi.createEntity(autoName(runId, club.main), { type: 1 });
        const footballId = await adminApi.createEntity(autoName(runId, club.subEntities.football), { type: 1, parentId: mainId });
        await adminApi.createEntity(members, { type: 1, parentId: mainId });
        await adminApi.createPerson(autoName(runId, 'كريم حسن'), footballId, karimEmail);
      });
      await signIn('ADMIN');
      await entitiesPage.open();
    });
    const invalid = await when(async () => {
      await entitiesPage.openNewPerson(members);
      await entitiesPage.dialog.locator('#ab-name').fill(marwa);
      await entitiesPage.dialog.locator('#ab-email').fill('marwa.ali@');
      return entitiesPage.trySave();
    });
    await then(async () => {
      expect(invalid === undefined || invalid >= 400, "an e-mail like 'marwa.ali@' should be refused").toBe(true);
      await expect(entitiesPage.dialog, 'the form stays open').toBeVisible();
      await expect.poll(() => entitiesPage.dialogMessages(), { message: 'a message for the e-mail format' }).toMatch(/بريد|صحيح|صالح|email/i);
    });
    const duplicate = await when(async () => {
      await entitiesPage.dialog.locator('#ab-email').fill(karimEmail);
      return entitiesPage.trySave();
    });
    await then(async () => {
      expect(duplicate === undefined || duplicate >= 400, "the e-mail of 'كريم حسن' should be refused").toBe(true);
      await expect.poll(() => entitiesPage.dialogMessages(), { message: 'a duplicate e-mail message' }).toMatch(/مستخدم|موجود|مكرر|already|exists/i);
      await page.keyboard.press('Escape');
      await entitiesPage.searchInput.fill(marwa);
      await expect(entitiesPage.node(marwa), 'no person was created').toHaveCount(0);
    });
  });

  test(...scenario('ACM-02-08', `
    @Priority=3
    Scenario: Verify that an entity cannot be saved without its name or 'نوع الجهة'
    Given the admin is on 'الجهات'
    When the admin clicks 'جهة جديدة' and saves with an empty name
    Then 'حقل مطلوب' is displayed under the name and the entity is not created
    When the admin enters the name 'إدارة النشاط الرياضي' and leaves 'نوع الجهة' empty
    Then a validation message is displayed under 'نوع الجهة'
    And clicking 'إلغاء' closes the form without adding anything to the tree
    #Arabic: التحقق من إلزامية اسم الجهة ونوعها قبل الحفظ
  `), async ({ signIn, runId, adminApi, cleanup, entitiesPage }) => {
    const name = autoName(runId, 'إدارة النشاط الرياضي');
    await given(async () => {
      cleanup(() => adminApi.deleteAddressBookMatching(runId));
      await signIn('ADMIN');
      await entitiesPage.open();
      await entitiesPage.openNewEntity();
    });
    const noName = await when(() => entitiesPage.trySave());
    await then(async () => {
      expect(noName, 'nothing should be sent without a name').toBeUndefined();
      await expect(entitiesPage.dialog.getByText(/مطلوب/).first(), "'حقل مطلوب' under the name").toBeVisible();
    });
    const noType = await when(async () => {
      await entitiesPage.dialog.locator('#ab-name').fill(name);
      return entitiesPage.trySave();
    });
    await then(async () => {
      expect(noType === undefined || noType >= 400, "an entity with no 'نوع الجهة' should be refused").toBe(true);
      await expect(entitiesPage.dialog, 'the form stays open').toBeVisible();
      await expect.poll(() => entitiesPage.dialogMessages(), { message: "a message under 'نوع الجهة'" }).toMatch(/نوع|مطلوب/);
      await entitiesPage.dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
      await expect(entitiesPage.dialog, "'إلغاء' closes the form").toBeHidden();
      await entitiesPage.searchInput.fill(name);
      await expect(entitiesPage.node(name), 'nothing added to the tree').toHaveCount(0);
    });
  });
});
