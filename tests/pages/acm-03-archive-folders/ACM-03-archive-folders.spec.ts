import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { asSetup } from '../../../src/utils/core/setup-step';
import { autoName } from '../../../src/domain/acm-names';
import { archive } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-03 - Archive Folders
// The test cases of "ACM-03 - Archive Folders.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// The folders a case makes carry its run id and are removed after it (sub-folders first).
//========================================================================================

test.describe('ACM-03 Archive Folders', () => {

  test(...scenario('ACM-03-01', `
    @Priority=1
    Scenario: Verify that the admin can create a main archive folder with sub-folders for the entity
    Given the admin is on 'الأرشيف'
    When the admin clicks 'مجلد رئيسي جديد' and creates 'أرشيف النادي الأهلي 2026'
    And creates the sub-folders 'أرشيف إدارة الكرة', 'أرشيف إدارة العضويات' and 'أرشيف الإدارة المالية' under it
    Then the hierarchy shows 'أرشيف النادي الأهلي 2026' with the 3 sub-folders nested under it
    And each folder shows a documents count of 0
    #Arabic: التحقق من إنشاء مجلد أرشيف رئيسي للنادي الأهلي وتحته مجلدات فرعية لكل إدارة
  `), async ({ signIn, runId, adminApi, cleanup, archivePage }) => {
    const mainFolder = autoName(runId, archive.mainFolder);
    const subFolders = Object.values(archive.subFolders).map((name) => autoName(runId, name));

    await given(async () => {
      cleanup(() => adminApi.deleteCabinetsMatching(runId));
      await signIn('ADMIN');
      await archivePage.open();
    });

    await when(async () => {
      await archivePage.createMainFolder(mainFolder);
      for (const sub of subFolders) {
        await archivePage.createSubFolder(sub, mainFolder);
      }
    });

    await then(async () => {
      await archivePage.open();
      await expect(archivePage.folderNode(mainFolder)).toBeVisible();
      for (const sub of subFolders) {
        await expect(archivePage.childOf(mainFolder, sub), `'${sub}' nested under '${mainFolder}'`).toHaveCount(1);
      }
      for (const folder of [mainFolder, ...subFolders]) {
        expect(await archivePage.documentsCount(folder), `the documents count of '${folder}'`).toBe(0);
      }
    });
  });

  test(...scenario('ACM-03-02', `
    @Priority=3
    Scenario: Verify that archive folder management allows renaming and deleting folders
    Given 'أرشيف إدارة العضويات' exists under 'أرشيف النادي الأهلي 2026'
    When the user renames it to 'أرشيف شؤون العضويات'
    Then the new name is shown in the hierarchy
    When the user deletes the empty folder 'مجلد مؤقت'
    Then it is removed
    #Arabic: التحقق من إعادة تسمية مجلد أرشيف العضويات وحذف مجلد فارغ
  `), async ({ signIn, runId, adminApi, cleanup, archivePage }) => {
    const mainFolder = autoName(runId, archive.mainFolder);
    const initialSub = autoName(runId, archive.subFolders.members);
    const renamedSub = autoName(runId, 'أرشيف شؤون العضويات');
    const tempFolder = autoName(runId, 'مجلد مؤقت');

    await given(async () => {
      await asSetup('create the folders', async () => {
        cleanup(() => adminApi.deleteCabinetsMatching(runId));
        const mainId = await adminApi.createCabinet(mainFolder);
        await adminApi.createCabinet(initialSub, { parentId: mainId });
        await adminApi.createCabinet(tempFolder);
      });
      await signIn('ADMIN');
      await archivePage.open();
    });

    await when(() => archivePage.renameFolder(initialSub, renamedSub));
    await then(async () => {
      await archivePage.open();
      await expect(archivePage.childOf(mainFolder, renamedSub), 'the new name, still under the main folder').toHaveCount(1);
      await expect(archivePage.folderNode(initialSub), 'the old name is gone').toHaveCount(0);
    });

    await when(() => archivePage.deleteFolder(tempFolder));
    await then(async () => {
      await archivePage.open();
      await expect(archivePage.folderNode(tempFolder), 'removed from the hierarchy').toHaveCount(0);
    });
  });
  test(...scenario('ACM-03-03', `
    @Priority=2
    Scenario: Verify that the admin can create an archive folder for the external entity matching its name
    Given 'أرشيف النادي الأهلي 2026' and its sub-folders exist
    When the admin clicks 'مجلد رئيسي جديد' and creates 'أرشيف الاتحاد المصري لكرة القدم 2026'
    And creates the sub-folder 'أرشيف لجنة المسابقات' under it
    Then each folder name matches the entity it belongs to
    And the hierarchy shows both main folders with their sub-folders and a documents count of 0
    #Arabic: التحقق من إنشاء مجلد أرشيف للجهة الخارجية ومجلد فرعي للجنة المسابقات بأسماء مطابقة للجهات
  `), async ({ signIn, runId, adminApi, cleanup, archivePage }) => {
    const clubFolder = autoName(runId, archive.mainFolder);
    const clubSubs = Object.values(archive.subFolders).map((name) => autoName(runId, name));
    const efaFolder = autoName(runId, 'أرشيف الاتحاد المصري لكرة القدم 2026');
    const committeeFolder = autoName(runId, 'أرشيف لجنة المسابقات');
    await given(async () => {
      await asSetup('create the club archive and its sub-folders', async () => {
        cleanup(() => adminApi.deleteCabinetsMatching(runId));
        const mainId = await adminApi.createCabinet(clubFolder);
        for (const sub of clubSubs) {
          await adminApi.createCabinet(sub, { parentId: mainId });
        }
      });
      await signIn('ADMIN');
      await archivePage.open();
    });
    await when(async () => {
      await archivePage.createMainFolder(efaFolder);
      await archivePage.createSubFolder(committeeFolder, efaFolder);
    });
    await then(async () => {
      await archivePage.open();
      expect(efaFolder, 'the folder is named after its entity').toContain('الاتحاد المصري لكرة القدم');
      expect(committeeFolder, 'the sub-folder is named after its entity').toContain('لجنة المسابقات');
      await expect(archivePage.childOf(efaFolder, committeeFolder), `'${committeeFolder}' under '${efaFolder}'`).toHaveCount(1);
      for (const sub of clubSubs) {
        await expect(archivePage.childOf(clubFolder, sub), `'${sub}' under '${clubFolder}'`).toHaveCount(1);
      }
      for (const folder of [efaFolder, committeeFolder]) {
        expect(await archivePage.documentsCount(folder), `the documents count of '${folder}'`).toBe(0);
      }
    });
  });

  test(...scenario('ACM-03-04', `
    @Priority=3
    Scenario: Verify that an archive folder cannot be created with an empty name or a name already used under the same parent
    Given 'أرشيف النادي الأهلي 2026' contains the sub-folder 'أرشيف إدارة الكرة'
    When the admin clicks 'إضافة مجلد فرعي' under 'أرشيف النادي الأهلي 2026' and leaves the name empty
    Then the add button stays disabled or 'حقل مطلوب' is displayed
    When the admin enters 'أرشيف إدارة الكرة' again under the same parent
    Then a duplicate name validation message is displayed
    And the hierarchy still shows one 'أرشيف إدارة الكرة' only
    #Arabic: التحقق من رفض إنشاء مجلد أرشيف بدون اسم أو باسم مكرر تحت نفس المجلد
  `), async ({ page, signIn, runId, adminApi, cleanup, archivePage }) => {
    const mainFolder = autoName(runId, archive.mainFolder);
    const football = autoName(runId, archive.subFolders.football);
    await given(async () => {
      await asSetup('create the club archive with أرشيف إدارة الكرة', async () => {
        cleanup(() => adminApi.deleteCabinetsMatching(runId));
        const mainId = await adminApi.createCabinet(mainFolder);
        await adminApi.createCabinet(football, { parentId: mainId });
      });
      await signIn('ADMIN');
      await archivePage.open();
    });
    await when(() => archivePage.openNewSubFolder(mainFolder));
    await then(async () => {
      const disabled = await archivePage.addButton.isDisabled();
      if (!disabled) {
        expect(await archivePage.tryAdd(), 'nothing should be sent with no name').toBeUndefined();
        await expect(page.locator('main').getByText(/مطلوب/).first(), "'حقل مطلوب'").toBeVisible();
      }
    });
    const status = await when(async () => {
      await archivePage.folderName.fill(football);
      return archivePage.tryAdd();
    });
    await then(async () => {
      expect(status === undefined || status >= 400, 'a name already used under the same parent should be refused').toBe(true);
      await expect(page.getByText(/موجود|مستخدم|مكرر|already|exists/i).first(), 'a duplicate name message').toBeVisible();
      await archivePage.open();
      await expect(archivePage.childOf(mainFolder, football), `one '${football}' only`).toHaveCount(1);
    });
  });
});
