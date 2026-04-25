import { normalizeProject, type Project, type ProjectId } from './projectSchema';
import { supabase } from './supabaseClient';

/**
 * Cloud project storage. Each project lives in a single row whose `body`
 * column is the entire phosphor.project.v1 manifest as JSONB. Forward-
 * compat is automatic — older rows just deserialize through
 * normalizeProject like everything else.
 *
 * RLS policies (see supabase/migrations/0001_projects.sql):
 * - Owners have full CRUD on their own projects.
 * - Anyone (incl. anonymous visitors) can read rows where is_published.
 *
 * Every helper returns `{ ok: false, error }` instead of throwing so the
 * UI can render error states without try/catch boilerplate.
 */

export type CloudProjectRow = {
  id: ProjectId;
  owner_id: string;
  name: string;
  body: Project;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type CloudResult<T> = { ok: true; value: T } | { ok: false; error: string };

function notConfigured<T>(): CloudResult<T> {
  return { ok: false, error: 'Cloud is not configured. Sign in to enable.' };
}

export async function listMyCloudProjects(): Promise<CloudResult<CloudProjectRow[]>> {
  if (!supabase) return notConfigured();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []) as CloudProjectRow[] };
}

export async function listPublishedProjects(): Promise<CloudResult<CloudProjectRow[]>> {
  if (!supabase) return notConfigured();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(120);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []) as CloudProjectRow[] };
}

export async function pushProjectToCloud(project: Project): Promise<CloudResult<CloudProjectRow>> {
  if (!supabase) return notConfigured();
  // Upsert by id so a "save again" overwrites instead of creating duplicates.
  const row = {
    id: project.id,
    name: project.name,
    body: project,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('projects').upsert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: data as CloudProjectRow };
}

export async function pullProjectFromCloud(id: ProjectId): Promise<CloudResult<Project>> {
  if (!supabase) return notConfigured();
  const { data, error } = await supabase.from('projects').select('body').eq('id', id).single();
  if (error) return { ok: false, error: error.message };
  const project = normalizeProject(data?.body);
  if (!project) return { ok: false, error: 'Cloud project failed schema validation.' };
  return { ok: true, value: project };
}

export async function setProjectPublished(id: ProjectId, isPublished: boolean): Promise<CloudResult<void>> {
  if (!supabase) return notConfigured();
  const { error } = await supabase
    .from('projects')
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: undefined };
}

export async function deleteCloudProject(id: ProjectId): Promise<CloudResult<void>> {
  if (!supabase) return notConfigured();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: undefined };
}
