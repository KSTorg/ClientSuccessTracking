-- Meeting summaries: multiple entries per week, collapsible
create table if not exists meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  week_number integer not null,
  title text not null default 'Call',
  content text not null default '',
  author_name text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_summaries_client_week
  on meeting_summaries(client_id, week_number);

alter table meeting_summaries enable row level security;

drop policy if exists "Authenticated users can manage meeting summaries" on meeting_summaries;
create policy "Authenticated users can manage meeting summaries"
  on meeting_summaries for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
