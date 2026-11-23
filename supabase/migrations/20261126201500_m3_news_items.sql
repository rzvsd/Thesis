-- News store (rebuild branch audit NG8): the headlines the news job read, and how each source did.
-- Written by POST /internal/news/ingest, read by GET /internal/news (the Pulse job reads its window back).
-- A row is a headline, its source, its link and its time. There is no column for article text.
-- A publisher headline (rights = headline_link_only) may be at most 120 characters: the "very short extract"
-- limit of Romanian Law 8/1996 art. 94^1 (EU Directive 2019/790 art. 15).
-- Additive only. RLS on, no grants to anon or authenticated (AGENTS rule 6).
create table if not exists app.news_items (
  article_id text primary key check (article_id ~ '^[0-9a-f]{64}$'),
  source_key text not null,
  source_name text not null,
  url text not null check (url ~ '^https?://'),
  title text not null check (char_length(title) between 1 and 300),
  published_at timestamptz not null,
  rights text not null check (rights in ('official_public', 'headline_link_only')),
  tickers text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint news_items_publisher_headline_length
    check (rights <> 'headline_link_only' or char_length(title) <= 120)
);
alter table app.news_items enable row level security;
create index if not exists idx_news_items_published on app.news_items (published_at desc);
create index if not exists idx_news_items_tickers on app.news_items using gin (tickers);
grant select, insert, update, delete on app.news_items to thesis_api;

create table if not exists app.news_source_status (
  source_key text primary key,
  last_checked_at timestamptz not null,
  last_ok_at timestamptz,
  last_error_code text,
  last_article_count integer not null default 0,
  newest_item_at timestamptz,
  consecutive_failures integer not null default 0
);
alter table app.news_source_status enable row level security;
grant select, insert, update, delete on app.news_source_status to thesis_api;
