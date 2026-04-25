-- Phosphor cloud projects — single row per project, body is the full
-- phosphor.project.v1 manifest as JSONB. Forward-compat is automatic
-- because the body deserializes through normalizeProject() in the app.

create table if not exists public.projects (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        references auth.users(id) on delete cascade not null,
  name         text        not null,
  body         jsonb       not null,
  is_published boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_owner_idx     on public.projects (owner_id);
create index if not exists projects_published_idx on public.projects (is_published) where is_published;
create index if not exists projects_updated_idx   on public.projects (updated_at desc);

-- Auto-fill owner_id from auth.uid() so the client never has to send it
-- (and cannot spoof it). The trigger runs as security definer so it
-- has access to auth.uid() inside the request context.
create or replace function public.set_project_owner()
returns trigger as $$
begin
  new.owner_id = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_project_owner_trigger on public.projects;
create trigger set_project_owner_trigger
  before insert on public.projects
  for each row execute function public.set_project_owner();

-- Bump updated_at on every update.
create or replace function public.touch_project_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_project_updated_at_trigger on public.projects;
create trigger touch_project_updated_at_trigger
  before update on public.projects
  for each row execute function public.touch_project_updated_at();

-- Row-level security: owners full CRUD on their own; anyone (incl.
-- unauthenticated visitors) can read published rows. RLS does the
-- actual access control — the anon key is intentionally public.
alter table public.projects enable row level security;

drop policy if exists "Owners can manage their projects" on public.projects;
create policy "Owners can manage their projects"
  on public.projects
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Anyone can read published projects" on public.projects;
create policy "Anyone can read published projects"
  on public.projects
  for select
  using (is_published = true);

-- Realtime is optional; turn it on later if we add live multi-device
-- sync. Leaving it off avoids surprise broadcast traffic.
