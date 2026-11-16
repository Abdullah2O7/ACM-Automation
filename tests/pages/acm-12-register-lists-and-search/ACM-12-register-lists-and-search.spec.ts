import { expect, test } from '../../../src/fixtures/acm.fixture';
import { given, scenario, then, when } from '../../../src/utils/core/scenario-test';
import { createData } from '../../../src/utils/core/setup-step';
import { autoName } from '../../../src/domain/acm-names';
import { createFootballAssociation } from '../../../src/fixtures/club';
import { directions, documentTypes } from '../../../test-data/acm/acm.data';

//========================================================================
// ACM-12 - Register Lists and Search
// The test cases of "ACM-12 - Register Lists and Search.xlsx", in the sheet's order. Each case is written as the sheet has it: the scenario text
// is pasted from the sheet's cell (@Priority, Scenario, Given, When, Then, #Arabic) and the code below it does what each
// Given / When / Then says. tests/unit/story-sheets.test.ts keeps this text equal to the sheet.
//
// The register is shared with other testers: every list is narrowed to the case's own records by its run id first.
//========================================================================================

const todayText = (): string => {
  const date = new Date();
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

/** Reads a number written with Latin or Arabic-Indic digits. */
const toNumber = (text: string): number => Number(text.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^\d]/g, '') || '0');

