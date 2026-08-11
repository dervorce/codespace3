-- Run this once against your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
-- (Or via the Supabase CLI: supabase db execute -f supabase/schema.sql)

create extension if not exists pgcrypto; -- for gen_random_uuid()

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check (username ~ '^[a-z0-9-]+$'),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists repositories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[a-zA-Z0-9._-]+$'),
  owner_id uuid not null references users(id) on delete cascade,
  owner_username text not null,
  description text not null default '',
  is_private boolean not null default false,
  access_password_hash text,
  default_branch text not null default 'main',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_username, name)
);

create index if not exists idx_repositories_owner_username on repositories (owner_username);

create table if not exists repository_members (
  repository_id uuid not null references repositories(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (repository_id, user_id)
);

create index if not exists idx_repository_members_user_id on repository_members (user_id);

create table if not exists repository_uploads (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references repositories(id) on delete cascade,
  uploader_id uuid not null references users(id) on delete cascade,
  relative_path text not null,
  language text not null default 'Text',
  size bigint not null,
  notes text not null default '',
  commit_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_repository_uploads_repository_created on repository_uploads (repository_id, created_at desc);

-- Keep updated_at current on every row update.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

drop trigger if exists trg_repositories_updated_at on repositories;
create trigger trg_repositories_updated_at
  before update on repositories
  for each row execute function set_updated_at();

-- This Express server is the only thing talking to these tables, using the
-- Supabase service role key, which bypasses Row Level Security entirely.
-- RLS is enabled here anyway as a safety net in case the anon/publishable
-- key ever gets used against this project by mistake — with no policies
-- defined, that key can't read or write anything.
alter table users enable row level security;
alter table repositories enable row level security;
alter table repository_members enable row level security;
alter table repository_uploads enable row level security;
