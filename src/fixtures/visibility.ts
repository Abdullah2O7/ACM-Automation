import { expect } from '@playwright/test';
import { baseUrlOf } from '../config/portals';
import type { OtherUser } from './acm.fixture';
import type { RegisterFolder } from '../pages/register/register.page';

/**
 * What another user sees of a record (ACM-07, ACM-09, ACM-10): in a list, in 'البحث في كل السجلات', and by its
 * direct address. The record is found by its subject, which carries the case's run id.
 *
 * Seen on the live portal (2026-11-16): a registered record directed to a person or an entity reaches that person in
 * 'البريد الداخلي' (internal mail inbox) and in the register's 'الكل' - not in the register's 'الوارد', which shows what
 * the user's register scope covers (the admin sees every incoming record there).
 */

/** The record is in the user's list of a folder of 'الصادر و الوارد'. */
export const expectSeesInRegister = async (user: OtherUser, folder: RegisterFolder, subject: string, who: string): Promise<void> => {
  await user.registerPage.openFolder(folder);
  await user.registerPage.search(subject);
  await expect(user.registerPage.row(subject), `'${subject}' should be visible to ${who}`).toHaveCount(1);
};

/** The record is in the user's 'البريد الداخلي' list (the folder opened through the palette, e.g. 'البريد الداخلي · الرسائل الواردة'). */
export const expectSeesInMailbox = async (user: OtherUser, section: string, subject: string, who: string): Promise<void> => {
  await user.mailboxPage.open();
  await user.appShell.goTo(section);
  await user.mailboxPage.search(subject);
  await expect(user.mailboxPage.row(subject), `'${subject}' should be in ${who}'s '${section}'`).toHaveCount(1);
};

/** A record directed to the user (or to its entity) reached them: it is in their internal mail inbox. */
export const expectReceived = (user: OtherUser, subject: string, who: string): Promise<void> =>
  expectSeesInMailbox(user, 'البريد الداخلي · الرسائل الواردة', subject, who);

/**
 * The record is nowhere for the user: not in the register (its 'الكل') or the internal mail, not among the records
 * 'البحث في كل السجلات' finds, and its direct address shows nothing of it.
 */
export const expectDoesNotSee = async (user: OtherUser, documentId: number, subject: string, who: string): Promise<void> => {
  await user.registerPage.openFolder('All');
  await user.registerPage.search(subject);
  await expect(user.registerPage.row(subject), `'${subject}' should not be in ${who}'s register`).toHaveCount(0);
  await user.mailboxPage.open();
  await user.mailboxPage.search(subject);
  await expect(user.mailboxPage.row(subject), `'${subject}' should not be in ${who}'s internal mail`).toHaveCount(0);
  // 'البحث في كل السجلات': its record results only
  const results = await user.appShell.searchEverything(subject);
  await expect(results, `'${subject}' should not be found by ${who}'s search`).toHaveCount(0);
  await user.page.keyboard.press('Escape');
  // The direct address
  await user.page.goto(`${baseUrlOf('acm')}/secretary/register?focus=${documentId}`);
  await user.page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(user.page.locator('main'), `${who} should be denied '${subject}' by its address`).not.toContainText(subject);
};

/**
 * The admin sees every mail (business rule confirmed by the reviewer, 2026-11-17: "the admin will be able to view all
 * mails") - in the register's 'الكل'. At least one row: the same record may be listed twice (see ACM-08-16).
 */
export const expectAdminSees = async (admin: OtherUser, subject: string): Promise<void> => {
  await admin.registerPage.openFolder('All');
  await admin.registerPage.search(subject);
  await expect(admin.registerPage.row(subject).first(), `'${subject}' should be visible to the admin (who views all mails)`).toBeVisible();
};
