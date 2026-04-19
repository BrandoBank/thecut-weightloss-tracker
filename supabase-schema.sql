-- ============================================================
-- The Cut — Supabase Database Schema
-- ============================================================
-- Run this in the Supabase SQL Editor to set up your project.
-- Every table uses Row Level Security (RLS) so that each user
-- can only ever read or write their own rows — the database
-- enforces this even if app-level code has a bug.
-- ============================================================

-- Enable UUID generation (available by default in Supabase)
create extension if not exists "uuid-ossp";


-- ============================================================
-- FOODS TABLE
-- Stores daily food log entries. Each row belongs to one user
-- and one date. Calories, protein, carbs, and fat are stored
-- as integers (grams / kcal) to avoid float rounding issues.
-- ============================================================
create table if not exists foods (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,          -- 'YYYY-MM-DD' — stored as text for simple client-side keying
  time        text not null,          -- ISO 8601 timestamp string (client local time)
  name        text not null,
  calories    int  not null default 0,
  protein     int  not null default 0,
  carbs       int  not null default 0,
  fat         int  not null default 0,
  category    text not null default 'snack',  -- breakfast | lunch | dinner | snack
  created_at  timestamptz default now()
);

-- RLS: users can only touch their own food rows
alter table foods enable row level security;

create policy "foods: owner read"
  on foods for select
  using (auth.uid() = user_id);

create policy "foods: owner insert"
  on foods for insert
  with check (auth.uid() = user_id);

create policy "foods: owner update"
  on foods for update
  using (auth.uid() = user_id);

create policy "foods: owner delete"
  on foods for delete
  using (auth.uid() = user_id);


-- ============================================================
-- EXERCISE TABLE
-- One row per exercise event per day. calories = kcal burned.
-- The Apple Health iOS Shortcut writes to this table via the
-- app's URL-parameter bridge (see docs/apple-health-integration.md).
-- ============================================================
create table if not exists exercise (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,          -- 'YYYY-MM-DD'
  time        text not null,          -- ISO 8601 timestamp
  name        text not null,
  calories    int  not null default 0,
  duration    int  not null default 0, -- minutes
  created_at  timestamptz default now()
);

alter table exercise enable row level security;

create policy "exercise: owner read"   on exercise for select using (auth.uid() = user_id);
create policy "exercise: owner insert" on exercise for insert with check (auth.uid() = user_id);
create policy "exercise: owner update" on exercise for update using (auth.uid() = user_id);
create policy "exercise: owner delete" on exercise for delete using (auth.uid() = user_id);


-- ============================================================
-- WATER TABLE
-- One row per user per day — upserted (not inserted) by the app.
-- Storing a single daily total keeps queries simple.
-- ============================================================
create table if not exists water (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,          -- 'YYYY-MM-DD'
  amount      int  not null default 0, -- fl oz
  created_at  timestamptz default now(),
  unique (user_id, date)              -- enforces one row per user per day
);

alter table water enable row level security;

create policy "water: owner read"   on water for select using (auth.uid() = user_id);
create policy "water: owner insert" on water for insert with check (auth.uid() = user_id);
create policy "water: owner update" on water for update using (auth.uid() = user_id);
create policy "water: owner delete" on water for delete using (auth.uid() = user_id);


-- ============================================================
-- WEIGHTS TABLE
-- Daily weight entries in lbs. Upserted by date — only one
-- reading per day is kept. Also written by the Apple Health
-- Shortcut via the app's URL-parameter bridge.
-- ============================================================
create table if not exists weights (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,          -- 'YYYY-MM-DD'
  weight      numeric(5,1) not null,  -- lbs, e.g. 185.4
  created_at  timestamptz default now(),
  unique (user_id, date)
);

alter table weights enable row level security;

create policy "weights: owner read"   on weights for select using (auth.uid() = user_id);
create policy "weights: owner insert" on weights for insert with check (auth.uid() = user_id);
create policy "weights: owner update" on weights for update using (auth.uid() = user_id);
create policy "weights: owner delete" on weights for delete using (auth.uid() = user_id);


-- ============================================================
-- RECENTS TABLE
-- Stores recently used foods for quick re-logging. Capped by
-- the app at 20 entries per user (oldest pruned on insert).
-- ============================================================
create table if not exists recents (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  calories    int  not null default 0,
  protein     int  not null default 0,
  carbs       int  not null default 0,
  fat         int  not null default 0,
  used_at     timestamptz default now()
);

alter table recents enable row level security;

create policy "recents: owner read"   on recents for select using (auth.uid() = user_id);
create policy "recents: owner insert" on recents for insert with check (auth.uid() = user_id);
create policy "recents: owner update" on recents for update using (auth.uid() = user_id);
create policy "recents: owner delete" on recents for delete using (auth.uid() = user_id);


-- ============================================================
-- PHOTOS TABLE
-- Stores progress photo metadata. The actual image data is
-- stored as a base64 string in the data column — fine for
-- personal use; switch to Supabase Storage for scale.
-- ============================================================
create table if not exists photos (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  data        text not null,          -- base64-encoded image
  created_at  timestamptz default now()
);

alter table photos enable row level security;

create policy "photos: owner read"   on photos for select using (auth.uid() = user_id);
create policy "photos: owner insert" on photos for insert with check (auth.uid() = user_id);
create policy "photos: owner delete" on photos for delete using (auth.uid() = user_id);


-- ============================================================
-- PLATEAU_NOTES TABLE
-- Free-text notes attached to dates when the user flags a
-- weight plateau. Used by the AI coach context.
-- ============================================================
create table if not exists plateau_notes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  note        text not null,
  created_at  timestamptz default now()
);

alter table plateau_notes enable row level security;

create policy "plateau_notes: owner read"   on plateau_notes for select using (auth.uid() = user_id);
create policy "plateau_notes: owner insert" on plateau_notes for insert with check (auth.uid() = user_id);
create policy "plateau_notes: owner update" on plateau_notes for update using (auth.uid() = user_id);
create policy "plateau_notes: owner delete" on plateau_notes for delete using (auth.uid() = user_id);


-- ============================================================
-- COMMITMENTS TABLE
-- Stores daily habit commitments (key-value by date).
-- ============================================================
create table if not exists commitments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz default now(),
  unique (user_id, date)
);

alter table commitments enable row level security;

create policy "commitments: owner read"   on commitments for select using (auth.uid() = user_id);
create policy "commitments: owner insert" on commitments for insert with check (auth.uid() = user_id);
create policy "commitments: owner update" on commitments for update using (auth.uid() = user_id);
create policy "commitments: owner delete" on commitments for delete using (auth.uid() = user_id);


-- ============================================================
-- INDEXES
-- Speed up the most common query pattern: fetching all rows
-- for a given user on a given date.
-- ============================================================
create index if not exists foods_user_date      on foods      (user_id, date);
create index if not exists exercise_user_date   on exercise   (user_id, date);
create index if not exists water_user_date      on water      (user_id, date);
create index if not exists weights_user_date    on weights    (user_id, date);
create index if not exists recents_user_used_at on recents    (user_id, used_at desc);
create index if not exists photos_user_date     on photos     (user_id, date);
create index if not exists plateau_user_date    on plateau_notes (user_id, date);
create index if not exists commitments_user_date on commitments (user_id, date);
