import { request, type APIRequestContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { baseUrlOf } from '../config/portals';
import type { Credentials } from '../config/auth-state';
import { acmTimeouts } from '../config/timeouts';

/**
 * The ACM server's own REST API (`/api/acm/...`), as the portal calls it. Used for what a case does NOT check: creating
 * the person and user a case signs in as, and removing what a case created. The check itself always goes through the UI.
 *
 * Every answer is wrapped `{ status: 'Ok', value }` or `{ status: '<Error>', errorMessage }`; `call` unwraps it and throws
 * with the server's own message otherwise.
 */

type Envelope<T> = { status: string; value?: T; errorMessage?: string };

export type AcmToken = { token: string; expiresAt: number };

export type CreatedUser = { appUserId: number; userName: string; temporaryPassword: string };

export type RoleTemplate = { userRoleTemplateId: number; code: string; name: { ar: string; en: string }; isDisabled: boolean; permissions: string[] };

export type MailboxSummary = { id: number; userName?: string; host?: string };

const apiBase = (): string => `${baseUrlOf('acm')}/api/acm`;

const newContext = (): Promise<APIRequestContext> => request.newContext({ ignoreHTTPSErrors: true, timeout: acmTimeouts.apiCall });

/** A token this close to expiry is fetched again rather than handed to a case that may outlive it. */
const RENEW_BEFORE_MS = 10 * 60_000;
const tokens = new Map<string, Promise<AcmToken>>();
/** Tokens kept between workers and runs: runtime/ is ignored by Git and disposable (a token lives one hour). */
const TOKEN_FOLDER = path.resolve('runtime', 'acm-session');

const tokenFile = (username: string): string => path.join(TOKEN_FOLDER, `${createHash('sha256').update(`${baseUrlOf('acm')}|${username}`).digest('hex').slice(0, 16)}.json`);

const fresh = (token: AcmToken | undefined): token is AcmToken => Boolean(token && token.expiresAt - Date.now() > RENEW_BEFORE_MS);

const readSavedToken = (username: string): AcmToken | undefined => {
  try {
    const saved = JSON.parse(readFileSync(tokenFile(username), 'utf8')) as AcmToken;
    return fresh(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
};

const fetchAndSave = async (credentials: Credentials): Promise<AcmToken> => {
  const token = await fetchToken(credentials);
  mkdirSync(TOKEN_FOLDER, { recursive: true });
  writeFileSync(tokenFile(credentials.username), JSON.stringify(token), 'utf8');
  return token;
};

/**
 * The account's token, signed in for once and shared by every case, worker and run until it nears its expiry (one
 * hour). The server limits sign-ins ("429 Too many attempts") and the account is the team's, so the tests sign in as
 * rarely as they can.
 */
export const tokenFor = async (credentials: Credentials, { keep = true }: { keep?: boolean } = {}): Promise<string> => {
  const inWorker = await tokens.get(credentials.username)?.catch(() => undefined);
  if (fresh(inWorker)) {
    return inWorker.token;
  }
  // A disposable user of one case is signed in for that case only: its token is not kept on disk
  const saved = keep ? readSavedToken(credentials.username) : undefined;
  const next = saved ? Promise.resolve(saved) : keep ? fetchAndSave(credentials) : fetchToken(credentials);
  tokens.set(credentials.username, next);
  return (await next).token;
};

/** Forgets a token the server refused and signs in again. */
export const renewToken = async (credentials: Credentials): Promise<string> => {
  rmSync(tokenFile(credentials.username), { force: true });
  const next = fetchAndSave(credentials);
  tokens.set(credentials.username, next);
  return (await next).token;
};

/** How often a sign-in refused with "429 Too many attempts" is tried again, and the wait before each try. */
const RATE_LIMIT_TRIES = 4;
const RATE_LIMIT_WAIT_MS = 20_000;

/** Signs in through the API: the Bearer token the portal keeps in sessionStorage['acm.accessToken']. */
export const fetchToken = async ({ username, password }: Credentials): Promise<AcmToken> => {
  const context = await newContext();
  try {
    let response = await context.post(`${apiBase()}/auth/login`, { data: { userName: username, password } });
    // The server limits sign-ins per account; wait as it asks (Retry-After) and try again
    for (let attempt = 1; response.status() === 429 && attempt < RATE_LIMIT_TRIES; attempt += 1) {
      const retryAfter = Number(response.headers()['retry-after']);
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_WAIT_MS * attempt);
      response = await context.post(`${apiBase()}/auth/login`, { data: { userName: username, password } });
    }
    const body = (await response.json().catch(() => ({}))) as Envelope<{ token: string; expiresAt: string; requiresTwoFactor: boolean }>;
    if (!response.ok() || !body.value?.token) {
      throw new Error(`SIGN_IN_FAILED:${username}: ${response.status()} ${body.errorMessage ?? ''}`.trim());
    }
    if (body.value.requiresTwoFactor) {
      throw new Error(`SIGN_IN_NEEDS_OTP:${username}: the account asks for a one-time code, which the tests cannot read.`);
    }
    return { token: body.value.token, expiresAt: Date.parse(body.value.expiresAt) };
  } finally {
    await context.dispose();
  }
};

export class AcmApi {
  private constructor(
    private readonly context: APIRequestContext,
    private readonly credentials: Credentials,
    private token: string,
  ) {}

  static async as(credentials: Credentials): Promise<AcmApi> {
    return new AcmApi(await newContext(), credentials, await tokenFor(credentials));
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }

  private async call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown): Promise<T> {
    const send = () =>
      this.context.fetch(`${apiBase()}${path}`, {
        method,
        headers: { authorization: `Bearer ${this.token}` },
        ...(data === undefined ? {} : { data }),
      });
    let response = await send();
    if (response.status() === 401) {
      // The kept token was revoked (the account signed out somewhere): sign in once more
      this.token = await renewToken(this.credentials);
      response = await send();
    }
    const text = await response.text();
    let body: Envelope<T>;
    try {
      body = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new Error(`ACM_API_NOT_JSON: ${method} ${path} answered ${response.status()} with: ${text.slice(0, 120)}`);
    }
    if (!response.ok() || body.status !== 'Ok') {
      throw new Error(`ACM_API_FAILED: ${method} ${path} answered ${response.status()} ${body.status}: ${body.errorMessage ?? text.slice(0, 200)}`);
    }
    return body.value as T;
  }

  // ---------------------------------------------- Entities and persons ----------------------------------------------

  /** A main (or, with `parentId`, sub-) entity; `type` 1 = internal (داخلى), 2 = external (خارجى). Returns its id. */
  createEntity(name: string, options: { parentId?: number; type?: 1 | 2; email?: string } = {}): Promise<number> {
    return this.call<number>('POST', '/addressbook', {
      name,
      addressBookTypeId: options.type ?? 1,
      isManager: false,
      isPerson: false,
      ...(options.parentId ? { parentId: options.parentId } : {}),
      ...(options.email ? { email: options.email } : {}),
    });
  }

  createPerson(name: string, parentId: number, email: string): Promise<number> {
    return this.call<number>('POST', '/addressbook', { parentId, name, email, isManager: false, isPerson: true });
  }

  /**
   * Removes every address book entry whose name contains the text (a case's own, made through the screen): persons first,
   * then entities from the deepest up, as the server only deletes an entry that holds nothing. Best effort.
   */
  async deleteAddressBookMatching(text: string): Promise<void> {
    type Node = { id?: number; addressBookEntryId?: number; name?: string; isPerson?: boolean; children?: Node[] };
    const found: { id: number; isPerson: boolean; depth: number }[] = [];
    const walk = (nodes: Node[] | undefined, depth: number): void => {
      for (const node of nodes ?? []) {
        const id = node.id ?? node.addressBookEntryId;
        if (id !== undefined && node.name?.includes(text)) {
          found.push({ id, isPerson: Boolean(node.isPerson), depth });
        }
        walk(node.children, depth + 1);
      }
    };
    walk(await this.call<Node[]>('GET', '/addressbook/tree?language=ar'), 0);
    found.sort((a, b) => Number(b.isPerson) - Number(a.isPerson) || b.depth - a.depth);
    for (const entry of found) {
      await this.deleteAddressBookEntry(entry.id).catch(() => undefined);
    }
  }

  // ------------------------------------------------- Portal settings ------------------------------------------------

  /** 'هوية الجهة' as saved: GET /settings/organization. */
  organization(): Promise<{ nameTranslations: Record<'ar' | 'en', string>; aliasTranslations: Record<'ar' | 'en', string>; addressTranslations: Record<'ar' | 'en', string> }> {
    return this.call('GET', '/settings/organization');
  }

  /** Saves 'هوية الجهة' as 'حفظ الهوية' does (PUT /settings/organization {name, alias, address}). */
  setOrganization(identity: { name: Record<'ar' | 'en', string>; alias: Record<'ar' | 'en', string>; address: Record<'ar' | 'en', string> }): Promise<unknown> {
    return this.call('PUT', '/settings/organization', identity);
  }

  /** The portal's current logo: file name, type and its bytes in base64. */
  organizationLogo(): Promise<{ fileName: string; contentType: string; content: string }> {
    return this.call('GET', '/settings/organization/logo');
  }

  /** 'البريد الخارجي (SMTP)' as saved (the password is never answered, only `hasPassword`). */
  dispatchSettings(): Promise<Record<string, unknown>> {
    return this.call('GET', '/settings/dispatch');
  }

  /** Saves 'البريد الخارجي (SMTP)'; an empty `password` keeps the saved one (as the screen says). */
  setDispatchSettings(settings: Record<string, unknown>): Promise<unknown> {
    return this.call('PUT', '/settings/dispatch', { ...settings, password: '' });
  }

  /** Removes an entity or person. A record that holds persons or is named in a correspondence cannot be removed. */
  deleteAddressBookEntry(id: number): Promise<boolean> {
    return this.call<boolean>('DELETE', `/addressbook/${id}`);
  }

  // ------------------------------------------------------ Users -----------------------------------------------------

  /** Creates the user of a person, as the "مستخدم جديد" dialog does, OTP off. The server answers its temporary password. */
  async createUser(personId: number, userName: string, fullName: string, email: string, roleTemplateId?: number): Promise<CreatedUser> {
    const created = await this.call<{ appUserId: number; temporaryPassword: string }>('POST', '/users', {
      addressBookEntryId: personId,
      userName,
      fullName,
      email,
      departmentId: null,
    });
    if (roleTemplateId !== undefined) {
      await this.call('POST', `/users/${created.appUserId}/access/apply-template`, { userRoleTemplateId: roleTemplateId, mode: 'Replace' });
    }
    await this.call('PUT', `/users/${created.appUserId}/security`, { twoFactorEnabled: false, expiresAt: null });
    return { appUserId: created.appUserId, userName, temporaryPassword: created.temporaryPassword };
  }

  /** "إيقاف وإزالة من القوائم": the account is closed and hidden; its history stays (users are never erased). */
  deleteUser(appUserId: number): Promise<boolean> {
    return this.call<boolean>('DELETE', `/users/${appUserId}`);
  }

  /** The id of a user by its exact user name, active or not (the list answers active users only unless asked). */
  async findUserId(userName: string): Promise<number | undefined> {
    for (const state of ['', '&IsActive=false']) {
      const page = await this.call<{ data: { appUserId: number; userName: string }[] }>('GET', `/users?Keyword=${encodeURIComponent(userName)}&PageSize=50${state}`);
      const found = page.data.find((user) => user.userName === userName);
      if (found) {
        return found.appUserId;
      }
    }
    return undefined;
  }

  /** How many users have this exact user name (active or not). */
  async countUsersNamed(userName: string): Promise<number> {
    let count = 0;
    for (const state of ['', '&IsActive=false']) {
      const page = await this.call<{ data: { userName: string }[] }>('GET', `/users?Keyword=${encodeURIComponent(userName)}&PageSize=50${state}`);
      count += page.data.filter((user) => user.userName.toLowerCase() === userName.toLowerCase()).length;
    }
    return count;
  }

  /** 'إيقاف' / 'تفعيل' of a user's page. */
  setUserActive(appUserId: number, isActive: boolean): Promise<boolean> {
    return this.call<boolean>('PUT', `/users/${appUserId}/status`, { isActive, reason: null });
  }

  /** Removes a user found by its user name, if there is one (clean-up of a user a case created through the UI). */
  async deleteUserNamed(userName: string): Promise<void> {
    const id = await this.findUserId(userName);
    if (id !== undefined) {
      await this.deleteUser(id);
    }
  }

  roleTemplates(): Promise<RoleTemplate[]> {
    return this.call<RoleTemplate[]>('GET', '/users/role-templates');
  }

  /**
   * A role template's id by its code or, when no template has that code, by its Arabic name (the team renames codes:
   * 2026-11-17 'admin' was removed and 'مدير التطبيق' became '002'). Disabled templates are passed over.
   */
  async roleTemplateId(code: string, arabicName?: string): Promise<number> {
    const templates = (await this.roleTemplates()).filter((template) => !template.isDisabled);
    const found = templates.find((template) => template.code === code) ?? (arabicName ? templates.find((template) => template.name.ar === arabicName) : undefined);
    if (!found) {
      throw new Error(`ROLE_TEMPLATE_NOT_FOUND: no role template with the code "${code}"${arabicName ? ` or the name '${arabicName}'` : ''}.`);
    }
    return found.userRoleTemplateId;
  }

  /** Creates a role template (POST /users/role-templates); returns its id. */
  async createRoleTemplate(code: string, name: string, permissions: string[]): Promise<number> {
    const created = await this.call<RoleTemplate>('POST', '/users/role-templates', { code, name: { ar: name, en: name }, description: code, permissions });
    return created.userRoleTemplateId;
  }

  /** Gives a user the permissions of a role template, in place of the ones it has. */
  applyRoleTemplate(appUserId: number, roleTemplateId: number): Promise<unknown> {
    return this.call('POST', `/users/${appUserId}/access/apply-template`, { userRoleTemplateId: roleTemplateId, mode: 'Replace' });
  }

  async deleteRoleTemplate(code: string): Promise<void> {
    const found = (await this.roleTemplates()).find((template) => template.code === code);
    if (found) {
      await this.call('DELETE', `/users/role-templates/${found.userRoleTemplateId}`);
    }
  }

  // ---------------------------------------------------- Lookups -----------------------------------------------------

  /** The ACTIVE values of a lookup table, as dropdowns get them. */
  lookupValues(table: LookupTable): Promise<{ id: number; code: string; name: string; orderLevel: number; isDisabled: boolean }[]> {
    return this.call('GET', `/config/${table}`);
  }

  /** Adds a value to a lookup table (as 'إضافة' + 'حفظ الجدول' do); returns its id. */
  addLookupValue(table: LookupTable, value: { code: string; ar: string; en: string; fr?: string; orderLevel: number }): Promise<number> {
    return this.call<number>('POST', `/config/${table}`, {
      code: value.code,
      translationAr: value.ar,
      translationEn: value.en,
      translationFr: value.fr ?? null,
      orderLevel: value.orderLevel,
      isDisabled: false,
    });
  }

  /**
   * A lookup value that stays on the portal, active at the start of a case: reactivated when an earlier run left it,
   * added otherwise. For a case that must make a record use the value: the server never deletes a value a record has
   * used (409 "القيمة مستخدمة فى بيانات قائمة ولا يمكن حذفها" - even after the record is purged), so such a case keeps
   * one value of its own instead of leaving a new one behind on every run. Returns its id.
   */
  async activeLookupValue(table: LookupTable, value: { code: string; ar: string; en: string; fr?: string }): Promise<number> {
    const rows = await this.lookupRows(table);
    const existing = rows.find((row) => row.code === value.code);
    if (!existing) {
      return this.addLookupValue(table, { ...value, orderLevel: rows.length + 1 });
    }
    await this.call('PUT', `/config/${table}/${existing.id}`, {
      code: value.code,
      translationAr: value.ar,
      translationEn: value.en,
      translationFr: value.fr ?? null,
      orderLevel: existing.orderLevel,
      isDisabled: false,
    });
    return existing.id;
  }

  /** Every value of a lookup table, active or not, with its id and order (what 'أكواد النظام' shows). */
  lookupRows(table: LookupTable): Promise<{ id: number; code: string; nameAr: string; orderLevel: number; isDisabled: boolean }[]> {
    return this.call('GET', `/config/${table}/translations`);
  }

  /** Puts the order of a table's values back as it was (after a case moved one). */
  async restoreLookupOrder(table: LookupTable, before: { id: number; orderLevel: number }[]): Promise<void> {
    const present = new Set((await this.lookupRows(table)).map((row) => row.id));
    const order = before.filter((row) => present.has(row.id)).map(({ id, orderLevel }) => ({ id, orderLevel }));
    await this.call('PUT', `/config/${table}/reorder`, { order });
  }

  /** Removes a lookup value by its code - active or not. Nothing happens when there is none. */
  async deleteLookupValue(table: LookupTable, code: string): Promise<void> {
    for (const row of (await this.lookupRows(table)).filter((candidate) => candidate.code === code)) {
      await this.call('DELETE', `/config/${table}/${row.id}`);
    }
  }

  // ------------------------------------------------- Correspondence -------------------------------------------------

  /** A draft of the register ('حفظ كمسودة' on 'الصادر و الوارد' > 'إنشاء'); returns its document id. */
  createDraft(subject: string, documentTypeId: number): Promise<number> {
    return this.call<number>('POST', '/correspondence', {
      documentTypeId,
      subject,
      body: '',
      bodyText: '',
      isSecure: false,
      inboxMode: false,
      saveAsDraft: true,
      draftModule: 2,
      initialAttachments: [],
      recipients: [{ name: '' }],
    });
  }

  /**
   * Sends a correspondence as 'إرسال' of the register form does (`register: true`, the default: 'الصادر و الوارد' >
   * 'إنشاء') or of 'البريد الداخلي' > 'رسالة جديدة' (`register: false`). Returns its document id. Seen on the live portal:
   * - register: POST /correspondence {documentDirectionId, documentTypeId, documentDate, subject, body, bodyText, isSecure,
   *   inboxMode:true, saveAsDraft:false, draftModule:2, recipients:[{name, addressBookEntryId}]} - sent at once;
   * - internal mail: POST /correspondence {..., inboxMode:false, saveAsDraft:true, draftModule:1, recipients:[{...,
   *   mailAddressTypeId:1}]} (a draft), then POST /correspondence/{id}/send.
   */
  async sendCorrespondence(options: {
    subject: string;
    recipients: { id: number; name: string }[];
    directionId?: number;
    typeId?: number;
    body?: string;
    isSecure?: boolean;
    register?: boolean;
  }): Promise<number> {
    const body = options.body ?? options.subject;
    const register = options.register ?? true;
    const documentId = await this.call<number>('POST', '/correspondence', {
      ...(options.directionId ? { documentDirectionId: options.directionId } : {}),
      ...(options.typeId ? { documentTypeId: options.typeId } : {}),
      documentDate: new Date().toISOString(),
      subject: options.subject,
      body,
      bodyText: body,
      isSecure: options.isSecure ?? false,
      inboxMode: register,
      saveAsDraft: !register,
      draftModule: register ? 2 : 1,
      initialAttachments: [],
      recipients: options.recipients.map((recipient) => ({ name: recipient.name, addressBookEntryId: recipient.id, mailAddressTypeId: 1 })),
    });
    if (!register) {
      await this.call('POST', `/correspondence/${documentId}/send`);
    }
    return documentId;
  }

  /**
   * A record in 'غير مصنّف' (received, not yet registered), as the intake leaves an e-mail. Found on the live portal
   * (2026-11-16): a correspondence sent outside the register's mode - POST /correspondence {inboxMode:false,
   * saveAsDraft:false, draftModule:2, documentDirectionId, documentTypeId} - lands there (with no direction it does not).
   * Returns its document id.
   */
  createUnclassified(options: { subject: string; recipients: { id: number; name: string }[]; typeId?: number; directionId: number; body?: string }): Promise<number> {
    const body = options.body ?? options.subject;
    return this.call<number>('POST', '/correspondence', {
      documentDirectionId: options.directionId,
      ...(options.typeId ? { documentTypeId: options.typeId } : {}),
      documentDate: new Date().toISOString(),
      subject: options.subject,
      body,
      bodyText: body,
      isSecure: false,
      inboxMode: false,
      saveAsDraft: false,
      draftModule: 2,
      initialAttachments: [],
      recipients: options.recipients.map((recipient) => ({ name: recipient.name, addressBookEntryId: recipient.id, mailAddressTypeId: 1 })),
    });
  }

  /** 'تصنيف كغير مرغوب' of a record (seen sent by the list's selection, 2026-11-16): POST /correspondence/{id}/spam. */
  markSpam(documentId: number): Promise<unknown> {
    return this.call('POST', `/correspondence/${documentId}/spam`);
  }

  /** 'حذف' of a record: to 'المحذوفة' (it can still be restored; purgeCorrespondence removes it for good). */
  deleteCorrespondence(documentId: number): Promise<unknown> {
    return this.call('DELETE', `/correspondence/${documentId}`);
  }

  /** A correspondence as the server has it (reference number, direction, type, ...). */
  correspondence(documentId: number): Promise<{ documentId: number; documentNumber?: string; subject: string; documentDirectionName?: string; documentTypeName?: string }> {
    return this.call('GET', `/correspondence/${documentId}?language=ar`);
  }

  /**
   * The ids of the correspondence of a folder whose subject contains the text. Folders: 'Triage', 'Register', 'Inbox',
   * 'Outbox', 'Draft', 'Spam', 'Deleted', 'All', 'MailboxInbox', 'MailboxOutbox', 'MailboxDeleted'. The list's search
   * parameter is `SearchTerm` (as the search box sends it).
   */
  async correspondenceIds(folder: string, keyword: string): Promise<number[]> {
    const page = await this.call<{ data: { documentId: number; subject: string }[] }>(
      'GET',
      `/correspondence?Folder=${folder}&SearchTerm=${encodeURIComponent(keyword)}&Language=ar&PageNumber=1&PageSize=50`,
    );
    return page.data.filter((record) => record.subject.includes(keyword)).map((record) => record.documentId);
  }

  /** The id of an address book entry by its exact name, as the recipient pickers find it (e.g. 'السجل / Registry'). */
  async recipientId(name: string): Promise<number> {
    const page = await this.call<{ data: { addressBookEntryId: number; name: string }[] }>('GET', `/addressbook/recipients?keyword=${encodeURIComponent(name)}&pageNumber=1&pageSize=40`);
    const found = page.data.find((entry) => entry.name === name);
    if (!found) {
      throw new Error(`RECIPIENT_NOT_FOUND: no address book entry named "${name}".`);
    }
    return found.addressBookEntryId;
  }

  /**
   * Purges every correspondence of the case (its subjects carry the run id) that this account can see. Best effort:
   * internal mail between two other users is private to them, so the admin cannot purge it - an address book entry
   * named in it then stays (as auto-test-...).
   */
  async purgeCorrespondenceMatching(keyword: string): Promise<void> {
    // Sending internal mail makes more than one document (seen live 2026-11-16), and some only show once others are
    // gone: search and purge again until nothing is left (a few rounds at most)
    for (let round = 0; round < 4; round += 1) {
      const ids = new Set<number>();
      for (const folder of ['All', 'Register', 'Inbox', 'Outbox', 'Triage', 'Draft', 'Spam', 'Deleted', 'MailboxInbox', 'MailboxOutbox', 'MailboxDeleted']) {
        for (const id of await this.correspondenceIds(folder, keyword).catch(() => [] as number[])) {
          ids.add(id);
        }
      }
      if (ids.size === 0) {
        return;
      }
      for (const id of ids) {
        await this.purgeCorrespondence(id).catch(() => undefined);
      }
    }
  }

  // ----------------------------------------------------- Archive ----------------------------------------------------

  /**
   * An archive template with its index fields, as 'قالب جديد' then 'حفظ القالب' send it (seen live 2026-11-16):
   * POST /templates {name:{ar,en}, fields:[]} -> id, then PUT /templates/{id}/fields {fields:[{archiveTemplateFieldId:0,
   * fieldName:'field_N', fieldLabel:{ar,en}, templateFieldDataTypeId, isRequired, orderLevel, options:[{value,
   * translations:{ar,en}, sortOrder}]}]}. Data types: 1 نص, 2 كود (قائمة), 3 تاريخ, 4 رقم صحيح, 5 رقم عشري - the sheet's
   * 'قائمة' and 'نعم/لا' are lists (2). Returns the template's id.
   */
  async createArchiveTemplate(name: string, fields: readonly { name: string; type: string; mandatory: boolean; options?: readonly string[] }[]): Promise<number> {
    const templateId = await this.call<number>('POST', '/templates', { name: { ar: name, en: name }, fields: [] });
    await this.call('PUT', `/templates/${templateId}/fields`, {
      fields: fields.map((field, index) => ({
        archiveTemplateFieldId: 0,
        fieldName: `field_${index + 1}`,
        fieldLabel: { ar: field.name, en: field.name },
        templateFieldDataTypeId: templateDataType(field.type),
        isRequired: field.mandatory,
        orderLevel: index + 1,
        options: optionsOf(field).map((value, order) => ({ value, translations: { ar: value, en: value }, sortOrder: order + 1 })),
      })),
    });
    return templateId;
  }

  /** Links a folder to a template, as 'نموذج الفهرسة' + 'حفظ' of 'إدارة المجلد' do: PUT /cabinets/{id}. */
  linkCabinetTemplate(cabinetId: number, cabinetName: string, templateId: number): Promise<unknown> {
    return this.call('PUT', `/cabinets/${cabinetId}`, { name: { ar: cabinetName, en: cabinetName }, archiveTemplateId: templateId, isPublicArchive: false });
  }

  /** The id of the archive template with this exact name, or undefined. */
  async archiveTemplateIdNamed(name: string): Promise<number | undefined> {
    const page = await this.call<{ data: { archiveTemplateId: number; name: string }[] }>('GET', '/templates?Language=ar&PageNumber=1&PageSize=200');
    return page.data.find((template) => template.name === name)?.archiveTemplateId;
  }

  /** The archive folder tree (each folder with its id, name, template, documents count and sub-folders). */
  cabinetTree(): Promise<CabinetNode[]> {
    return this.call<CabinetNode[]>('GET', '/cabinets?includeDocumentCounts=true');
  }

  /** Removes every archive template whose name contains the text (a case's own). Best effort. */
  async deleteArchiveTemplatesMatching(text: string): Promise<void> {
    const page = await this.call<{ data: { archiveTemplateId: number; name: string }[] }>('GET', '/templates?Language=ar&PageNumber=1&PageSize=200');
    for (const template of page.data.filter((candidate) => candidate.name.includes(text))) {
      await this.deleteArchiveTemplate(template.archiveTemplateId).catch(() => undefined);
    }
  }

  deleteArchiveTemplate(templateId: number): Promise<unknown> {
    return this.call('DELETE', `/templates/${templateId}`);
  }

  /**
   * An archive folder, as 'مجلد رئيسي جديد' / 'إضافة مجلد فرعي' send it (seen live 2026-11-16): POST /cabinets
   * {name:{ar,en}, parentCabinetId?, isPublicArchive:false}; returns its id. The template key (`archiveTemplateId`, as
   * GET /cabinets answers it) was not seen sent yet.
   */
  async createCabinet(name: string, options: { parentId?: number; templateId?: number } = {}): Promise<number> {
    const cabinetId = await this.call<number>('POST', '/cabinets', {
      name: { ar: name, en: name },
      ...(options.parentId ? { parentCabinetId: options.parentId } : {}),
      isPublicArchive: false,
    });
    if (options.templateId) {
      await this.linkCabinetTemplate(cabinetId, name, options.templateId);
    }
    return cabinetId;
  }

  /**
   * Removes every archive folder whose name contains the text (a case's own, made through the screen), sub-folders
   * first. Best effort: a folder holding documents is not removed.
   */
  async deleteCabinetsMatching(text: string): Promise<void> {
    type Cabinet = { cabinetId: number; name: string; children?: Cabinet[] };
    const found: { id: number; depth: number }[] = [];
    const walk = (cabinets: Cabinet[] | undefined, depth: number): void => {
      for (const cabinet of cabinets ?? []) {
        if (cabinet.name.includes(text)) {
          found.push({ id: cabinet.cabinetId, depth });
        }
        walk(cabinet.children, depth + 1);
      }
    };
    walk(await this.call<Cabinet[]>('GET', '/cabinets?includeDocumentCounts=true'), 0);
    found.sort((a, b) => b.depth - a.depth);
    for (const cabinet of found) {
      await this.deleteCabinet(cabinet.id).catch(() => undefined);
    }
  }

  deleteCabinet(cabinetId: number): Promise<unknown> {
    return this.call('DELETE', `/cabinets/${cabinetId}`);
  }

  /**
   * Removes a recipient of 'ملخص السجل اليومي' by its e-mail (a case's own). Best effort: the settings are read and
   * written back without it (GET / PUT /settings/daily-summary - the PUT is not yet seen sent by the portal).
   */
  /** The last run of 'ملخص السجل اليومي' (GET /settings/daily-summary): the page itself does not show it. */
  async dailySummaryLastRun(): Promise<{ state?: string; at?: string; detail?: string }> {
    const settings = await this.call<{ lastRunState?: string; lastRunAtUtc?: string; lastRunDetail?: string }>('GET', '/settings/daily-summary');
    return { state: settings.lastRunState, at: settings.lastRunAtUtc, detail: settings.lastRunDetail };
  }

  async removeSummaryRecipient(email: string): Promise<void> {
    // The page's own save ('حفظ العناوين', seen in the portal's script 2026-11-17): PUT /settings/daily-summary/recipients
    // {recipients: [address], disabledRecipients: [address]} - the whole list, so the others are sent back as they are
    const settings = await this.call<{ recipients: { emailAddress: string; isEnabled: boolean }[] }>('GET', '/settings/daily-summary');
    const kept = settings.recipients.filter((recipient) => recipient.emailAddress.toLowerCase() !== email.toLowerCase());
    if (kept.length !== settings.recipients.length) {
      await this.call('PUT', '/settings/daily-summary/recipients', {
        recipients: kept.map((recipient) => recipient.emailAddress),
        disabledRecipients: kept.filter((recipient) => !recipient.isEnabled).map((recipient) => recipient.emailAddress),
      });
    }
  }

  // ------------------------------------------------------ Tasks -----------------------------------------------------

  /** Removes the tasks whose name contains the text (the case's own: they carry the run id). Best effort. */
  async deleteTasksMatching(keyword: string): Promise<void> {
    const page = await this.call<{ data: { workTaskId: number; name: string }[] }>('GET', `/tasks?Keyword=${encodeURIComponent(keyword)}&Language=ar&PageNumber=1&PageSize=50`);
    for (const task of page.data.filter((candidate) => candidate.name.includes(keyword))) {
      await this.call('DELETE', `/tasks/${task.workTaskId}`).catch(() => undefined);
    }
  }

  /** Deletes a correspondence and purges it from 'المحذوفة', so nothing of a test is left. */
  async purgeCorrespondence(documentId: number): Promise<void> {
    await this.call('DELETE', `/correspondence/${documentId}`).catch((error: Error) => {
      if (!/already deleted/i.test(error.message)) {
        throw error;
      }
    });
    await this.call('DELETE', `/correspondence/${documentId}/purge`);
  }

  // ----------------------------------------------------- Settings ---------------------------------------------------

  /** The address of the portal's receiving mailbox ('استقبال البريد', the first one switched on). */
  async receivingMailboxAddress(): Promise<string> {
    const mailboxes = await this.call<{ userName: string; isEnabled: boolean; protocol: string }[]>('GET', '/settings/mail-ingestion');
    const receiving = mailboxes.find((mailbox) => mailbox.isEnabled && mailbox.userName.includes('@'));
    if (!receiving) {
      throw new Error('NO_RECEIVING_MAILBOX: no mailbox of \'استقبال البريد\' is switched on.');
    }
    return receiving.userName;
  }

  /**
   * Takes addresses out of 'عناوين السبام' of every mailbox and keeps the rest of each list as it was
   * (PUT /settings/mail-ingestion/{id}/spam-addresses {spamAddresses}, the list's own save). Returns what was removed.
   */
  async removeSpamAddresses(match: (address: string) => boolean): Promise<string[]> {
    const mailboxes = await this.call<{ mailIngestionSettingId: number; spamAddresses?: string[] }[]>('GET', '/settings/mail-ingestion');
    const removed: string[] = [];
    for (const mailbox of mailboxes) {
      const list = mailbox.spamAddresses ?? [];
      const kept = list.filter((address) => !match(address));
      if (kept.length !== list.length) {
        await this.call('PUT', `/settings/mail-ingestion/${mailbox.mailIngestionSettingId}/spam-addresses`, { spamAddresses: kept });
        removed.push(...list.filter(match));
      }
    }
    return removed;
  }

  /** Removes every receiving mailbox whose user starts with the given text (the tests' own: auto-test-...). */
  async deleteMailboxes(userNamePrefix: string): Promise<void> {
    const mailboxes = await this.call<{ mailIngestionSettingId: number; userName: string }[]>('GET', '/settings/mail-ingestion');
    for (const mailbox of mailboxes.filter((candidate) => candidate.userName.startsWith(userNamePrefix))) {
      await this.call('DELETE', `/settings/mail-ingestion/${mailbox.mailIngestionSettingId}`);
    }
  }
}

/** The lookup tables of 'أكواد النظام' by their API name: الأقسام, الأولوية, نوع الجهة, نوع الوثيقة. */
export type LookupTable = 'Department' | 'TaskPriority' | 'AddressBookType' | 'DocumentType';

/** Signs a new user in for the first time through the API, replacing the temporary password (the "اختر كلمة مرور جديدة" form). */
export const completeFirstSignIn = async (userName: string, temporaryPassword: string, newPassword: string): Promise<void> => {
  const context = await newContext();
  try {
    const response = await context.post(`${apiBase()}/auth/password/first-use`, {
      data: { userName, currentPassword: temporaryPassword, newPassword, confirmPassword: newPassword },
    });
    if (!response.ok()) {
      throw new Error(`FIRST_SIGN_IN_FAILED:${userName}: ${response.status()} ${(await response.text()).slice(0, 200)}`);
    }
  } finally {
    await context.dispose();
  }
};

/**
 * The template data type of a sheet type (GET /config/TemplateFieldDataType): 1 نص, 2 كود (قائمة), 3 تاريخ, 4 رقم صحيح,
 * 5 رقم عشري. The sheet's 'قائمة' and 'نعم/لا' are lists; 'رقم' is a whole number.
 */
export const templateDataType = (sheetType: string): number => ({ نص: 1, قائمة: 2, 'نعم/لا': 2, تاريخ: 3, رقم: 4 })[sheetType] ?? 1;

/** The options of a sheet field: its list, or نعم / لا for a yes/no field. */
export const optionsOf = (field: { type: string; options?: readonly string[] }): string[] => (field.type === 'نعم/لا' ? ['نعم', 'لا'] : [...(field.options ?? [])]);

/** A folder of the archive tree, as GET /cabinets answers it. */
export type CabinetNode = { cabinetId: number; name: string; archiveTemplateId?: number | null; documentCount?: number; children?: CabinetNode[] };