test.describe('ACM-12 Register Lists and Search', () => {

  test(...scenario('ACM-12-01', `
    @Priority=3
    Scenario: Verify that searching by subject and by body works with the 3-character minimum
    Given records exist with known subject and body text
    When the user searches by subject
    Then matching records are listed
    When the user enables 'البحث في متن الرسالة أيضًا' and types less than 3 characters
    Then the hint 'يتطلب البحث في المتن ثلاثة أحرف على الأقل.' is shown
    #Arabic: التحقق من البحث بالموضوع والمتن وشرط الثلاثة أحرف
  `), async ({ signIn, runId, adminApi, cleanup, registerPage }) => {
    const subject = autoName(runId, 'سجل البحث');
    const bodyWord = `متن${runId}`;
    await given(async () => {
      await createData('register a record with a known subject and body', async () => {
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        await adminApi.sendCorrespondence({ subject, body: `نص يحتوي ${bodyWord}`, directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [efa] });
      });
      await signIn('ADMIN');
      await registerPage.openFolder('Inbox');
    });
    await when(() => registerPage.search(subject));
    await then(() => expect(registerPage.row(subject), 'found by subject').toHaveCount(1));
    await when(async () => {
      await registerPage.bodySearchSwitch.click();
      await registerPage.searchBox.fill('مت');
    });
    await then(async () => {
      await expect(registerPage.bodySearchHint).toBeVisible();
      // ...and with 3 characters or more, the body is searched
      await registerPage.search(bodyWord);
      await expect(registerPage.row(subject), 'found by a word of its body').toHaveCount(1);
    });
  });

  test(...scenario('ACM-12-02', `
    @Priority=3
    Scenario: Verify that filter and sort in the register return correct results
    Given the user is on 'الصادر و الوارد'
    When the user applies 'تصفية' ('الاتجاه', 'النوع', date range, 'مجلد البريد')
    And sorts by 'الموضوع', 'الرقم المرجعي' or 'التاريخ'
    Then only matching records are shown in the correct order
    #Arabic: التحقق من التصفية والترتيب في سجل الصادر والوارد
  `), async ({ signIn, runId, adminApi, cleanup, registerPage }) => {
    // Subjects that sort in a known order, of two types
    const letters = ['أ', 'ب', 'ج'].map((letter) => autoName(runId, `${letter} خطاب`));
    const fax = autoName(runId, 'د فاكس');
    await given(async () => {
      await createData('register 3 letters and a fax', async () => {
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        for (const subject of letters) {
          await adminApi.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [efa] });
        }
        await adminApi.sendCorrespondence({ subject: fax, directionId: directions.incoming.id, typeId: documentTypes.fax.id, recipients: [efa] });
      });
      await signIn('ADMIN');
      await registerPage.openFolder('Inbox');
      await registerPage.search(runId);
    });
    const ours = async (): Promise<string[]> => (await registerPage.listedSubjects()).map((row) => [...letters, fax].find((subject) => row.includes(subject)) ?? '').filter(Boolean);

    await when(() => registerPage.filter([directions.incoming.label, documentTypes.letter.label], { from: todayText(), to: todayText() }));
    await then(async () => {
      expect((await ours()).sort(), "'وارد' + 'خطاب' + today: the letters only").toEqual([...letters].sort());
    });
    await when(() => registerPage.sortBy('الموضوع'));
    const first = await then(async () => {
      const order = await ours();
      const ascending = [...letters].sort((a, b) => a.localeCompare(b, 'ar'));
      expect([ascending, [...ascending].reverse()], "sorted by 'الموضوع'").toContainEqual(order);
      return order;
    });
    await when(() => registerPage.sortBy('الموضوع'));
    await then(async () => expect(await ours(), 'clicking again reverses the order').toEqual([...first].reverse()));
    for (const column of ['الرقم المرجعي', 'التاريخ']) {
      await when(() => registerPage.sortBy(column));
      await then(async () => expect((await ours()).sort(), `sorting by '${column}' keeps the filtered records`).toEqual([...letters].sort()));
    }
    test.info().annotations.push({ type: 'note', description: "'مجلد البريد' of 'تصفية' lists the archive folders; the case's records are in none, so it is not applied." });
  });

  test(...scenario('ACM-12-03', `
    @Priority=3
    Scenario: Verify that read/unread status updates when opening a correspondence
    Given an unread correspondence exists
    When the user opens it
    Then it is shown as 'مقروء'
    And the folder unread counter decreases
    #Arabic: التحقق من تحديث حالة المقروء/غير المقروء والعدادات
  `), async ({ page, signIn, runId, adminApi, cleanup, registerPage, appShell }) => {
    const subject = autoName(runId, 'مراسلة غير مقروءة');
    const unreadCount = async (): Promise<number> => toNumber((await appShell.navigation.getByRole('link', { name: /الصادر و الوارد/ }).first().innerText()).replace('الصادر و الوارد', ''));
    const { documentId, before } = await given(async () => {
      const id = await createData('register an unread correspondence', async () => {
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        return adminApi.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [efa] });
      });
      await signIn('ADMIN');
      await registerPage.openFolder('Inbox');
      await registerPage.search(subject);
      await expect(registerPage.row(subject)).toContainText('غير مقروء');
      return { documentId: id, before: await unreadCount() };
    });
    await when(() => registerPage.openRecord('Inbox', documentId));
    await then(async () => {
      await registerPage.openFolder('Inbox');
      await registerPage.search(subject);
      // A row starts with its read status ('مقروء' / 'غير مقروء'); other text in the row may contain the words too
      await expect(registerPage.row(subject), "shown as 'مقروء'").toHaveText(/^\s*مقروء/);
      await page.reload();
      await expect.poll(unreadCount, { message: 'the unread counter of the register' }).toBe(before - 1);
    });
  });

  test(...scenario('ACM-12-04', `
    @Priority=3
    Scenario: Verify that correspondence can be moved to Spam and Deleted and restored
    Given a record exists in 'الوارد'
    When the user marks it as spam or deletes it
    Then it moves to the 'المزعجة' or 'المحذوفة' folder
    And the user can restore it to its original folder
    #Arabic: التحقق من نقل المراسلة للمزعجة أو المحذوفة واسترجاعها
  `), async ({ page, signIn, runId, adminApi, cleanup, registerPage }) => {
    const subject = autoName(runId, 'مراسلة للنقل');
    const documentId = await given(async () => {
      const id = await createData('register a record in الوارد', async () => {
        const efa = await createFootballAssociation(adminApi, runId, cleanup);
        cleanup(() => adminApi.purgeCorrespondenceMatching(runId));
        return adminApi.sendCorrespondence({ subject, directionId: directions.incoming.id, typeId: documentTypes.letter.id, recipients: [efa] });
      });
      await signIn('ADMIN');
      return id;
    });
    // Seen live (2026-11-16): ticking a record of 'الوارد' offers 'تصنيف كغير مرغوب' (to 'المزعجة'); a record's 'حذف'
    // sends it to 'المحذوفة'. Ticked there, 'المزعجة' offers 'ليس غير مرغوب' / 'استرجاع', 'المحذوفة' offers 'استرجاع'.
    const ticked = async (folder: 'Inbox' | 'Spam' | 'Deleted'): Promise<void> => {
      await registerPage.openFolder(folder);
      await registerPage.search(subject);
      await registerPage.row(subject).first().getByRole('checkbox').click();
    };
    const act = async (name: RegExp): Promise<void> => {
      await Promise.all([
        page.waitForResponse((answer) => answer.url().includes(`/api/acm/correspondence`) && answer.request().method() !== 'GET', { timeout: 15_000 }),
        page.locator('main').getByRole('button', { name }).first().click(),
      ]);
      const confirm = page.getByRole('alertdialog').first();
      if (await confirm.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await confirm.getByRole('button').filter({ hasNotText: /إلغاء|إغلاق/ }).last().click();
      }
    };
    for (const [folder, toFolder, restoreWith] of [
      ['Spam', async () => { await ticked('Inbox'); await act(/^تصنيف كغير مرغوب$/); }, /^(ليس غير مرغوب|استرجاع)$/],
      ['Deleted', async () => { await registerPage.openRecord('Inbox', documentId); await act(/^حذف$/); }, /^استرجاع$/],
    ] as const) {
      await when(toFolder);
      await then(async () => {
        await registerPage.openFolder(folder);
        await registerPage.search(subject);
        await expect(registerPage.row(subject), `in '${folder}'`).toHaveCount(1);
        await ticked(folder);
        await act(restoreWith);
        await registerPage.openFolder('Inbox');
        await registerPage.search(subject);
        await expect(registerPage.row(subject), "restored to 'الوارد'").toHaveCount(1);
      });
    }
  });

  test(...scenario('ACM-12-05', `
    @Priority=4
    Scenario: Verify that pagination in the register works correctly
    Given more than 50 records exist
    When the user navigates pages or changes page size
    Then the correct records and 'عرض x–y من z' are displayed
    #Arabic: التحقق من الترقيم والتنقل بين الصفحات في السجل
  `), async ({ page, signIn, registerPage }) => {
    const range = async (): Promise<[number, number, number]> => {
      const text = (await registerPage.rangeText.first().innerText()).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
      const [from, to, total] = (text.match(/\d+/g) ?? []).map(Number);
      return [from, to, total];
    };
    const total = await given(async () => {
      await signIn('ADMIN');
      // 'الكل' of the register (all folders) holds the shared portal's records
      await registerPage.openFolder('Inbox');
      const [, , count] = await range();
      test.skip(count <= 50, `'الوارد' holds ${count} records; the case needs more than 50`);
      return count;
    });
    await then(async () => expect(await range(), 'page 1 of 50').toEqual([1, 50, total]));
    await when(() => page.getByRole('button', { name: 'الصفحة التالية' }).click());
    await then(async () => {
      // The range text is waited for, not a request: a page seen before may be shown from what the screen kept
      await expect.poll(range, { message: 'page 2' }).toEqual([51, Math.min(100, total), total]);
      await expect(registerPage.rows).toHaveCount(Math.min(100, total) - 50);
    });
    const size = await when(async () => {
      await registerPage.pageSize.click();
      const sizes = (await page.getByRole('option').allInnerTexts()).map((text) => Number(text.trim())).filter((value) => value > 0 && value < 50);
      expect(sizes.length, "'عدد السجلات في الصفحة' should offer a size under 50").toBeGreaterThan(0);
      await page.getByRole('option', { name: String(sizes[0]), exact: true }).click();
      return sizes[0];
    });
    await then(async () => {
      await expect.poll(range, { message: `a page of ${size}, back on page 1` }).toEqual([1, size, total]);
      await expect(registerPage.rows).toHaveCount(size);
    });
  });
});
