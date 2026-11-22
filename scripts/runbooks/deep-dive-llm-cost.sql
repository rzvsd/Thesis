-- Deep Dive LLM spend per stored report (reports.llm_usage, written by dexter-worker).
-- Usage: psql "$DATABASE_URL" -f scripts/runbooks/deep-dive-llm-cost.sql
-- Optional window: psql ... -v since="'2026-11-01'" (defaults to all time).
-- Costs come from apps/dexter-worker/llm-prices.json at run time. Reports with
-- unpriced_call_count > 0 have a lower-bound cost. Runs that failed (including
-- budget stops) store no report; their usage is only in the worker logs
-- ("Deep Dive LLM usage").
\if :{?since}
\else
  \set since '''1970-01-01'''
\endif

with runs as (
  select
    (llm_usage->>'estimated_cost_usd')::numeric as cost_usd,
    (llm_usage->>'unpriced_call_count')::int as unpriced_calls,
    (llm_usage->>'input_tokens')::bigint as input_tokens,
    (llm_usage->>'cached_input_tokens')::bigint as cached_input_tokens,
    (llm_usage->>'output_tokens')::bigint as output_tokens,
    jsonb_array_length(llm_usage->'calls') as llm_calls
  from reports
  where type = 'deep_dive'
    and llm_usage is not null
    and created_at >= :since::timestamptz
)
select
  count(*) as reports,
  count(*) filter (where unpriced_calls > 0) as reports_with_unpriced_calls,
  round(avg(cost_usd), 4) as avg_cost_usd,
  round(percentile_cont(0.5) within group (order by cost_usd)::numeric, 4) as p50_cost_usd,
  round(percentile_cont(0.95) within group (order by cost_usd)::numeric, 4) as p95_cost_usd,
  round(max(cost_usd), 4) as max_cost_usd,
  round(avg(llm_calls), 1) as avg_llm_calls,
  round(avg(input_tokens)) as avg_input_tokens,
  round(avg(cached_input_tokens)) as avg_cached_input_tokens,
  round(avg(output_tokens)) as avg_output_tokens
from runs;
