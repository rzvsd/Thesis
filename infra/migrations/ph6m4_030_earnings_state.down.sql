drop index if exists idx_calendar_events_ticker_type_state_date;

alter table if exists calendar_events
  drop constraint if exists calendar_events_source_state_check;
alter table if exists calendar_events
  drop constraint if exists calendar_events_timing_state_check;

alter table if exists calendar_events
  drop column if exists reason_text;
alter table if exists calendar_events
  drop column if exists source_ref;
alter table if exists calendar_events
  drop column if exists source_state;
alter table if exists calendar_events
  drop column if exists timing_state;
