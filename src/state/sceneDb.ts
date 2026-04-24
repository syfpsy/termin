export type SceneRecord = {
  id: string;
  name: string;
  dsl: string;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'phosphor';
const DB_VERSION = 1;
const STORE = 'scenes';

export async function saveSceneRecord(name: string, dsl: string) {
  if (!('indexedDB' in window)) return;
  const db = await openDb();
  const id = stableSceneId(name, dsl);
  const existing = await getSceneRecord(id, db);
  const now = Date.now();
  const record: SceneRecord = {
    id,
    name: name || 'untitled_scene',
    dsl,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await putRecord(db, record);
  db.close();
}

export async function listSceneRecords(limit = 24): Promise<SceneRecord[]> {
  if (!('indexedDB' in window)) return [];
  const db = await openDb();
  const records = await new Promise<SceneRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as SceneRecord[]).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return records;
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getSceneRecord(id: string, db: IDBDatabase) {
  return new Promise<SceneRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as SceneRecord | undefined);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(db: IDBDatabase, record: SceneRecord) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function stableSceneId(name: string, dsl: string) {
  const stableName = (name || 'untitled_scene').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  if (stableName !== 'untitled_scene') return stableName;
  let hash = 0;
  for (let index = 0; index < dsl.length; index += 1) hash = (hash * 31 + dsl.charCodeAt(index)) >>> 0;
  return `${stableName}-${hash.toString(16)}`;
}
