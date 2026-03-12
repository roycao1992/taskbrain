-- 允许 Realtime 订阅 user_data 表变更（A 端修改后 B 端自动更新）
-- 在 Supabase Dashboard → SQL Editor 执行；若报错 publication 不存在，可先在 Database → Realtime 中启用该表
alter publication supabase_realtime add table public.user_data;
