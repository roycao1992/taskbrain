-- TaskBrain: 随笔列表，与 tasks 同级存储
alter table if exists public.user_data
  add column if not exists notes jsonb not null default '[]';
