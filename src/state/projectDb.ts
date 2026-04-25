import { normalizeProject, type Project, type ProjectId } from './projectSchema';

const DB_NAME = 'phosphor';
const DB_VERSION = 2;
const PROJECT_STORE = 'projects';
const LEGACY_SCENE_STORE = 'scenes';

export type LegacySceneRecord = {
  id: string;
  name: string;
  dsl: string;
  createdAt: number;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && typeof window !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (!isAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      // Keep the legacy `scenes` store around for migration; we read from
      // it on first run and never write to it again. It can be removed in
      // a future schema bump after a grace period.
      if (!db.objectStoreNames.contains(LEGACY_SCENE_STORE)) {
        db.createObjectStore(LEGACY_SCENE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // If another tab requests an upgrade, drop our cached promise.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      // Another connection is open with an older version — let the user
      // know we cannot upgrade until they close other tabs.
      // eslint-disable-next-line no-console
      console.warn('Phosphor IndexedDB upgrade blocked by another tab.');
    };
  });
  return dbPromise;
}

export async function listProjects(): Promise<Project[]> {
  if (!isAvailable()) return [];
  const db = await openDb();
  const records = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    const request = tx.objectStore(PROJECT_STORE).getAll();
    request.onsuccess = () => resolve((request.result as unknown[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  return records
    .map((record) => normalizeProject(record))
    .filter((project): project is Project => project !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getProject(id: ProjectId): Promise<Project | null> {
  if (!isAvailable()) return null;
  const db = await openDb();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    const request = tx.objectStore(PROJECT_STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return raw ? normalizeProject(raw) : null;
}

export async function saveProject(project: Project): Promise<void> {
  if (!isAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    tx.objectStore(PROJECT_STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProject(id: ProjectId): Promise<void> {
  if (!isAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    tx.objectStore(PROJECT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Read every record from the legacy single-scene store. Used once during
 * migration so we don't lose history that was silently written there.
 */
export async function readLegacyScenes(): Promise<LegacySceneRecord[]> {
  if (!isAvailable()) return [];
  try {
    const db = await openDb();
    if (!db.objectStoreNames.contains(LEGACY_SCENE_STORE)) return [];
    const records = await new Promise<LegacySceneRecord[]>((resolve, reject) => {
      const tx = db.transaction(LEGACY_SCENE_STORE, 'readonly');
      const request = tx.objectStore(LEGACY_SCENE_STORE).getAll();
      request.onsuccess = () => resolve((request.result as LegacySceneRecord[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    return records;
  } catch {
    return [];
  }
}
