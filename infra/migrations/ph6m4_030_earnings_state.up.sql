alter table if exists calendar_events
  add column if not exists timing_state text not null default 'estimated';
alter table if exists calendar_events
  add column if not exists source_state text not null default 'derived';
alter table if exists calendar_events
  add column if not exists source_ref jsonb not null default '{}'::jsonb;
alter table if exists calendar_events
  add column if not exists reason_text text not null default '';

alter table if exists calendar_events
  drop constraint if exists calendar_events_timing_state_check;
alter table if exists calendar_events
  add constraint calendar_events_timing_state_check check (
    timing_state in ('estimated', 'confirmed', 'actual')
  );

alter table if exists calendar_events
  drop constraint if exists calendar_events_source_state_check;
alter table if exists calendar_events
  add constraint calendar_events_source_state_check check (
    source_state in ('official', 'first_party', 'derived', 'mixed', 'conflicting')
  );

create index if not exists idx_calendar_events_ticker_type_state_date
  on calendar_events (ticker, event_type, timing_state, event_date);
