-- ========================================
-- 商务专员工作台 - Supabase 数据库建表脚本
-- 在 Supabase SQL Editor 中运行此脚本
-- ========================================

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT,
  project_name TEXT,
  customer TEXT,
  salesperson TEXT,
  proposal_number TEXT DEFAULT '',
  contract_amount NUMERIC DEFAULT 0,
  created_at TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  remark TEXT DEFAULT '',
  steps JSONB DEFAULT '{}'::jsonb
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT DEFAULT '',
  date TEXT,
  priority TEXT DEFAULT 'medium',
  completed BOOLEAN DEFAULT FALSE,
  related_order TEXT DEFAULT '',
  salesperson TEXT DEFAULT ''
);

-- 启用行级安全（RLS）
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问（个人工作台使用 anon key）
CREATE POLICY "all_orders" ON orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "all_tasks" ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);
