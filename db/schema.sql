-- Projects Manager base schema (PostgreSQL)
-- owner-only model with row level security

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  repo_url text,
  vercel_url text,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  priority smallint not null default 2 check (priority between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  task_key text not null,
  task_prefix text not null check (task_prefix ~ '^[A-Z][A-Z0-9]{0,9}$'),
  task_number integer not null check (task_number > 0),
  title text not null,
  note text,
  status text not null default 'todo' check (status in ('todo', 'done', 'archived')),
  due_at timestamptz,
  priority smallint not null default 3 check (priority between 1 and 5),
  check (task_key = task_prefix || '-' || task_number::text),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists work_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  detail text,
  engine text,
  worked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete set null,
  actor_email text,
  event_type text not null,
  outcome text not null check (outcome in ('allowed', 'blocked', 'error')),
  ip_address text,
  user_agent text,
  path text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_owner_id on projects(owner_id);
create index if not exists idx_api_tokens_owner_id_revoked_at on api_tokens(owner_id, revoked_at);
create index if not exists idx_tasks_owner_id on tasks(owner_id);
create unique index if not exists idx_tasks_owner_task_key on tasks(owner_id, task_key);
create unique index if not exists idx_tasks_owner_task_seq on tasks(owner_id, task_prefix, task_number);
create index if not exists idx_tasks_project_id on tasks(project_id);
create index if not exists idx_tasks_status_due_at on tasks(status, due_at);
create index if not exists idx_work_logs_owner_id on work_logs(owner_id);
create index if not exists idx_work_logs_project_id on work_logs(project_id);
create index if not exists idx_audit_logs_owner_id_created_at on audit_logs(owner_id, created_at desc);
create index if not exists idx_security_events_owner_id_created_at on security_events(owner_id, created_at desc);
create index if not exists idx_security_events_actor_email_created_at on security_events(actor_email, created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
for each row execute procedure set_updated_at();

drop trigger if exists trg_api_tokens_updated_at on api_tokens;
create trigger trg_api_tokens_updated_at before update on api_tokens
for each row execute procedure set_updated_at();

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at before update on projects
for each row execute procedure set_updated_at();

drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at before update on tasks
for each row execute procedure set_updated_at();

-- RLS: access control via app.user_id session setting
alter table users enable row level security;
alter table api_tokens enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table work_logs enable row level security;
alter table audit_logs enable row level security;
alter table security_events enable row level security;

-- users: only the user's own row can be read/updated
create policy users_select_own on users
for select using (id::text = current_setting('app.user_id', true));

create policy users_update_own on users
for update using (id::text = current_setting('app.user_id', true));

-- only owner row insertion is allowed (for initial owner bootstrap)
create policy users_insert_owner_only on users
for insert with check (is_owner = true);

create policy api_tokens_owner_policy on api_tokens
for all
using (owner_id::text = current_setting('app.user_id', true))
with check (owner_id::text = current_setting('app.user_id', true));

-- allow access only to rows where owner_id matches
create policy projects_owner_policy on projects
for all
using (owner_id::text = current_setting('app.user_id', true))
with check (owner_id::text = current_setting('app.user_id', true));

create policy tasks_owner_policy on tasks
for all
using (owner_id::text = current_setting('app.user_id', true))
with check (owner_id::text = current_setting('app.user_id', true));

create policy work_logs_owner_policy on work_logs
for all
using (owner_id::text = current_setting('app.user_id', true))
with check (owner_id::text = current_setting('app.user_id', true));

create policy audit_logs_owner_policy on audit_logs
for all
using (owner_id::text = current_setting('app.user_id', true))
with check (owner_id::text = current_setting('app.user_id', true));

create policy security_events_owner_policy on security_events
for all
using (
  owner_id::text = current_setting('app.user_id', true)
  or exists (
    select 1
    from users u
    where u.id::text = current_setting('app.user_id', true)
      and u.is_owner = true
  )
)
with check (
  owner_id::text = current_setting('app.user_id', true)
  or (
    owner_id is null
    and exists (
      select 1
      from users u
      where u.id::text = current_setting('app.user_id', true)
        and u.is_owner = true
    )
  )
);

-- enforce single owner (only one row may have is_owner=true)
create unique index if not exists uq_single_owner on users((is_owner)) where is_owner;

-- bootstrap example
-- insert into users (email, name, is_owner)
-- values ('your-email@example.com', 'Owner', true)
-- on conflict (email) do update set is_owner = excluded.is_owner;
