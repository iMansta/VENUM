-- =============================================================
--  Mansta Tecnologia — Build Catalog Schema
--  Idempotent: safe to run multiple times.
--  Run in Supabase SQL Editor.
-- =============================================================

-- ============== 1. TABLES ==============

create table if not exists public.build_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.builds (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.build_categories(id) on delete cascade,
  title         text not null,
  items_json    jsonb not null default '[]'::jsonb,
  tactics       text,
  author        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists builds_category_id_idx on public.builds(category_id);
create index if not exists builds_updated_at_idx on public.builds(updated_at desc);

-- ============== 2. updated_at TRIGGER ==============

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_builds_set_updated_at on public.builds;
create trigger trg_builds_set_updated_at
  before update on public.builds
  for each row execute function public.set_updated_at();

-- ============== 3. RLS ==============

alter table public.build_categories enable row level security;
alter table public.builds         enable row level security;

-- All authenticated users can read.
drop policy if exists "build_categories_read_all" on public.build_categories;
create policy "build_categories_read_all"
  on public.build_categories
  for select to authenticated using (true);

drop policy if exists "builds_read_all" on public.builds;
create policy "builds_read_all"
  on public.builds
  for select to authenticated using (true);

-- Only admins can write. We read the role from profiles.
-- (The existing project already has a profiles table with a `role` column.
--  If your schema is different, swap the subquery accordingly.)
drop policy if exists "build_categories_admin_write" on public.build_categories;
create policy "build_categories_admin_write"
  on public.build_categories
  for all to authenticated
  using      ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "builds_admin_write" on public.builds;
create policy "builds_admin_write"
  on public.builds
  for all to authenticated
  using      ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ============== 4. RPCs ==============

-- List categories with their build counts.
create or replace function public.get_build_categories()
returns table (
  id          uuid,
  name        text,
  description text,
  created_at  timestamptz,
  build_count bigint
)
language sql security invoker stable as $$
  select
    c.id,
    c.name,
    c.description,
    c.created_at,
    (select count(*) from public.builds b where b.category_id = c.id) as build_count
  from public.build_categories c
  order by c.name asc;
$$;

-- List builds for a category.
create or replace function public.get_builds_by_category(cat_id uuid)
returns table (
  id          uuid,
  category_id uuid,
  title       text,
  items_json  jsonb,
  tactics     text,
  author      text,
  created_at  timestamptz,
  updated_at  timestamptz
)
language sql security invoker stable as $$
  select b.id, b.category_id, b.title, b.items_json, b.tactics, b.author, b.created_at, b.updated_at
  from public.builds b
  where b.category_id = cat_id
  order by b.title asc;
$$;

-- Admin: create / find a category by name (avoids duplicates).
create or replace function public.upsert_build_category(p_name text, p_description text)
returns uuid
language plpgsql security invoker as $$
declare
  v_id uuid;
begin
  select id into v_id from public.build_categories where name = p_name;
  if v_id is not null then
    if p_description is not null then
      update public.build_categories set description = p_description where id = v_id;
    end if;
    return v_id;
  end if;
  insert into public.build_categories (name, description) values (p_name, p_description) returning id into v_id;
  return v_id;
end;
$$;

-- Admin: create a build.
create or replace function public.create_build(
  p_category_id uuid,
  p_title       text,
  p_items_json  jsonb,
  p_tactics     text,
  p_author      text
)
returns uuid
language plpgsql security invoker as $$
declare v_id uuid;
begin
  insert into public.builds (category_id, title, items_json, tactics, author)
  values (p_category_id, p_title, coalesce(p_items_json, '[]'::jsonb), p_tactics, p_author)
  returning id into v_id;
  return v_id;
end;
$$;

-- Admin: update a build.
create or replace function public.update_build(
  p_id         uuid,
  p_title      text,
  p_items_json jsonb,
  p_tactics    text,
  p_author     text
)
returns void
language plpgsql security invoker as $$
begin
  update public.builds
     set title      = coalesce(p_title,      title),
         items_json = coalesce(p_items_json, items_json),
         tactics    = coalesce(p_tactics,    tactics),
         author     = coalesce(p_author,     author)
   where id = p_id;
end;
$$;

-- Admin: delete a build.
create or replace function public.delete_build(p_id uuid)
returns void
language sql security invoker as $$
  delete from public.builds where id = p_id;
$$;

-- ============== 5. GRANTS ==============

grant execute on function public.get_build_categories()             to authenticated;
grant execute on function public.get_builds_by_category(uuid)        to authenticated;
grant execute on function public.upsert_build_category(text, text)  to authenticated;
grant execute on function public.create_build(uuid, text, jsonb, text, text) to authenticated;
grant execute on function public.update_build(uuid, text, jsonb, text, text) to authenticated;
grant execute on function public.delete_build(uuid)                  to authenticated;