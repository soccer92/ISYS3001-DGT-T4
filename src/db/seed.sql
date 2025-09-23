-- Seed data for "tasks" table
-- Run once after schema to have sample rows

INSERT INTO tasks (id,title,status,priority,due_at,user_id,created_at,updated_at) VALUES
  ('seed-1','Walk Dog','in_progress','high',NULL,NULL,datetime('now'),datetime('now')),
  ('seed-2','Buy Groceries','todo','low',NULL,NULL,datetime('now'),datetime('now')),
  ('seed-3','Go to GYM','done','medium',NULL,NULL,datetime('now'),datetime('now'));
