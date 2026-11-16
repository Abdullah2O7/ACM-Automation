import { mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { completeFirstSignIn, type AcmApi, type CabinetNode } from '../api/acm-api';
import { autoEmail, autoName, autoPassword, autoUserName } from '../domain/acm-names';
import { archive, club, keptArchive, roles, type ClubEntity } from '../../test-data/acm/acm.data';

/** A person of the sheet's club, as made for one case (names `auto-test-<runId>-...`). */
export type ClubPerson = {
  /** The sheet's name, e.g. 'كريم حسن'. */
  sheetName: string;
  /** The name on the portal, e.g. 'auto-test-<runId>-كريم حسن'. */
  name: string;
  email: string;
  userName: string;
  personId: number;
  entity: ClubEntity;
  entityName: string;
  /** Set when the club was made `withUsers`: the user's own password (the first sign-in is done). */
  password?: string;
  appUserId?: number;
};

export type Club = {
  entityIds: Record<ClubEntity, number>;
  entityNames: Record<ClubEntity, string>;
  persons: ClubPerson[];
  /** A person by the sheet's name, e.g. person('كريم حسن'). */
  person: (sheetName: string) => ClubPerson;
};

type Cleanup = (step: () => Promise<unknown>) => void;

/**
 * The sheet's club, made through the API for one case: 'النادي الأهلي', its 3 sub-entities and the 5 persons - and with
 * `withUsers`, a user ('مشغل', OTP off, first sign-in done) for each person. Everything is removed after the case:
 * users first, then persons, then entities (the clean-up runs last registered first).
 */
export const createClub = async (adminApi: AcmApi, runId: string, cleanup: Cleanup, { withUsers = false } = {}): Promise<Club> => {
  const entityNames: Record<ClubEntity, string> = {
    main: autoName(runId, club.main),
    football: autoName(runId, club.subEntities.football),
    members: autoName(runId, club.subEntities.members),
    finance: autoName(runId, club.subEntities.finance),
  };
  const entityIds = {} as Record<ClubEntity, number>;
  entityIds.main = await adminApi.createEntity(entityNames.main, { type: 1 });
  cleanup(() => adminApi.deleteAddressBookEntry(entityIds.main));
  for (const sub of ['football', 'members', 'finance'] as const) {
    entityIds[sub] = await adminApi.createEntity(entityNames[sub], { type: 1, parentId: entityIds.main });
    cleanup(() => adminApi.deleteAddressBookEntry(entityIds[sub]));
  }
  const operatorTemplate = withUsers ? await adminApi.roleTemplateId(roles.operator.code) : undefined;
  const persons: ClubPerson[] = [];
  for (const person of club.persons) {
    const name = autoName(runId, person.name);
    const email = autoEmail(runId, person.key);
    const personId = await adminApi.createPerson(name, entityIds[person.entity], email);
    cleanup(() => adminApi.deleteAddressBookEntry(personId));
    const member: ClubPerson = {
      sheetName: person.name,
      name,
      email,
      userName: autoUserName(runId, person.key),
      personId,
      entity: person.entity,
      entityName: entityNames[person.entity],
    };
    if (withUsers) {
      const user = await adminApi.createUser(personId, member.userName, name, email, operatorTemplate);
      cleanup(() => adminApi.deleteUser(user.appUserId));
      member.appUserId = user.appUserId;
      member.password = autoPassword(runId);
      await completeFirstSignIn(member.userName, user.temporaryPassword, member.password);
    }
    persons.push(member);
  }
  const person = (sheetName: string): ClubPerson => {
    const found = persons.find((candidate) => candidate.sheetName === sheetName);
    if (!found) {
      throw new Error(`CLUB_PERSON_NOT_FOUND: '${sheetName}' is not one of the sheet's 5 persons.`);
    }
    return found;
  };
  return { entityIds, entityNames, persons, person };
};

/** The credentials of a club person made `withUsers`. */
export const credentialsOfPerson = (person: ClubPerson): { username: string; password: string } => {
  if (!person.password) {
    throw new Error(`CLUB_PERSON_HAS_NO_USER: '${person.sheetName}' was made without a user - call createClub with { withUsers: true }.`);
  }
  return { username: person.userName, password: person.password };
};

/** The sheet's archive for one case: the main folder, its 3 sub-folders and the template they use. */
export type ArchiveSetup = {
  templateName: string;
  mainFolder: string;
  subFolders: Record<keyof typeof archive.subFolders, string>;
  cabinetIds: Record<'main' | keyof typeof archive.subFolders, number>;
};

const KEPT_ARCHIVE_LOCK = path.resolve('runtime', 'acm-kept-archive.lock');

/**
 * Runs `make` alone across the workers of this machine (a lock folder in runtime/): two cases starting together on the
 * first run must not both make the kept archive. A lock older than two minutes is left by a stopped run and is taken over.
 */
const alone = async <T>(make: () => Promise<T>): Promise<T> => {
  mkdirSync(path.dirname(KEPT_ARCHIVE_LOCK), { recursive: true });
  for (let waited = 0; ; waited += 500) {
    try {
      mkdirSync(KEPT_ARCHIVE_LOCK);
      break;
    } catch {
      const age = Date.now() - (statSync(KEPT_ARCHIVE_LOCK, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > 120_000 || waited > 120_000) {
        rmSync(KEPT_ARCHIVE_LOCK, { recursive: true, force: true });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  try {
    return await make();
  } finally {
    rmSync(KEPT_ARCHIVE_LOCK, { recursive: true, force: true });
  }
};

/**
 * The archive ACM-08 archives into: 'auto-test-kept-أرشيف النادي الأهلي 2026' with its 3 sub-folders using
 * 'auto-test-kept-قالب أرشفة مراسلات النادي الأهلي' (the sheet's 10 index fields). Kept on the portal between runs
 * (test-data keptArchive): found by name and made only when missing, never removed - the server keeps any folder that
 * has held an archived document, so a set made per run would stay behind every time.
 */
export const useKeptArchive = (adminApi: AcmApi): Promise<ArchiveSetup> =>
  alone(async () => {
    const templateName = keptArchive.template;
    const templateId = (await adminApi.archiveTemplateIdNamed(templateName)) ?? (await adminApi.createArchiveTemplate(templateName, archive.fields));
    const tree = await adminApi.cabinetTree();
    const findIn = (nodes: CabinetNode[] | undefined, name: string): CabinetNode | undefined => nodes?.find((node) => node.name === name);
    const main = findIn(tree, keptArchive.mainFolder);
    const cabinetIds = {} as ArchiveSetup['cabinetIds'];
    cabinetIds.main = main?.cabinetId ?? (await adminApi.createCabinet(keptArchive.mainFolder, { templateId }));
    for (const key of ['football', 'members', 'finance'] as const) {
      const existing = findIn(main?.children, keptArchive.subFolders[key]);
      if (existing) {
        cabinetIds[key] = existing.cabinetId;
        // A kept folder always uses the kept template (put back if someone changed it)
        if (existing.archiveTemplateId !== templateId) {
          await adminApi.linkCabinetTemplate(existing.cabinetId, existing.name, templateId);
        }
      } else {
        cabinetIds[key] = await adminApi.createCabinet(keptArchive.subFolders[key], { parentId: cabinetIds.main, templateId });
      }
    }
    return { templateName, mainFolder: keptArchive.mainFolder, subFolders: { ...keptArchive.subFolders }, cabinetIds };
  });

/** The external entity of the sheet, 'الاتحاد المصري لكرة القدم', for one case (with an e-mail unless `email: null`). */
export const createFootballAssociation = async (
  adminApi: AcmApi,
  runId: string,
  cleanup: Cleanup,
  { email = autoEmail(runId, 'efa') }: { email?: string | null } = {},
): Promise<{ id: number; name: string; email?: string }> => {
  const name = autoName(runId, club.externalEntity);
  const id = await adminApi.createEntity(name, { type: 2, ...(email ? { email } : {}) });
  cleanup(() => adminApi.deleteAddressBookEntry(id));
  return { id, name, ...(email ? { email } : {}) };
};
