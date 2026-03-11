-- TaskBrain: 每个用户一行，存任务/档案/状态/主题
create table if not exists public.user_data (
  id uuid primary key references auth.users(id) on delete cascade,
  tasks jsonb not null default '[]',
  profile jsonb not null default '{}',
  status text not null default '',
  dark boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 仅允许用户读写自己的行
alter table public.user_data enable row level security;

create policy "user_data_select" on public.user_data
  for select using (auth.uid() = id);

create policy "user_data_insert" on public.user_data
  for insert with check (auth.uid() = id);

create policy "user_data_update" on public.user_data
  for update using (auth.uid() = id);

-- 新用户首次登录时插入一行（在客户端 upsert 即可，无需 trigger）
