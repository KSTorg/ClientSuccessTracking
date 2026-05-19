-- Meeting summary: single textarea per week, stored on weekly_reports
alter table weekly_reports add column if not exists meeting_summary text;

-- Drop meeting_summaries table if it was already created
drop table if exists meeting_summaries;

-- Team notes: comment thread per week
create table if not exists team_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  week_number integer not null,
  content text not null default '',
  author_name text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_team_notes_client_week on team_notes(client_id, week_number);

alter table team_notes enable row level security;

drop policy if exists "Authenticated users can manage team notes" on team_notes;
create policy "Authenticated users can manage team notes"
  on team_notes for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
