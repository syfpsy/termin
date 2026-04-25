import {
  normalizeProject,
  PROJECT_SCHEMA_ID,
  PROJECT_SCHEMA_VERSION,
  type Project,
} from '../state/projectSchema';
import { buildStoreZip, readStoreZip } from './zipStore';

export const PROJECT_FILE_EXTENSION = '.phosphor.proj';
export const PROJECT_FILE_MIME = 'application/vnd.phosphor.project+zip';
const MANIFEST_NAME = 'project.json';
const README_NAME = 'README.txt';

const README_BODY = [
  'PHOSPHOR PROJECT BUNDLE',
  '',
  'This file is a STORE-only ZIP archive containing a single phosphor.project.v1',
  'JSON manifest under project.json. Drag the file back into Phosphor Studio',
  '(or call Open Project) to restore every scene, asset, and render preset.',
  '',
  'Schema docs: https://github.com/syfpsy/termin',
  '',
].join('\n');

export type ProjectFileWriteResult = {
  bytes: Uint8Array;
  filename: string;
  mime: string;
};

/**
 * Pack a Project into a `.phosphor.proj` ZIP. Reuses the in-tree STORE
 * writer so we keep zero runtime dependencies. Embeds a small README so
 * a curious user who unzips the file lands somewhere helpful.
 */
export function writeProjectFile(project: Project): ProjectFileWriteResult {
  const manifest = JSON.stringify(project, null, 2);
  const encoder = new TextEncoder();
  const bytes = buildStoreZip([
    { name: MANIFEST_NAME, data: encoder.encode(manifest) },
    { name: README_NAME, data: encoder.encode(README_BODY) },
  ]);
  const safeName = sanitizeFileName(project.name) || 'phosphor_project';
  return {
    bytes,
    filename: `${safeName}${PROJECT_FILE_EXTENSION}`,
    mime: PROJECT_FILE_MIME,
  };
}

export type ProjectFileReadResult =
  | { ok: true; project: Project }
  | { ok: false; error: string };

/**
 * Open a `.phosphor.proj` byte stream and return the contained project.
 * Validates the schema id + version through `normalizeProject`. Failure
 * cases (corrupt zip, missing manifest, wrong schema id, malformed JSON)
 * each return a tagged `{ ok: false }` so callers can render errors.
 */
export function readProjectFile(bytes: Uint8Array): ProjectFileReadResult {
  let entries;
  try {
    entries = readStoreZip(bytes);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to read ZIP' };
  }
  const manifestEntry = entries.find((entry) => entry.name === MANIFEST_NAME);
  if (!manifestEntry) {
    return { ok: false, error: `Missing ${MANIFEST_NAME} inside the project file` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifestEntry.data));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON' };
  }
  const project = normalizeProject(parsed);
  if (!project) {
    return {
      ok: false,
      error: `Schema mismatch — expected ${PROJECT_SCHEMA_ID} v${PROJECT_SCHEMA_VERSION}`,
    };
  }
  return { ok: true, project };
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
