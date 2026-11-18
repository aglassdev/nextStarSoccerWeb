// Admin: turn autopay on or off for a whole family at once.
//
// Autopay is the `autoPay` field on each profile ("true" on, "" off), which the
// monthly autopay run reads. A family is found from any member: its parents
// (and co-parents who share a child), their proxy children (parentUserId),
// real players linked to them (linkedParentId), and anyone joined to them in
// family_relationships. Every member gets the same setting.
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../appwrite';

export type MemberKind = 'parent' | 'youth' | 'collegiate' | 'professional' | 'proxy';
const PLAYER_KINDS = ['youth', 'collegiate', 'professional'] as const;

const FAMILY = collections.familyRelationships001;
const collectionOf = (kind: MemberKind): string =>
  ({
    parent: collections.parentUsers,
    youth: collections.youthPlayers,
    collegiate: collections.collegiatePlayers,
    professional: collections.professionalPlayers,
    proxy: collections.proxyChildren,
  })[kind];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;
const linkIsLive = (r: Doc) => !r.status || r.status === 'active' || r.status === 'accepted';

const listBy = (collectionId: string, field: string, value: string): Promise<Doc[]> =>
  databases
    .listDocuments(databaseId, collectionId, [Query.equal(field, value), Query.limit(100)])
    .then((r) => r.documents as Doc[])
    .catch(() => []);

const getDoc = (collectionId: string, id: string): Promise<Doc | null> =>
  databases.getDocument(databaseId, collectionId, id).then((d) => d as Doc).catch(() => null);

/** Everyone in the family of `start`, including `start`. */
export async function findFamily(start: { kind: MemberKind; id: string }) {
  const members = new Map<string, { kind: MemberKind; id: string }>();
  const parentQueue: string[] = [];
  const seenChildren = new Set<string>(); // children whose co-parents were looked up
  const has =(kind: MemberKind, id: string) => members.has(`${kind}:${id}`);
  const add = (kind: MemberKind, id: string) => {
    if (id && !has(kind, id)) members.set(`${kind}:${id}`, { kind, id });
  };
  // Old links can point at profiles that no longer exist: only add real ones.
  const addParent = async (id?: string) => {
    if (!id || has('parent', id) || !(await getDoc(collectionOf('parent'), id))) return;
    add('parent', id);
    parentQueue.push(id);
  };
  // Other parents of a child (co-parents).
  const addParentsOfChild = async (field: 'childUserId' | 'childProxyId', childId: string) => {
    for (const r of await listBy(FAMILY, field, childId)) if (linkIsLive(r)) await addParent(r.parentUserId);
  };
  const playerKindOf = async (userId: string) => {
    for (const k of PLAYER_KINDS) if (await getDoc(collectionOf(k), userId)) return k;
    return null;
  };

  if (start.kind === 'parent') {
    await addParent(start.id);
  } else if (start.kind === 'proxy') {
    add('proxy', start.id);
    await addParent((await getDoc(collectionOf('proxy'), start.id))?.parentUserId);
    await addParentsOfChild('childProxyId', start.id);
  } else {
    add(start.kind, start.id);
    await addParent((await getDoc(collectionOf(start.kind), start.id))?.linkedParentId);
    await addParentsOfChild('childUserId', start.id);
  }

  while (parentQueue.length && members.size < 60) {
    const parentId = parentQueue.shift()!;
    const [proxies, links, ...players] = await Promise.all([
      listBy(collectionOf('proxy'), 'parentUserId', parentId),
      listBy(FAMILY, 'parentUserId', parentId),
      ...PLAYER_KINDS.map((k) => listBy(collectionOf(k), 'linkedParentId', parentId)),
    ]);
    for (const p of proxies) {
      if (has('proxy', p.$id)) continue;
      add('proxy', p.$id);
      await addParentsOfChild('childProxyId', p.$id);
    }
    for (const [i, k] of PLAYER_KINDS.entries()) {
      for (const d of players[i]) {
        if (has(k, d.$id)) continue;
        add(k, d.$id);
        await addParentsOfChild('childUserId', d.$id);
      }
    }
    for (const r of links) {
      if (!linkIsLive(r)) continue;
      // A link whose child profile is gone still joins its co-parents; only
      // children that exist are updated.
      const childField = r.childProxyId ? 'childProxyId' : r.childUserId ? 'childUserId' : null;
      const childId: string = r.childProxyId || r.childUserId;
      if (!childField || seenChildren.has(childId)) continue;
      seenChildren.add(childId);
      if (childField === 'childProxyId') {
        if (await getDoc(collectionOf('proxy'), childId)) add('proxy', childId);
      } else {
        const k = await playerKindOf(childId);
        if (k) add(k, childId);
      }
      await addParentsOfChild(childField, childId);
    }
  }
  return [...members.values()];
}

/** Set autopay for `start` and everyone in their family. */
export async function setFamilyAutopay(start: { kind: MemberKind; id: string }, on: boolean) {
  const family = await findFamily(start);
  const results = await Promise.allSettled(
    family.map((m) => databases.updateDocument(databaseId, collectionOf(m.kind), m.id, { autoPay: on ? 'true' : '' })),
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  // The profile being viewed must have saved, or the change didn't happen.
  const startIndex = family.findIndex((m) => m.kind === start.kind && m.id === start.id);
  if (startIndex >= 0 && results[startIndex].status === 'rejected') {
    throw (results[startIndex] as PromiseRejectedResult).reason;
  }
  return { members: family.length, updated: family.length - failed, failed };
}
