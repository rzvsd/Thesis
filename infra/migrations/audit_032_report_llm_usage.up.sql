-- Per-report LLM token usage and estimated cost (dexter-worker llm_usage payload).
alter table if exists reports
  add column if not exists llm_usage jsonb null;
